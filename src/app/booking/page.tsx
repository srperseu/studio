
'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Barber, Client, GeoPoint } from '@/lib/types';
import { BookingForm } from '@/components/booking-form';
import { BarberCard } from '@/components/barber-card';
import { useAuthGuard } from '@/hooks/use-auth-guard';
import { Icons } from '@/components/icons';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { UserNav } from '@/components/user-nav';
import Link from 'next/link';
import { Header } from '@/components/header';
import { getTravelInfo } from '@/ai/flows/get-travel-info';

interface BarberWithDistance extends Barber {
    distanceText?: string;
    durationText?: string;
}


export default function ClientBookingPage() {
  const { user, loading: authLoading } = useAuth();
  const { status } = useAuthGuard('client');
  
  const [barbers, setBarbers] = useState<BarberWithDistance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBarber, setSelectedBarber] = useState<BarberWithDistance | null>(null);
  const [clientCoords, setClientCoords] = useState<GeoPoint | null>(null);


  useEffect(() => {
    async function fetchAndProcessBarbers() {
      if (!user) return;
      setIsLoading(true);

      // 1. Fetch client data to get their coordinates
      let clientLocation: GeoPoint | null = null;
      const clientRef = doc(db, 'clients', user.uid);
      const clientSnap = await getDoc(clientRef);
      if (clientSnap.exists()) {
        const clientData = clientSnap.data() as Client;
        if (clientData.coordinates) {
          clientLocation = clientData.coordinates;
          setClientCoords(clientData.coordinates);
        }
      }

      // 2. Fetch all barbers
      const q = query(collection(db, 'barbers'), where('profileComplete', '==', true));
      const querySnapshot = await getDocs(q);
      const barbersList: BarberWithDistance[] = [];
      const barberDestinations: {id: string, coords: GeoPoint}[] = [];
      
      querySnapshot.forEach((doc) => {
        const barberData = { id: doc.id, ...doc.data() } as Barber;
        barbersList.push(barberData);
        if (barberData.coordinates) {
            barberDestinations.push({id: barberData.id, coords: barberData.coordinates});
        }
      });
      
      // 3. Fetch travel info if client and barbers have coordinates
      if (clientLocation && barberDestinations.length > 0) {
        try {
            const travelInfos = await getTravelInfo({
                origin: clientLocation,
                destinations: barberDestinations.map(d => d.coords)
            });

            const barbersWithDistance = barbersList.map((barber, index) => {
                const destinationIndex = barberDestinations.findIndex(d => d.id === barber.id);
                if (destinationIndex !== -1 && travelInfos[destinationIndex]) {
                     return {
                        ...barber,
                        distanceText: travelInfos[destinationIndex].distance,
                        durationText: travelInfos[destinationIndex].duration,
                     }
                }
                return barber;
            });
            setBarbers(barbersWithDistance);

        } catch (error) {
            console.error("Failed to fetch travel info for barbers list:", error);
            // Fallback to original list if API fails
            setBarbers(barbersList);
        }

      } else {
        setBarbers(barbersList);
      }

      setIsLoading(false);
    }
    
    if (status === 'valid') {
        fetchAndProcessBarbers();
    } else if (!authLoading && status === 'invalid') {
        setIsLoading(false); // Stop loading if auth guard fails
    }

  }, [user, status, authLoading]);
  
  const handleSelectBarber = (barber: BarberWithDistance) => {
      setSelectedBarber(barber);
  }
  
  const handleBackToList = () => {
      setSelectedBarber(null);
  }

  if (authLoading || isLoading || status === 'validating') {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-4">
          <Icons.Spinner className="h-8 w-8" />
          <h1 className="text-2xl font-headline">Carregando Barbeiros...</h1>
        </div>
      </div>
    );
  }
  
  const PageHeader = () => (
     <div className="flex justify-between items-center mb-8">
        <div className="text-left">
            <h1 className="text-5xl font-bold font-headline text-primary">BarberFlow</h1>
            <p className="text-muted-foreground mt-2">Agende um Horário com os Melhores Barbeiros</p>
        </div>
        <div className="flex items-center gap-4">
           {user ? (
            <>
                <Link href="/dashboard/client">
                    <Button variant="outline">
                        Meus Agendamentos &rarr;
                    </Button>
                </Link>
                <UserNav />
            </>
            ) : (
                <Link href="/">
                    <Button variant="outline">
                        Login &rarr;
                    </Button>
                </Link>
            )}
        </div>
      </div>
  )

  return (
    <main className="min-h-screen bg-background p-4 sm:p-8 font-body text-foreground">
      <div className="max-w-7xl mx-auto">
        
        {selectedBarber ? (
            <>
              <Header title={`Agendar com ${selectedBarber.fullName}`} showBackButton onBackClick={handleBackToList}/>
              <BookingForm barber={selectedBarber} clientCoords={clientCoords} />
            </>
        ) : (
          <>
            <PageHeader />
            
            <div className="my-8">
                {barbers.length === 0 ? (
                    <div className="text-center py-16">
                        <Icons.Scissors className="mx-auto h-12 w-12 text-muted-foreground" />
                        <h2 className="mt-4 text-2xl font-semibold">Nenhum Barbeiro Disponível</h2>
                        <p className="text-muted-foreground mt-2">
                            Volte mais tarde ou peça para um barbeiro se cadastrar na plataforma.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {barbers.map(barber => (
                            <BarberCard key={barber.id} barber={barber} onSelect={handleSelectBarber} />
                        ))}
                    </div>
                )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
