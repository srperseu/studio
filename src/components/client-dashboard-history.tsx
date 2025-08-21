
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
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
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

export function ClientDashboardHistory() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [appointments, setAppointments] = useState<AppointmentWithBarber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
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
        
        const sortedAppointments = allAppointments.sort((a,b) => {
            const dateA = new Date(`${a.date}T${a.time}`);
            const dateB = new Date(`${b.date}T${b.time}`);
            return dateB.getTime() - dateA.getTime();
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

  const pastAppointments = useMemo(() => {
    const pastList: AppointmentWithBarber[] = [];

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    appointments.forEach(app => {
      const appDate = new Date(app.date + 'T00:00:00');
      
      if (app.status !== 'scheduled' || appDate < today) {
        pastList.push(app);
      }
    });
    
    pastList.sort((a,b) => new Date(`${b.date}T${b.time}`).getTime() - new Date(`${a.date}T${a.time}`).getTime());

    return pastList;
  }, [appointments]);


  const filteredHistory = useMemo(() => {
    if (historyFilter === 'all') return pastAppointments;
    return pastAppointments.filter(app => app.status === historyFilter);
  }, [pastAppointments, historyFilter]);


  const AppointmentCard = ({ app }: { app: AppointmentWithBarber}) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const appDate = new Date(app.date + 'T00:00:00');
    const isPast = appDate < today;
    
    const getStatusBadge = () => {
        switch(app.status) {
            case 'completed': return <Badge variant="secondary" className="bg-green-600 hover:bg-green-700 text-white">Finalizado</Badge>;
            case 'cancelled': return <Badge variant="destructive" className="bg-muted-foreground">Cancelado</Badge>;
            case 'no-show': return <Badge variant="destructive">Não Compareceu</Badge>;
            case 'scheduled': 
                if (isPast) return <Badge variant="outline">Aguardando Confirmação</Badge>;
                return null;
        }
    }

    return (
        <Card className={cn("bg-card border-border shadow-lg flex flex-col opacity-70 bg-muted/50")}>
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
                    <span>R$ {(app.servicePrice || 0).toFixed(2)}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Icons.MapPin className="h-4 w-4" />
                    <span>{app.barber?.address?.fullAddress || 'Endereço não informado'}</span>
                </div>
                 <div className='flex gap-2 pt-2'>
                    <Badge variant={app.type === 'inShop' ? 'secondary' : 'default'} className={cn(app.type === 'atHome' ? 'bg-accent hover:bg-accent/80' : '')}>
                        {app.type === 'inShop' ? 'Na Barbearia' : 'Em Domicílio'}
                    </Badge>
                    {getStatusBadge()}
                </div>
            </CardContent>
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
        
        {pastAppointments.length === 0 ? (
             <Card className="bg-card border-border shadow-lg text-center py-16">
                <CardContent>
                    <Icons.Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
                    <p className="mt-4 text-muted-foreground">Você ainda não tem um histórico de agendamentos.</p>
                </CardContent>
            </Card>
        ) : (
            <div>
                <Tabs value={historyFilter} onValueChange={(value) => setHistoryFilter(value as any)} className="w-full">
                <TabsList className="grid w-full grid-cols-4 mb-4">
                    <TabsTrigger value="all">Todos</TabsTrigger>
                    <TabsTrigger value="completed">Realizados</TabsTrigger>
                    <TabsTrigger value="cancelled">Cancelados</TabsTrigger>
                    <TabsTrigger value="no-show">Não Compareceu</TabsTrigger>
                </TabsList>
                <TabsContent value="all">
                    {filteredHistory.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredHistory.map(app => <AppointmentCard key={app.id} app={app} />)}
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-center py-8">Nenhum agendamento no histórico para este filtro.</p>
                    )}
                </TabsContent>
                <TabsContent value="completed">
                    {filteredHistory.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredHistory.map(app => <AppointmentCard key={app.id} app={app} />)}
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-center py-8">Nenhum agendamento no histórico para este filtro.</p>
                    )}
                </TabsContent>
                <TabsContent value="cancelled">
                    {filteredHistory.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredHistory.map(app => <AppointmentCard key={app.id} app={app} />)}
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-center py-8">Nenhum agendamento no histórico para este filtro.</p>
                    )}
                </TabsContent>
                <TabsContent value="no-show">
                    {filteredHistory.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredHistory.map(app => <AppointmentCard key={app.id} app={app} />)}
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-center py-8">Nenhum agendamento no histórico para este filtro.</p>
                    )}
                </TabsContent>
                </Tabs>
            </div>
        )}
     </div>
  );
}
