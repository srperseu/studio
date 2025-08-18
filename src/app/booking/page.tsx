
'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Barber, Client } from '@/lib/types';
import { BookingForm } from '@/components/booking-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuthGuard } from '@/hooks/use-auth-guard';
import { Icons } from '@/components/icons';
import { useAuth } from '@/hooks/use-auth';

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

  useEffect(() => {
    async function fetchAndSortBarbers() {
      if (!user) return;
      setIsLoading(true);

      // 1. Fetch client data to get their coordinates
      let clientCoords = null;
      const clientRef = doc(db, 'clients', user.uid);
      const clientSnap = await getDoc(clientRef);
      if (clientSnap.exists()) {
        const clientData = clientSnap.data() as Client;
        if (clientData.coordinates) {
          clientCoords = clientData.coordinates;
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
      if (clientCoords) {
        barbersList.forEach(barber => {
          if (barber.coordinates) {
            barber.distance = getDistance(clientCoords!.lat, clientCoords!.lng, barber.coordinates.lat, barber.coordinates.lng);
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

  return (
    <main className="min-h-screen bg-background p-4 sm:p-8 font-body text-foreground">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold font-headline text-primary">BarberFlow</h1>
          <p className="text-muted-foreground mt-2">Agende um Horário com os Melhores Barbeiros</p>
        </div>

        {barbers.length === 0 ? (
          <Card className="w-full max-w-md mx-auto bg-card">
            <CardHeader>
              <CardTitle className="text-center">Nenhum Barbeiro Disponível</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center">
                Volte mais tarde ou peça para um barbeiro se cadastrar na plataforma.
              </p>
            </CardContent>
          </Card>
        ) : (
          <BookingForm barbers={barbers} />
        )}
      </div>
    </main>
  );
}
