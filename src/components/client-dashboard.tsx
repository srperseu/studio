
'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import type { Appointment, Barber } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


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
  const [appointments, setAppointments] = useState<AppointmentWithBarber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  
  const [scheduledFilter, setScheduledFilter] = useState<'all' | 'inShop' | 'atHome'>('all');

  const fetchAppointments = async () => {
    if (user) {
      setIsLoading(true);
      try {
        const allBarbers = await getAllBarbers();
        const allAppointments: AppointmentWithBarber[] = [];

        for (const barber of allBarbers) {
          const appointmentsQuery = query(
            collection(db, 'barbers', barber.id, 'appointments'),
            where('clientUid', '==', user.uid),
            where('status', '==', 'scheduled')
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
        
        const sortedAppointments = allAppointments.sort((a,b) => {
            const dateA = new Date(`${a.date}T${a.time}`);
            const dateB = new Date(`${b.date}T${b.time}`);
            return dateA.getTime() - dateB.getTime();
        });

        setAppointments(sortedAppointments);

      } catch (error) {
        console.error("Error fetching client appointments: ", error);
        toast({ title: 'Erro', description: 'Não foi possível carregar os agendamentos.', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchAppointments();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const scheduledAppointments = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return appointments.filter(app => {
      const appDate = new Date(app.date + 'T00:00:00');
      return app.status === 'scheduled' && appDate >= today;
    });
  }, [appointments]);

  const filteredScheduled = useMemo(() => {
    if (scheduledFilter === 'all') return scheduledAppointments;
    return scheduledAppointments.filter(app => app.type === scheduledFilter);
  }, [scheduledAppointments, scheduledFilter]);


  const handleCancelAppointment = async (appointment: AppointmentWithBarber) => {
    if (!appointment.barber) return;
    setIsUpdating(appointment.id);
    const result = await cancelAppointmentAction(appointment.barber.id, appointment.id);
    if (result.success) {
        toast({ description: 'Agendamento cancelado com sucesso.' });
        fetchAppointments(); // Re-fetch to update lists
    } else {
        toast({ title: 'Erro', description: result.message, variant: 'destructive' });
    }
    setIsUpdating(null);
  }

  const AppointmentCard = ({ app }: { app: AppointmentWithBarber}) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const appDate = new Date(app.date + 'T00:00:00');
    const isPast = appDate < today;
    const isActionable = app.status === 'scheduled' && !isPast;
    
    return (
        <Card className={cn("bg-card border-border shadow-lg flex flex-col")}>
            <CardHeader>
                <CardTitle className="text-primary">{app.serviceName}</CardTitle>
                <p className="text-sm text-muted-foreground">com {app.barber?.fullName || 'Barbeiro desconhecido'}</p>
            </CardHeader>
            <CardContent className="flex-grow space-y-3">
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Icons.Calendar className="h-4 w-4" />
                    <span>{new Date(app.date + 'T12:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'long', year: 'numeric' })} às {app.time}</span>
                </div>
                 <div className="flex items-center gap-2 text-muted-foreground">
                    <Icons.DollarSign className="h-4 w-4" />
                    <span>R$ {app.servicePrice !== undefined && app.servicePrice !== null ? app.servicePrice.toFixed(2) : '0.00'}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Icons.MapPin className="h-4 w-4" />
                    <span>{app.barber?.address?.fullAddress || 'Endereço não informado'}</span>
                </div>
                 <div className='flex gap-2 pt-2'>
                    <Badge variant={app.type === 'inShop' ? 'secondary' : 'default'} className={cn(app.type === 'atHome' ? 'bg-accent hover:bg-accent/80' : '')}>
                        {app.type === 'inShop' ? 'Na Barbearia' : 'Em Domicílio'}
                    </Badge>
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
     <div className="space-y-8 mt-8">
        <div className="flex justify-end">
            <Link href="/booking">
                <Button>
                    <Icons.Calendar className="mr-2"/>
                    Fazer Novo Agendamento
                </Button>
            </Link>
        </div>
        
        {filteredScheduled.length === 0 ? (
             <Card className="bg-card border-border shadow-lg text-center py-16">
                <CardContent>
                    <Icons.Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
                    <p className="mt-4 text-muted-foreground">Você não tem próximos agendamentos.</p>
                </CardContent>
            </Card>
        ) : (
            <Tabs value={scheduledFilter} onValueChange={(value) => setScheduledFilter(value as any)} className="w-full">
                <TabsList className="grid w-full grid-cols-3 mb-4">
                    <TabsTrigger value="all">Todos</TabsTrigger>
                    <TabsTrigger value="inShop">Na Barbearia</TabsTrigger>
                    <TabsTrigger value="atHome">Em Domicílio</TabsTrigger>
                </TabsList>
                <TabsContent value="all">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredScheduled.map(app => <AppointmentCard key={app.id} app={app} />)}
                    </div>
                </TabsContent>
                <TabsContent value="inShop">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredScheduled.map(app => <AppointmentCard key={app.id} app={app} />)}
                    </div>
                </TabsContent>
                <TabsContent value="atHome">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredScheduled.map(app => <AppointmentCard key={app.id} app={app} />)}
                    </div>
                </TabsContent>
            </Tabs>
        )}
     </div>
  );
}
