'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { onSnapshot, doc, collection, query, orderBy } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { signOutUser, generateReminderAction } from '@/app/actions';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Icons } from './icons';
import type { Barber, Appointment } from '@/lib/types';
import { db } from '@/lib/firebase';

export function DashboardClient() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [barberData, setBarberData] = useState<Barber | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalContent, setModalContent] = useState({ title: '', body: '' });
  const [isGeneratingReminder, setIsGeneratingReminder] = useState<string | null>(null);
  const appointmentsRef = useRef<Appointment[]>([]);

  useEffect(() => {
    if (user) {
      const unsubProfile = onSnapshot(doc(db, 'barbers', user.uid), (doc) => {
        if (doc.exists()) {
          setBarberData({ id: doc.id, ...doc.data() } as Barber);
        }
        setIsLoading(false);
      });

      const q = query(collection(db, `barbers/${user.uid}/appointments`), orderBy('date', 'asc'));
      const unsubAppointments = onSnapshot(q, (querySnapshot) => {
        const newAppointments: Appointment[] = [];
        querySnapshot.forEach((doc) => newAppointments.push({ id: doc.id, ...doc.data() } as Appointment));
        
        if (appointmentsRef.current.length > 0 && newAppointments.length > appointmentsRef.current.length) {
            const latest = newAppointments.sort((a,b) => b.createdAt.toMillis() - a.createdAt.toMillis())[0];
            toast({
                title: "Novo Agendamento!",
                description: `Novo agendamento de ${latest.clientName}!`,
            });
        }
        setAppointments(newAppointments);
        appointmentsRef.current = newAppointments;
      });

      return () => {
        unsubProfile();
        unsubAppointments();
      };
    }
  }, [user, toast]);

  const handleGenerateReminder = async (appointment: Appointment) => {
    if (!barberData) return;
    setIsGeneratingReminder(appointment.id);
    const result = await generateReminderAction(appointment, barberData.fullName);
    if (result.success && result.reminderText) {
      setModalContent({ title: 'Lembrete de Agendamento', body: result.reminderText });
      setIsModalOpen(true);
    } else {
      toast({ title: 'Erro', description: result.message, variant: 'destructive' });
    }
    setIsGeneratingReminder(null);
  };
  
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

  const handleLogout = async () => {
    const result = await signOutUser();
    if (result.success) {
      toast({ description: result.message });
      router.push('/login');
    } else {
      toast({ description: result.message, variant: 'destructive' });
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
      
      <header className="flex flex-col sm:flex-row justify-between items-center mb-8">
        <h1 className="text-3xl font-bold font-headline">Painel do Barbeiro</h1>
        <div className="flex items-center gap-4 mt-4 sm:mt-0">
          <span className="text-muted-foreground hidden md:block">Olá, {barberData.fullName}</span>
          <Button variant="outline" onClick={() => router.push('/profile-setup')}>Editar Perfil</Button>
          <Button variant="destructive" onClick={handleLogout}><Icons.LogOut className="mr-2 h-4 w-4" /> Sair</Button>
        </div>
      </header>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card className="bg-card border-border shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Icons.Bell /> Próximos Agendamentos</CardTitle>
            </CardHeader>
            <CardContent>
              {appointments.length > 0 ? (
                <div className="space-y-4">
                  {appointments.map(app => (
                    <div key={app.id} className="bg-muted/70 p-4 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-4">
                      <div className="flex-grow">
                        <p className="font-bold text-lg text-primary">{app.clientName}</p>
                        <p className="text-muted-foreground">{app.service}</p>
                        <p className="font-semibold">{new Date(app.date + 'T12:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'long', day: '2-digit', month: 'long' })} às {app.time}</p>
                      </div>
                      <div className="flex flex-col sm:items-end gap-2">
                         <Badge variant={app.type === 'inShop' ? 'secondary' : 'default'} className={app.type === 'atHome' ? 'bg-accent hover:bg-accent/80' : ''}>{app.type === 'inShop' ? 'Na Barbearia' : 'Em Domicílio'}</Badge>
                         <Button size="sm" onClick={() => handleGenerateReminder(app)} disabled={isGeneratingReminder === app.id} className="bg-accent hover:bg-accent/90">
                           {isGeneratingReminder === app.id ? <Icons.Spinner /> : <Icons.Sparkles className="mr-2 h-4 w-4" />}
                           Lembrete
                         </Button>
                      </div>
                    </div>
                  ))}
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
                  {Object.entries(barberData.availability || {}).map(([day, data]) => (
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
            <header className="flex flex-col sm:flex-row justify-between items-center mb-8">
                <Skeleton className="h-9 w-64 bg-card" />
                <div className="flex items-center gap-4 mt-4 sm:mt-0">
                    <Skeleton className="h-9 w-48 bg-card" />
                    <Skeleton className="h-9 w-24 bg-card" />
                    <Skeleton className="h-9 w-24 bg-card" />
                </div>
            </header>
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

    