
'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
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
import { Separator } from './ui/separator';

interface AppointmentWithBarber extends Appointment {
  barber: Barber | null;
}

async function getAllBarbers(): Promise<Barber[]> {
    const barbersCol = collection(db, 'barbers');
    const barberSnapshot = await getDocs(barbersCol);
    const barberList = barberSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Barber));
    return barberList;
}

export function ClientDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [scheduledAppointments, setScheduledAppointments] = useState<AppointmentWithBarber[]>([]);
  const [pastAppointments, setPastAppointments] = useState<AppointmentWithBarber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const fetchAppointments = async () => {
    if (user) {
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
              barber: barber,
            });
          });
        }
        
        allAppointments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const scheduled: AppointmentWithBarber[] = [];
        const past: AppointmentWithBarber[] = [];

        allAppointments.forEach(app => {
          const appDate = new Date(app.date + 'T12:00:00Z');
          if (app.status === 'cancelled' || appDate < today) {
            past.push(app);
          } else {
            scheduled.push(app);
          }
        });

        setScheduledAppointments(scheduled);
        setPastAppointments(past);

      } catch (error) {
        console.error("Error fetching client appointments: ", error);
        toast({ title: 'Erro', description: 'Não foi possível carregar os agendamentos.', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [user]);

  const handleCancelAppointment = async (appointment: AppointmentWithBarber) => {
    if (!appointment.barber) return;
    setIsUpdating(appointment.id);
    const result = await cancelAppointmentAction(appointment.barber.id, appointment.id);
    if (result.success) {
        toast({ description: 'Agendamento cancelado com sucesso.' });
        fetchAppointments(); // Re-fetch to re-organize lists
    } else {
        toast({ title: 'Erro', description: result.message, variant: 'destructive' });
    }
    setIsUpdating(null);
  }

  const AppointmentCard = ({ app }: { app: AppointmentWithBarber}) => {
    const isCancelled = app.status === 'cancelled';
    const isPast = new Date(app.date + 'T12:00:00Z') < new Date(new Date().setHours(0, 0, 0, 0));
    const isActionable = !isCancelled && !isPast;

    return (
        <Card className={cn("bg-card border-border shadow-lg flex flex-col", (isCancelled || isPast) && 'opacity-60 bg-muted/50')}>
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
                 <div className='flex gap-2 pt-2'>
                    <Badge variant={app.type === 'inShop' ? 'secondary' : 'default'} className={cn(app.type === 'atHome' ? 'bg-accent hover:bg-accent/80' : '')}>
                        {app.type === 'inShop' ? 'Na Barbearia' : 'Em Domicílio'}
                    </Badge>
                    {isCancelled && <Badge variant="destructive" className="bg-muted-foreground">Cancelado</Badge>}
                    {isPast && !isCancelled && <Badge variant="outline">Finalizado</Badge>}
                </div>
            </CardContent>
            {isActionable && (
                <CardContent>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" className="w-full" disabled={isUpdating === app.id}>
                                {isUpdating === app.id ? <Icons.Spinner/> : <><Icons.X className="mr-2 h-4 w-4"/> Cancelar</>}
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
    );
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
        
        {scheduledAppointments.length === 0 && pastAppointments.length === 0 ? (
             <Card className="bg-card border-border shadow-lg text-center py-16">
                <CardContent>
                    <Icons.Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
                    <p className="mt-4 text-muted-foreground">Você ainda não tem agendamentos.</p>
                </CardContent>
            </Card>
        ) : (
            <div className="space-y-10">
                <div>
                    <h2 className="text-2xl font-headline font-semibold mb-4">Próximos Agendamentos</h2>
                    {scheduledAppointments.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {scheduledAppointments.map(app => <AppointmentCard key={app.id} app={app} />)}
                        </div>
                    ) : (
                        <p className="text-muted-foreground">Nenhum próximo agendamento encontrado.</p>
                    )}
                </div>
                
                {pastAppointments.length > 0 && (
                    <div>
                        <Separator className="my-8" />
                        <h2 className="text-2xl font-headline font-semibold mb-4">Histórico de Agendamentos</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {pastAppointments.map(app => <AppointmentCard key={app.id} app={app} />)}
                        </div>
                    </div>
                )}
            </div>
        )}
     </div>
  );
}
