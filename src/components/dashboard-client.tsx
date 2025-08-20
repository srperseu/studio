
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { getDocs, doc, collection, query, orderBy } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth.tsx';
import { generateReminderAction, cancelAppointmentAction, completeAppointmentAction, markAsNoShowAction } from '@/app/actions';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Icons } from './icons';
import type { Barber, Appointment } from '@/lib/types';
import { db } from '@/lib/firebase';
import { getDoc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Separator } from './ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


export function DashboardClient() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [barberData, setBarberData] = useState<Barber | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState({ title: '', body: '' });
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const [scheduledFilter, setScheduledFilter] = useState<'all' | 'inShop' | 'atHome'>('all');
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
    if (!user) return;
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const { scheduledAppointments, pastAppointments } = useMemo(() => {
    const scheduledList: Appointment[] = [];
    const pastList: Appointment[] = [];

    const now = new Date();

    appointments.forEach(app => {
      const appDateTime = new Date(`${app.date}T${app.time}`);
      
      if (app.status === 'scheduled' && appDateTime >= now) {
        scheduledList.push(app);
      } else {
        pastList.push(app);
      }
    });

    scheduledList.sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());
    pastList.sort((a, b) => new Date(`${b.date}T${b.time}`).getTime() - new Date(`${a.date}T${a.time}`).getTime());

    return { scheduledAppointments: scheduledList, pastAppointments: pastList };
  }, [appointments]);

  const pendingAppointments = useMemo(() => {
    const now = new Date();
    return pastAppointments
      .filter(app => {
        const appDateTime = new Date(`${app.date}T${app.time}`);
        return app.status === 'scheduled' && appDateTime < now;
      })
      .sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());
  }, [pastAppointments]);

  const filteredScheduled = useMemo(() => {
    if (scheduledFilter === 'all') return scheduledAppointments;
    return scheduledAppointments.filter(app => app.type === scheduledFilter);
  }, [scheduledAppointments, scheduledFilter]);

  const filteredHistory = useMemo(() => {
    if (historyFilter === 'all') return pastAppointments;
    return pastAppointments.filter(app => app.status === historyFilter);
  }, [pastAppointments, historyFilter]);


  const handleGenerateReminder = async (appointment: Appointment) => {
    if (!barberData) return;
    setIsUpdating(appointment.id);
    
    const reminderDetails = {
      clientName: appointment.clientName,
      service: appointment.serviceName,
      date: appointment.date,
      time: appointment.time,
    };

    const result = await generateReminderAction(reminderDetails, barberData.fullName);
    if (result.success && result.reminderText) {
      setModalContent({ title: 'Lembrete de Agendamento', body: result.reminderText });
      setIsModalOpen(true);
    } else {
      toast({ title: 'Erro', description: result.message, variant: 'destructive' });
    }
    setIsUpdating(null);
  };
  
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

  const copyToClipboard = async () => {
    if (modalContent.body) {
      try {
        await navigator.clipboard.writeText(modalContent.body);
        toast({ description: "Texto copiado!" });
        setIsModalOpen(false);
      } catch (err) {
        toast({ description: "Falha ao copiar texto.", variant: 'destructive' });
      }
    }
  };
  
  const AppointmentCard = useCallback(({ app, context, barberId }: { app: Appointment, context: 'pending' | 'scheduled' | 'history', barberId: string | undefined }) => {
      const status = app.status;
      const isActionable = context === 'scheduled' || context === 'pending';
      
      const getStatusBadge = () => {
          switch(status) {
              case 'completed': return <Badge variant="secondary" className="bg-green-600 text-white">Finalizado</Badge>;
              case 'cancelled': return <Badge variant="destructive" className="bg-muted-foreground">Cancelado</Badge>;
              case 'no-show': return <Badge variant="destructive">Não Compareceu</Badge>;
              default: return null;
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
            "bg-muted/70 p-4 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-l-4",
            context === 'pending' ? 'border-accent' : context === 'scheduled' ? 'border-primary' : 'border-muted-foreground/50',
            context === 'history' && status !== 'scheduled' && 'opacity-70'
          )}>
            <div className="flex-grow">
              <p className="font-bold text-lg text-primary">{app.clientName}</p>
              <p className="text-muted-foreground">{app.serviceName} - R$ {(app.servicePrice ?? 0).toFixed(2)}</p>
              <p className="font-semibold">{new Date(app.date + 'T12:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'long', day: '2-digit', month: 'long' })} às {app.time}</p>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                 <Badge variant={'default'} className={cn(app.type === 'inShop' ? 'bg-primary/90' : 'bg-accent hover:bg-accent/90')}>
                    {app.type === 'inShop' ? 'Na Barbearia' : 'Em Domicílio'}
                 </Badge>

                {app.type === 'atHome' && (
                    <Button variant="outline" size="sm" className="h-auto py-0.5 px-2 text-xs" onClick={handleRouteClick}>
                        <Icons.MapPin className="mr-1 h-3 w-3"/>
                        Ver Rota
                     </Button>
                )}
                {context === 'history' && getStatusBadge()}
              </div>
            </div>
            {isActionable && (
              <div className="flex flex-col sm:flex-row sm:items-end gap-2 w-full sm:w-auto">
                {context === 'pending' ? (
                  <>
                    <Button size="sm" onClick={() => handleUpdateStatus(app.id, 'complete')} disabled={isUpdating === app.id} className="bg-green-600 hover:bg-green-700 w-full sm:w-auto">
                      {isUpdating === app.id ? <Icons.Spinner /> : <><Icons.Check className="mr-2 h-4 w-4" /></>}
                      Confirmar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleUpdateStatus(app.id, 'no-show')} disabled={isUpdating === app.id} className="w-full sm:w-auto">
                      {isUpdating === app.id ? <Icons.Spinner /> : <Icons.X className="mr-2 h-4 w-4" />}
                      Não Compareceu
                    </Button>
                  </>
                ) : ( // context === 'scheduled'
                  <>
                    <Button size="sm" onClick={() => handleGenerateReminder(app)} disabled={isUpdating === app.id} className="bg-accent hover:bg-accent/90 w-full sm:w-auto">
                    {isUpdating === app.id ? <Icons.Spinner /> : <Icons.Sparkles className="mr-2 h-4 w-4" />}
                    Lembrete
                    </Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive" disabled={isUpdating === app.id} className="w-full sm:w-auto">
                                <Icons.X className="mr-2 h-4 w-4" /> Cancelar
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    Esta ação não pode ser desfeita. O agendamento será marcado como cancelado.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Voltar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleUpdateStatus(app.id, 'cancel')}>
                                    {isUpdating === app.id ? <Icons.Spinner /> : "Confirmar Cancelamento"}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
            )}
          </div>
      );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barberData?.id, isUpdating]);

  if (authLoading || isLoading) {
    return <DashboardSkeleton />;
  }
  
  if (!barberData) {
      return <DashboardSkeleton />;
  }

  return (
    <>
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-primary">{modalContent.title}</DialogTitle>
          </DialogHeader>
          <div className="text-muted-foreground bg-muted p-4 rounded-md whitespace-pre-wrap">{modalContent.body}</div>
          <DialogFooter>
            <Button onClick={copyToClipboard} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
              Copiar Texto e Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {pendingAppointments.length > 0 && (
            <Card className="bg-card border-border shadow-lg border-l-4 border-accent">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-accent"><Icons.AlertTriangle className="text-accent" /> Pendente de Confirmação</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {pendingAppointments.map(app => <AppointmentCard key={app.id} app={app} context="pending" barberId={barberData?.id} />)}
                    </div>
                </CardContent>
            </Card>
          )}
          
          <Card className="bg-card border-border shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Icons.Bell /> Próximos Agendamentos</CardTitle>
            </CardHeader>
            <CardContent>
              {scheduledAppointments.length > 0 ? (
                <Tabs value={scheduledFilter} onValueChange={(value) => setScheduledFilter(value as any)} className="w-full">
                  <TabsList className="grid w-full grid-cols-3 mb-4">
                      <TabsTrigger value="all">Todos</TabsTrigger>
                      <TabsTrigger value="inShop">Na Barbearia</TabsTrigger>
                      <TabsTrigger value="atHome">Em Domicílio</TabsTrigger>
                  </TabsList>
                  <TabsContent value="all">
                      <div className="space-y-4">
                          {filteredScheduled.map(app => <AppointmentCard key={app.id} app={app} context="scheduled" barberId={barberData?.id} />)}
                      </div>
                  </TabsContent>
                  <TabsContent value="inShop">
                      <div className="space-y-4">
                          {filteredScheduled.map(app => <AppointmentCard key={app.id} app={app} context="scheduled" barberId={barberData?.id} />)}
                      </div>
                  </TabsContent>
                  <TabsContent value="atHome">
                      <div className="space-y-4">
                          {filteredScheduled.map(app => <AppointmentCard key={app.id} app={app} context="scheduled" barberId={barberData?.id} />)}
                      </div>
                  </TabsContent>
                </Tabs>
              ) : (
                <p className="text-muted-foreground text-center py-8">Nenhum próximo agendamento encontrado.</p>
              )}
            </CardContent>
          </Card>
          
           <Card className="bg-card border-border shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Icons.Calendar /> Histórico</CardTitle>
              </CardHeader>
              <CardContent>
                {pastAppointments.length > 0 ? (
                  <Tabs value={historyFilter} onValueChange={(value) => setHistoryFilter(value as any)} className="w-full">
                    <TabsList className="grid w-full grid-cols-5 mb-4">
                        <TabsTrigger value="all">Todos</TabsTrigger>
                        <TabsTrigger value="completed">Realizados</TabsTrigger>
                        <TabsTrigger value="scheduled">Pendentes</TabsTrigger>
                        <TabsTrigger value="cancelled">Cancelados</TabsTrigger>
                        <TabsTrigger value="no-show">Não Compareceu</TabsTrigger>
                    </TabsList>
                    <TabsContent value="all">
                        <div className="space-y-4">
                            {filteredHistory.map(app => <AppointmentCard key={app.id} app={app} context="history" barberId={barberData?.id} />)}
                        </div>
                    </TabsContent>
                    <TabsContent value="scheduled">
                          <div className="space-y-4">
                              {filteredHistory.map(app => <AppointmentCard key={app.id} app={app} context="history" barberId={barberData?.id} />)}
                          </div>
                    </TabsContent>
                    <TabsContent value="completed">
                          <div className="space-y-4">
                              {filteredHistory.map(app => <AppointmentCard key={app.id} app={app} context="history" barberId={barberData?.id} />)}
                          </div>
                    </TabsContent>
                    <TabsContent value="cancelled">
                          <div className="space-y-4">
                              {filteredHistory.map(app => <AppointmentCard key={app.id} app={app} context="history" barberId={barberData?.id} />)}
                          </div>
                    </TabsContent>
                    <TabsContent value="no-show">
                          <div className="space-y-4">
                              {filteredHistory.map(app => <AppointmentCard key={app.id} app={app} context="history" barberId={barberData?.id} />)}
                          </div>
                    </TabsContent>
                  </Tabs>
                ) : (
                  <p className="text-muted-foreground text-center py-8">Nenhum agendamento no histórico.</p>
                )}
              </CardContent>
           </Card>

        </div>
        
        <div className="h-fit sticky top-8">
          <Card className="bg-card border-border shadow-lg">
            <CardHeader>
              <CardTitle>Seu Perfil</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-bold text-primary">Endereço</h3>
                <p className="text-muted-foreground">{barberData.address?.fullAddress || 'Não informado'}</p>
              </div>
              <div>
                <h3 className="font-bold text-primary">Serviços</h3>
                {Array.isArray(barberData.services) && barberData.services.map(service => (
                    <p key={service.id} className="text-muted-foreground">{service.name}: R$ {service.price.toFixed(2)}</p>
                ))}
              </div>
              <div>
                <h3 className="font-bold text-primary">Horários</h3>
                <ul className="text-sm space-y-1 text-muted-foreground">
                  {barberData.availability && Object.entries(barberData.availability).map(([day, data]) => (
                    data.active && <li key={day} className="flex justify-between"><span>{day}:</span> <span>{data.start} - {data.end}</span></li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function DashboardSkeleton() {
    return (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    <Card className="bg-card border-border shadow-lg p-6">
                        <Skeleton className="h-8 w-1/2 mb-4 bg-muted" />
                        <div className="space-y-4">
                            <Skeleton className="h-24 w-full bg-muted" />
                            <Skeleton className="h-24 w-full bg-muted" />
                        </div>
                    </Card>
                     <Card className="bg-card border-border shadow-lg p-6">
                        <Skeleton className="h-8 w-1/2 mb-4 bg-muted" />
                        <div className="space-y-4">
                            <Skeleton className="h-24 w-full bg-muted" />
                        </div>
                    </Card>
                </div>
                <div className="bg-card rounded-2xl shadow-lg p-6 h-fit">
                    <Skeleton className="h-8 w-1/3 mb-4 bg-muted" />
                    <div className="space-y-4">
                        <Skeleton className="h-6 w-1/4 bg-muted" />
                        <Skeleton className="h-10 w-full bg-muted" />
                        <Skeleton className="h-6 w-1/4 bg-muted" />
                        <Skeleton className="h-10 w-full bg-muted" />
                    </div>
                </div>
            </div>
        </>
    )
}
