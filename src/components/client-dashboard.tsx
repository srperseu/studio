
'use client';

import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import type { Appointment, Barber, Client, GeoPoint, Review } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Icons } from './icons';
import { Skeleton } from './ui/skeleton';
import { Badge } from './ui/badge';
import Link from 'next/link';
import { Button } from './ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { cancelAppointmentAction } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ReviewForm } from './review-form';


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
  const [clientData, setClientData] = useState<Client | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [reviewingAppointment, setReviewingAppointment] = useState<AppointmentWithBarber | null>(null);

  const [scheduledFilter, setScheduledFilter] = useState<'all' | 'inShop' | 'atHome'>('all');

  const fetchClientAndAppointments = async () => {
    if (user) {
      setIsLoading(true);
      try {
        // Fetch client data
        const clientRef = doc(db, 'clients', user.uid);
        const clientSnap = await getDoc(clientRef);
        if (clientSnap.exists()) {
          setClientData({ id: clientSnap.id, ...clientSnap.data() } as Client);
        }

        // Fetch barbers and appointments
        const allBarbers = await getAllBarbers();
        const allAppointments: AppointmentWithBarber[] = [];

        for (const barber of allBarbers) {
          const appointmentsQuery = query(
            collection(db, 'barbers', barber.id, 'appointments'),
            where('clientUid', '==', user.uid),
            where('status', 'in', ['scheduled', 'completed'])
          );

          const appointmentsSnapshot = await getDocs(appointmentsQuery);
          appointmentsSnapshot.forEach(doc => {
            allAppointments.push({
              ...(doc.data() as Appointment),
              id: doc.id,
              barberId: barber.id,
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
    fetchClientAndAppointments();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const { scheduledAppointments, pendingReviewAppointments } = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const scheduled = appointments.filter(app => {
      const appDate = new Date(app.date + 'T00:00:00');
      return app.status === 'scheduled' && appDate >= today;
    });

    const pendingReview = appointments.filter(app => {
      return app.status === 'completed' && !app.reviewed;
    });

    return { scheduledAppointments: scheduled, pendingReviewAppointments: pendingReview };
  }, [appointments]);

  const filteredScheduled = useMemo(() => {
    if (scheduledFilter === 'all') return scheduledAppointments;
    return scheduledAppointments.filter(app => app.type === scheduledFilter);
  }, [scheduledAppointments, scheduledFilter]);


  const handleCancelAppointment = async (appointment: AppointmentWithBarber) => {
    if (!appointment.barberId) return;
    setIsUpdating(appointment.id);
    const result = await cancelAppointmentAction(appointment.barberId, appointment.id);
    if (result.success) {
        toast({ description: 'Agendamento cancelado com sucesso.' });
        fetchClientAndAppointments(); // Re-fetch to update lists
    } else {
        toast({ title: 'Erro', description: result.message, variant: 'destructive' });
    }
    setIsUpdating(null);
  }
  
  const handleReviewSuccess = () => {
    setReviewingAppointment(null);
    fetchClientAndAppointments(); // Re-fetch to update lists
  }

  const BaseAppointmentCard = ({ app, children }: { app: AppointmentWithBarber, children?: React.ReactNode }) => {
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
                    <span>{app.type === 'inShop' ? (app.barber?.address?.fullAddress || 'Endereço não informado') : (app.clientFullAddress || 'Seu endereço') }</span>
                </div>
            </CardContent>
            {children && <CardFooter>{children}</CardFooter>}
        </Card>
    );
  }

  const AppointmentCard = ({ app }: { app: AppointmentWithBarber}) => {
    const today = new Date();
    today.setHours(0,0,0,0);
    const appDate = new Date(app.date + 'T00:00:00');
    const isPast = appDate < today;
    const isActionable = app.status === 'scheduled' && !isPast;
    
    const handleRouteClick = () => {
        if (!app.barber?.coordinates) {
          toast({ title: 'Erro de Rota', description: 'O endereço do barbeiro não foi encontrado.', variant: 'destructive' });
          return;
        }
        let origin = '';
        if (clientData?.coordinates) {
          origin = `${clientData.coordinates.lat},${clientData.coordinates.lng}`;
        }
        
        const destination = `${app.barber.coordinates.lat},${app.barber.coordinates.lng}`;
        const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}`;
        window.open(url, '_blank');
      };

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
                    <span>{app.type === 'inShop' ? (app.barber?.address?.fullAddress || 'Endereço não informado') : (app.clientFullAddress || 'Seu endereço') }</span>
                </div>
                 <div className='flex items-center gap-2 pt-2'>
                    {app.type === 'inShop' ? (
                        <Badge variant='default'>
                            <Icons.Scissors className="mr-1 h-3 w-3"/>
                            Na Barbearia
                        </Badge>
                    ) : (
                        <Badge variant='outline' className="bg-transparent hover:bg-muted">
                            <Icons.Home className="mr-1 h-3 w-3"/>
                            Em Domicílio
                        </Badge>
                    )}
                    {app.type === 'inShop' && (
                        <Button variant="outline" size="sm" className="h-auto py-0.5 px-2 text-xs hover:bg-muted hover:text-muted-foreground" onClick={handleRouteClick}>
                           <Icons.MapPin className="mr-1 h-3 w-3"/>
                           Ver Rota
                        </Button>
                    )}
                </div>
            </CardContent>
            {isActionable && (
                <CardFooter>
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
                </CardFooter>
            )}
        </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-8 mt-8">
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
      </div>
    );
  }

  return (
    <>
      {reviewingAppointment && (
          <ReviewForm
              isOpen={!!reviewingAppointment}
              onClose={() => setReviewingAppointment(null)}
              appointment={reviewingAppointment}
              onSubmitSuccess={handleReviewSuccess}
          />
      )}
     <div className="space-y-8 mt-8">
        <div className="flex justify-end">
            <Link href="/booking">
                <Button>
                    <Icons.Calendar className="mr-2"/>
                    Fazer Novo Agendamento
                </Button>
            </Link>
        </div>

        {pendingReviewAppointments.length > 0 && (
          <Card className="bg-card border-border shadow-lg border-l-4 border-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <Icons.Star className="fill-current" />
                Avaliações Pendentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pendingReviewAppointments.map(app => (
                  <BaseAppointmentCard key={app.id} app={app}>
                    <Button variant="destructive" onClick={() => setReviewingAppointment(app)} className="w-full">
                        <Icons.Star className="mr-2 h-4 w-4"/>
                        Avaliar Serviço
                    </Button>
                  </BaseAppointmentCard>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        
        <Card className="bg-card border-border shadow-lg">
          <CardHeader>
              <CardTitle>Próximos Agendamentos</CardTitle>
          </CardHeader>
          <CardContent>
            {scheduledAppointments.length === 0 ? (
                <div className="text-center py-16">
                    <Icons.Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
                    <p className="mt-4 text-muted-foreground">Você não tem próximos agendamentos.</p>
                </div>
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
                            {filteredScheduled.filter(a => a.type === 'inShop').map(app => <AppointmentCard key={app.id} app={app} />)}
                        </div>
                    </TabsContent>
                    <TabsContent value="atHome">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredScheduled.filter(a => a.type === 'atHome').map(app => <AppointmentCard key={app.id} app={app} />)}
                        </div>
                    </TabsContent>
                </Tabs>
            )}
          </CardContent>
        </Card>
     </div>
     </>
  );
}
