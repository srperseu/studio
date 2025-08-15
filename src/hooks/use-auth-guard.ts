'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './use-auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export const useAuthGuard = (role: 'barber' | 'client' | 'any' = 'any') => {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/login');
      return;
    }

    if (role !== 'any') {
        const checkRole = async () => {
            const barberRef = doc(db, 'barbers', user.uid);
            const clientRef = doc(db, 'clients', user.uid);

            const [barberSnap, clientSnap] = await Promise.all([
                getDoc(barberRef),
                getDoc(clientRef),
            ]);
            
            const isBarber = barberSnap.exists();
            const isClient = clientSnap.exists();

            if (role === 'barber' && !isBarber) {
                router.replace('/'); // Not a barber, redirect to home
            } else if (role === 'client' && !isClient) {
                router.replace('/dashboard'); // Not a client, redirect to barber dash
            }
        };
        checkRole();
    }
  }, [user, loading, router, role]);

  return { user, loading };
};
