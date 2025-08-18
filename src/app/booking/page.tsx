
'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Barber, Client, GeoPoint } from '@/lib/types';
import { BookingForm } from '@/components/booking-form';
import { BarberCard } from '@/components/barber-card';
import { BarbersMap, type MapLocation } from '@/components/barbers-map';
import { useAuthGuard } from '@/hooks/use-auth-guard';
import { Icons } from '@/components/icons';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { UserNav } from '@/components/user-nav';
import Link from 'next/link';
import { Header } from '@/components/header';

// Haversine formula to calculate distance between two lat/lng points
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

interface BarberWithDistance extends Barber {
    distance?: number;
}


export default function ClientBookingPage() {
  const { user, loading: authLoading } = useAuth();
  const { status } = useAuthGuard('client');
  
  const [barbers, setBarbers] = useState<BarberWithDistance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBarber, setSelectedBarber] = useState<BarberWithDistance | null>(null);
  const [clientCoords, setClientCoords] = useState<GeoPoint | null>(null);

  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';


  useEffect(() => {
    async function fetchAndSortBarbers() {
      if (!user) return;
      setIsLoading(true);

      // 1. Fetch client data to get their coordinates
      let clientLocation = null;
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
      querySnapshot.forEach((doc) => {
        barbersList.push({ id: doc.id, ...doc.data() } as Barber);
      });

      // 3. Calculate distance if client coordinates are available
      if (clientLocation) {
        barbersList.forEach(barber => {
          if (barber.coordinates) {
            barber.distance = getDistance(clientLocation!.lat, clientLocation!.lng, barber.coordinates.lat, barber.coordinates.lng);
          }
        });
        
        // 4. Sort barbers by distance
        barbersList.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
      }

      setBarbers(barbersList);
      setIsLoading(false);
    }
    
    if (status === 'valid') {
        fetchAndSortBarbers();
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

  const mapLocations: MapLocation[] = barbers
  .filter(barber => barber.coordinates)
  .map(barber => ({
      id: barber.id,
      position: barber.coordinates!,
      label: barber.fullName,
      type: 'barber'
  }));

  if (clientCoords) {
      mapLocations.push({
          id: 'client',
          position: clientCoords,
          label: 'Sua Localização',
          type: 'client'
      })
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
              <BookingForm barber={selectedBarber} />
            </>
        ) : (
          <>
            <PageHeader />
            <div className="h-80 md:h-96 rounded-lg overflow-hidden my-8 border shadow-lg">
                <BarbersMap apiKey={mapsApiKey} locations={mapLocations} center={clientCoords} zoom={13} />
            </div>

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
          </>
        )}
      </div>
    </main>
  );
}

