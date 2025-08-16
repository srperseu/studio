
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { getDocs, doc, collection, query, orderBy } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth.tsx';
import { generateReminderAction, cancelAppointmentAction } from '@/app/actions';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Icons } from './icons';
import type { Barber, Appointment } from '@/lib/types';
import { db } from '@/lib/firebase';
import { getDoc } from 'firebase/firestore';
import { cn } from '@/lib/utils';


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

  useEffect(() => {
    if (user) {
      const fetchData = async () => {
        setIsLoading(true);
        try {
          const barberRef = doc(db, 'barbers', user.uid);
          const barberSnap = await getDoc(barberRef);
          if (barberSnap.exists()) {
            setBarberData({ id: barberSnap.id, ...barberSnap.data() } as Barber);
          }

          const q = query(collection(db, `barbers/${user.uid}/appointments`), orderBy('date', 'desc'));
          const appointmentsSnapshot = await getDocs(q);
          const newAppointments: Appointment[] = [];
          appointmentsSnapshot.forEach((doc) => newAppointments.push({ id: doc.id, ...doc.data() } as Appointment));
          setAppointments(newAppointments);

        } catch (error) {
            console.error("Error fetching dashboard data:", error);
            toast({ title: 'Erro', description: 'Não foi possível carregar os dados do painel.', variant: 'destructive' });
        } finally {
            setIsLoading(false);
        }
      };
      fetchData();
    }
  }, [user, toast]);

  const handleGenerateReminder = async (appointment: Appointment) => {
    if (!barberData) return;
    setIsUpdating(appointment.id);
    
    const reminderDetails = {
      clientName: appointment.clientName,
      service: appointment.service,
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
  
  const handleCancelAppointment = async (appointmentId: string) => {
    if (!barberData) return;
    setIsUpdating(appointmentId);
    const result = await cancelAppointmentAction(barberData.id, appointmentId);
    if (result.success) {
      toast({ description: 'Agendamento cancelado com sucesso.' });
      // The revalidation should handle the UI update
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

  if (authLoading || isLoading) {
    return <DashboardSkeleton />;
  }
  
  if (!barberData) {
      return <div>Erro ao carregar dados do barbeiro.</div>
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
        <div className="lg:col-span-2">
          <Card className="bg-card border-border shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Icons.Bell /> Próximos Agendamentos</CardTitle>
            </CardHeader>
            <CardContent>
              {appointments.length > 0 ? (
                <div className="space-y-4">
                  {appointments.map(app => {
                    const isCancelled = app.status === 'cancelled';
                    return (
                      <div key={app.id} className={cn(
                        "bg-muted/70 p-4 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-4 border-l-4",
                        isCancelled ? 'border-muted-foreground/50' : 'border-primary',
                        isCancelled && 'opacity-60'
                      )}>
                        <div className="flex-grow">
                          <p className="font-bold text-lg text-primary">{app.clientName}</p>
                          <p className="text-muted-foreground">{app.service}</p>
                          <p className="font-semibold">{new Date(app.date + 'T12:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'long', day: '2-digit', month: 'long' })} às {app.time}</p>
                          {isCancelled && <Badge variant="destructive" className="mt-2 bg-muted-foreground">Cancelado</Badge>}
                        </div>
                        {!isCancelled && (
                          <div className="flex flex-col sm:items-end gap-2">
                            <Badge variant='default' className={app.type === 'atHome' ? 'bg-accent hover:bg-accent/80' : 'bg-primary/90'}>{app.type === 'inShop' ? 'Na Barbearia' : 'Em Domicílio'}</Badge>
                            <div className="flex gap-2">
                                <Button size="sm" onClick={() => handleGenerateReminder(app)} disabled={isUpdating === app.id} className="bg-accent hover:bg-accent/90">
                                {isUpdating === app.id ? <Icons.Spinner /> : <Icons.Sparkles className="mr-2 h-4 w-4" />}
                                Lembrete
                                </Button>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button size="sm" variant="destructive" disabled={isUpdating === app.id}>
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
                                            <AlertDialogAction onClick={() => handleCancelAppointment(app.id)}>
                                                {isUpdating === app.id ? <Icons.Spinner /> : "Confirmar Cancelamento"}
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">Nenhum agendamento encontrado.</p>
              )}
            </CardContent>
          </Card>
        </div>
        
        <div className="h-fit">
          <Card className="bg-card border-border shadow-lg">
            <CardHeader>
              <CardTitle>Seu Perfil</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-bold text-primary">Endereço</h3>
                <p className="text-muted-foreground">{barberData.address || 'Não informado'}</p>
              </div>
              <div>
                <h3 className="font-bold text-primary">Serviços</h3>
                {barberData.services?.inShop?.active && <p className="text-muted-foreground">Na Barbearia: R$ {barberData.services.inShop.price}</p>}
                {barberData.services?.atHome?.active && <p className="text-muted-foreground">Em Domicílio: R$ {barberData.services.atHome.price}</p>}
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
                <div className="lg:col-span-2 bg-card rounded-2xl shadow-lg p-6">
                    <Skeleton className="h-8 w-1/2 mb-4 bg-muted" />
                    <div className="space-y-4">
                        <Skeleton className="h-24 w-full bg-muted" />
                        <Skeleton className="h-24 w-full bg-muted" />
                        <Skeleton className="h-24 w-full bg-muted" />
                    </div>
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
