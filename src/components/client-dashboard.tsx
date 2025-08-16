
'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

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
  
  const [scheduledFilter, setScheduledFilter] = useState<'all' | 'inShop' | 'atHome'>('all');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'completed' | 'cancelled' | 'no-show'>('all');


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
        
        const sortedAppointments = allAppointments.sort((a,b) => new Date(b.date).getTime() - new Date(b.date).getTime() || b.time.localeCompare(a.time));

        const now = new Date();
        const scheduled: AppointmentWithBarber[] = [];
        const past: AppointmentWithBarber[] = [];

        sortedAppointments.forEach(app => {
          const appDateTime = new Date(`${app.date}T${app.time}`);
          if (app.status === 'scheduled' && appDateTime >= now) {
            scheduled.push(app);
          } else {
            past.push(app);
          }
        });

        setScheduledAppointments(scheduled.sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.time.localeCompare(b.time)));
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
    if (!user) return;
    fetchAppointments();
  }, [user]);

  const filteredScheduled = useMemo(() => {
    return scheduledAppointments.filter(app => {
        if (scheduledFilter === 'all') return true;
        return app.type === scheduledFilter;
    });
  }, [scheduledAppointments, scheduledFilter]);

  const filteredHistory = useMemo(() => {
    return pastAppointments.filter(app => {
        if (historyFilter === 'all') return true;
        return app.status === historyFilter;
    });
  }, [pastAppointments, historyFilter]);


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
    const isPast = new Date(`${app.date}T${app.time}`) < new Date();
    const isActionable = app.status === 'scheduled' && !isPast;
    
    const getStatusBadge = () => {
        switch(app.status) {
            case 'completed': return <Badge variant="secondary" className="bg-green-600 text-white">Finalizado</Badge>;
            case 'cancelled': return <Badge variant="destructive" className="bg-muted-foreground">Cancelado</Badge>;
            case 'no-show': return <Badge variant="destructive">Não Compareceu</Badge>;
            case 'scheduled': 
                if (isPast) return <Badge variant="outline">Aguardando Confirmação</Badge>;
                return null;
        }
    }

    return (
        <Card className={cn("bg-card border-border shadow-lg flex flex-col", !isActionable && 'opacity-70 bg-muted/50')}>
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
                    {getStatusBadge()}
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
                {scheduledAppointments.length > 0 && (
                    <div>
                        <h2 className="text-2xl font-headline font-semibold mb-4">Próximos Agendamentos</h2>
                        <Tabs value={scheduledFilter} onValueChange={(value) => setScheduledFilter(value as any)}>
                            <TabsList className="grid w-full grid-cols-3 mb-4">
                                <TabsTrigger value="all">Todos</TabsTrigger>
                                <TabsTrigger value="inShop">Na Barbearia</TabsTrigger>
                                <TabsTrigger value="atHome">Em Domicílio</TabsTrigger>
                            </TabsList>
                        </Tabs>
                        {filteredScheduled.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {filteredScheduled.map(app => <AppointmentCard key={app.id} app={app} />)}
                            </div>
                        ) : (
                            <p className="text-muted-foreground text-center py-8">Nenhum próximo agendamento encontrado para este filtro.</p>
                        )}
                    </div>
                )}
                
                {pastAppointments.length > 0 && (
                    <div>
                        <Separator className="my-8" />
                        <h2 className="text-2xl font-headline font-semibold mb-4">Histórico de Agendamentos</h2>
                        <Tabs value={historyFilter} onValueChange={(value) => setHistoryFilter(value as any)}>
                            <TabsList className="grid w-full grid-cols-4 mb-4">
                                <TabsTrigger value="all">Todos</TabsTrigger>
                                <TabsTrigger value="completed">Realizados</TabsTrigger>
                                <TabsTrigger value="cancelled">Cancelados</TabsTrigger>
                                <TabsTrigger value="no-show">Não Compareceu</TabsTrigger>
                            </TabsList>
                        </Tabs>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredHistory.length > 0 ? (
                                filteredHistory.map(app => <AppointmentCard key={app.id} app={app} />)
                            ): (
                                <p className="text-muted-foreground text-center py-8">Nenhum agendamento no histórico para este filtro.</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        )}
     </div>
  );
}

    

    