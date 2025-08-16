
'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import type { Appointment, Barber } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icons } from './icons';
import { Skeleton } from './ui/skeleton';
import { Badge } from './ui/badge';
import Link from 'next/link';
import { Button } from './ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { cancelAppointmentAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface AppointmentWithBarber extends Appointment {
  barber: Barber | null;
}

// Function to get all barbers
async function getAllBarbers(): Promise<Barber[]> {
    const barbersCol = collection(db, 'barbers');
    const barberSnapshot = await getDocs(barbersCol);
    const barberList = barberSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Barber));
    return barberList;
}

export function ClientDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<AppointmentWithBarber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      const fetchAppointments = async () => {
        setIsLoading(true);
        try {
          const allBarbers = await getAllBarbers();
          const allAppointments: AppointmentWithBarber[] = [];

          for (const barber of allBarbers) {
            const appointmentsQuery = query(
              collection(db, 'barbers', barber.id, 'appointments'),
              where('clientUid', '==', user.uid)
            );

            const appointmentsSnapshot = await getDocs(appointmentsQuery);
            appointmentsSnapshot.forEach(doc => {
              allAppointments.push({
                ...(doc.data() as Appointment),
                id: doc.id,
                barber: barber, // Attach the barber data
              });
            });
          }
          
          // Sort appointments by date client-side
          allAppointments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setAppointments(allAppointments);

        } catch (error) {
          console.error("Error fetching client appointments: ", error);
        } finally {
          setIsLoading(false);
        }
      };

      fetchAppointments();
    }
  }, [user]);

  const handleCancelAppointment = async (appointment: AppointmentWithBarber) => {
    if (!appointment.barber) return;
    setIsUpdating(appointment.id);
    const result = await cancelAppointmentAction(appointment.barber.id, appointment.id);
    if (result.success) {
        toast({ description: 'Agendamento cancelado com sucesso.' });
        setAppointments(prev => 
            prev.map(app => 
                app.id === appointment.id ? { ...app, status: 'cancelled' } : app
            )
        );
    } else {
        toast({ title: 'Erro', description: result.message, variant: 'destructive' });
    }
    setIsUpdating(null);
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="bg-card border-border shadow-lg">
                <CardHeader>
                    <Skeleton className="h-6 w-3/4 bg-muted" />
                    <Skeleton className="h-4 w-1/2 bg-muted mt-2" />
                </CardHeader>
                <CardContent className="space-y-2">
                    <Skeleton className="h-4 w-full bg-muted" />
                    <Skeleton className="h-4 w-3/4 bg-muted" />
                </CardContent>
            </Card>
        ))}
      </div>
    );
  }

  return (
     <div className="space-y-8">
        <div className="flex justify-end">
            <Link href="/booking">
                <Button>
                    <Icons.Calendar className="mr-2"/>
                    Fazer Novo Agendamento
                </Button>
            </Link>
        </div>
        {appointments.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {appointments.map(app => {
                const isCancelled = app.status === 'cancelled';
                return (
                    <Card key={app.id} className={cn("bg-card border-border shadow-lg flex flex-col", isCancelled && 'opacity-60')}>
                        <CardHeader>
                            <CardTitle className="text-primary">{app.service}</CardTitle>
                            <p className="text-sm text-muted-foreground">com {app.barber?.fullName || 'Barbeiro desconhecido'}</p>
                        </CardHeader>
                        <CardContent className="flex-grow space-y-3">
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Icons.Calendar className="h-4 w-4" />
                                <span>{new Date(app.date + 'T12:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'long', year: 'numeric' })} às {app.time}</span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Icons.MapPin className="h-4 w-4" />
                                <span>{app.barber?.address || 'Endereço não informado'}</span>
                            </div>
                            <Badge variant={app.type === 'inShop' ? 'secondary' : 'default'} className={cn(app.type === 'atHome' ? 'bg-accent hover:bg-accent/80' : '')}>
                                {app.type === 'inShop' ? 'Na Barbearia' : 'Em Domicílio'}
                            </Badge>
                             {isCancelled && <Badge variant="destructive" className="mt-2 bg-muted-foreground">Cancelado</Badge>}
                        </CardContent>
                        {!isCancelled && (
                            <CardContent>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="destructive" className="w-full" disabled={isUpdating === app.id}>
                                            {isUpdating === app.id ? <Icons.Spinner/> : <><Icons.X className="mr-2 h-4 w-4"/> Cancelar Agendamento</>}
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                Esta ação não pode ser desfeita. O barbeiro será notificado.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Voltar</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleCancelAppointment(app)}>
                                                Confirmar Cancelamento
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </CardContent>
                        )}
                    </Card>
                )
            })}
            </div>
        ) : (
            <Card className="bg-card border-border shadow-lg text-center py-16">
                <CardContent>
                    <Icons.Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
                    <p className="mt-4 text-muted-foreground">Você ainda não tem agendamentos.</p>
                </CardContent>
            </Card>
        )}
     </div>
  );
}
