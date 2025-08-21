
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuthGuard } from '@/hooks/use-auth-guard';
import { collection, query, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Appointment, Barber } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Header } from '@/components/header';
import { Icons } from '@/components/icons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { cancelAppointmentAction, completeAppointmentAction, markAsNoShowAction } from '@/app/actions';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';


export default function BarberHistoryPage() {
  const { user, loading } = useAuthGuard('barber');
  const { toast } = useToast();

  const [barberData, setBarberData] = useState<Barber | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'completed' | 'cancelled' | 'no-show' | 'scheduled'>('all');


  const fetchData = async () => {
    if (user) {
        setIsLoading(true);
        try {
          const barberRef = doc(db, 'barbers', user.uid);
          const barberSnap = await getDoc(barberRef);
          if (barberSnap.exists()) {
            const data = barberSnap.data();
            setBarberData({
                id: barberSnap.id,
                ...data,
                services: data.services || [],
             } as Barber);
          }

          const q = query(collection(db, `barbers/${user.uid}/appointments`));
          const appointmentsSnapshot = await getDocs(q);
          const allAppointments: Appointment[] = [];
          appointmentsSnapshot.forEach((doc) => allAppointments.push({ id: doc.id, ...doc.data() } as Appointment));
          
          const sortedAppointments = allAppointments.sort((a,b) => {
              const dateA = new Date(`${a.date}T${a.time}`);
              const dateB = new Date(`${b.date}T${b.time}`);
              return dateB.getTime() - dateA.getTime();
          });
          
          setAppointments(sortedAppointments);

        } catch (error) {
            console.error("Error fetching dashboard data:", error);
            toast({ title: 'Erro', description: 'Não foi possível carregar os dados do painel.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
    }
  };

  useEffect(() => {
    if (!user || loading) return;
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading]);

  const pastAppointments = useMemo(() => {
    const pastList: Appointment[] = [];
    const now = new Date();

    appointments.forEach(app => {
      const appDateTime = new Date(`${app.date}T${app.time}`);
      if (app.status !== 'scheduled' || (app.status === 'scheduled' && appDateTime < now)) {
        pastList.push(app);
      }
    });

    return pastList;
  }, [appointments]);


  const filteredHistory = useMemo(() => {
    if (historyFilter === 'all') return pastAppointments;
    return pastAppointments.filter(app => app.status === historyFilter);
  }, [pastAppointments, historyFilter]);


  const AppointmentCard = useCallback(({ app, context, barberId }: { app: Appointment, context: 'pending' | 'scheduled' | 'history', barberId: string | undefined }) => {
      const status = app.status;
      const isActionable = context === 'pending';
      const now = new Date();
      const appDateTime = new Date(`${app.date}T${app.time}`);
      const isPending = status === 'scheduled' && appDateTime < now;
      
      const getStatusBadge = () => {
          switch(status) {
              case 'completed': return <Badge variant="secondary" className="bg-green-600 hover:bg-green-700 text-white">Finalizado</Badge>;
              case 'cancelled': return <Badge variant="destructive" className="bg-muted-foreground">Cancelado</Badge>;
              case 'no-show': return <Badge variant="destructive">Não Compareceu</Badge>;
              case 'scheduled':
                if (isPending) return <Badge variant="outline">Pendente</Badge>;
                return null;
          }
      }

      const handleRouteClick = () => {
        if (!barberData?.coordinates) {
          toast({ title: 'Erro de Rota', description: 'As coordenadas do seu endereço não foram encontradas. Verifique seu perfil.', variant: 'destructive' });
          return;
        }
        if (!app.clientCoordinates) {
          toast({ title: 'Erro de Rota', description: 'Coordenadas do cliente não encontradas para este agendamento.', variant: 'destructive' });
          return;
        }
        const origin = `${barberData.coordinates.lat},${barberData.coordinates.lng}`;
        const destination = `${app.clientCoordinates.lat},${app.clientCoordinates.lng}`;
        const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
        window.open(url, '_blank');
      };

      return (
          <div key={app.id} className={cn(
            "bg-muted/70 p-4 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border",
            isPending ? 'border-primary' : 'border-muted-foreground/20',
            status !== 'scheduled' && 'opacity-70'
          )}>
            <div className="flex-grow">
              <p className="font-bold text-lg text-primary">{app.clientName}</p>
              <p className="text-muted-foreground">{app.serviceName} - R$ {(app.servicePrice ?? 0).toFixed(2)}</p>
              <p className="font-semibold">{new Date(app.date + 'T12:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'long', day: '2-digit', month: 'long' })} às {app.time}</p>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                 {app.type === 'inShop' ? (
                  <Badge variant="default">
                    <Icons.Scissors className="mr-1 h-3 w-3"/>
                    Na Barbearia
                  </Badge>
                 ) : (
                  <Badge variant="outline" className="bg-transparent hover:bg-muted">
                    <Icons.Home className="mr-1 h-3 w-3"/>
                    Em Domicílio
                  </Badge>
                 )}

                {app.type === 'atHome' && (
                    <Button variant="outline" size="sm" className="h-auto py-0.5 px-2 text-xs hover:bg-muted hover:text-muted-foreground" onClick={handleRouteClick}>
                        <Icons.MapPin className="mr-1 h-3 w-3"/>
                        Ver Rota
                     </Button>
                )}
                {getStatusBadge()}
              </div>
            </div>
            {isActionable && (
              <div className="flex flex-col sm:flex-row sm:items-end gap-2 w-full sm:w-auto">
                    <Button size="sm" onClick={() => handleUpdateStatus(app.id, 'complete')} disabled={isUpdating === app.id} className="bg-green-600 hover:bg-green-700 w-full sm:w-auto">
                      {isUpdating === app.id ? <Icons.Spinner /> : <><Icons.Check className="mr-2 h-4 w-4" /></>}
                      Confirmar
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleUpdateStatus(app.id, 'no-show')} disabled={isUpdating === app.id} className="w-full sm:w-auto">
                      {isUpdating === app.id ? <Icons.Spinner /> : <Icons.X className="mr-2 h-4 w-4" />}
                      Não Compareceu
                    </Button>
              </div>
            )}
          </div>
      );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barberData?.id, isUpdating]);

  const handleUpdateStatus = async (appointmentId: string, action: 'cancel' | 'complete' | 'no-show') => {
    if (!barberData) return;
    setIsUpdating(appointmentId);
    let result;
    switch(action) {
        case 'cancel':
            result = await cancelAppointmentAction(barberData.id, appointmentId);
            break;
        case 'complete':
            result = await completeAppointmentAction(barberData.id, appointmentId);
            break;
        case 'no-show':
            result = await markAsNoShowAction(barberData.id, appointmentId);
            break;
    }

    if (result.success) {
      toast({ description: 'Agendamento atualizado com sucesso.' });
      fetchData(); // Refetch to update lists
    } else {
      toast({ title: 'Erro', description: result.message, variant: 'destructive' });
    }
    setIsUpdating(null);
  }

  if (loading || isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-4">
          <Icons.Spinner className="h-8 w-8" />
          <h1 className="text-2xl font-headline">Carregando Histórico...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <Header title="Histórico de Agendamentos" showBackButton onBackClick={() => window.history.back()} />
        <div className="mt-8">
            <Card className="bg-card border-border shadow-lg">
              <CardContent className="pt-6">
                {pastAppointments.length > 0 ? (
                  <Tabs value={historyFilter} onValueChange={(value) => setHistoryFilter(value as any)} className="w-full">
                    <TabsList className="grid w-full grid-cols-5 mb-4">
                        <TabsTrigger value="all">Todos</TabsTrigger>
                        <TabsTrigger value="completed">Realizados</TabsTrigger>
                        <TabsTrigger value="scheduled">Pendentes</TabsTrigger>
                        <TabsTrigger value="cancelled">Cancelados</TabsTrigger>
                        <TabsTrigger value="no-show">Não Compareceu</TabsTrigger>
                    </TabsList>
                    <div className="space-y-4">
                        {filteredHistory.length > 0 ? (
                            filteredHistory.map(app => (
                                <AppointmentCard
                                    key={app.id}
                                    app={app}
                                    context={app.status === 'scheduled' ? 'pending' : 'history'}
                                    barberId={barberData?.id}
                                />
                            ))
                        ) : (
                            <p className="text-muted-foreground text-center py-8">Nenhum agendamento encontrado para este filtro.</p>
                        )}
                    </div>
                  </Tabs>
                ) : (
                  <p className="text-muted-foreground text-center py-8">Nenhum agendamento no histórico.</p>
                )}
              </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}
