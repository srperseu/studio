
'use client';

import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, orderBy, doc, getDoc, collectionGroup } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import type { Appointment, Barber } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icons } from './icons';
import { Skeleton } from './ui/skeleton';
import { Badge } from './ui/badge';
import Link from 'next/link';
import { Button } from './ui/button';

interface AppointmentWithBarber extends Appointment {
  barber: Barber | null;
}

export function ClientDashboard() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<AppointmentWithBarber[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      const fetchAppointments = async () => {
        setIsLoading(true);
        try {
          // This query previously required a composite index. 
          // The orderBy clause was removed to simplify the query and avoid the index requirement.
          const appointmentsQuery = query(
            collectionGroup(db, 'appointments'),
            where('clientUid', '==', user.uid)
          );

          const querySnapshot = await getDocs(appointmentsQuery);
          const appointmentsData: AppointmentWithBarber[] = [];
          
          // Use Promise.all to fetch barber data in parallel for better performance
          const barberPromises = querySnapshot.docs.map(async (appointmentDoc) => {
            const appointment = { id: appointmentDoc.id, ...appointmentDoc.data() } as Appointment;
            const barberId = appointmentDoc.ref.parent.parent?.id;
            let barberData: Barber | null = null;
            
            if(barberId) {
                const barberRef = doc(db, 'barbers', barberId);
                const barberSnap = await getDoc(barberRef);
                if(barberSnap.exists()) {
                    barberData = { id: barberSnap.id, ...barberSnap.data() } as Barber;
                }
            }
            return { ...appointment, barber: barberData };
          });

          const resolvedAppointments = await Promise.all(barberPromises);
          // Sort appointments client-side after fetching
          resolvedAppointments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setAppointments(resolvedAppointments);

        } catch (error) {
          console.error("Error fetching client appointments: ", error);
        } finally {
          setIsLoading(false);
        }
      };

      fetchAppointments();
    }
  }, [user]);

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
            {appointments.map(app => (
                <Card key={app.id} className="bg-card border-border shadow-lg flex flex-col">
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
                         <Badge variant={app.type === 'inShop' ? 'secondary' : 'default'} className={app.type === 'atHome' ? 'bg-accent hover:bg-accent/80' : ''}>
                            {app.type === 'inShop' ? 'Na Barbearia' : 'Em Domicílio'}
                        </Badge>
                    </CardContent>
                </Card>
            ))}
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
