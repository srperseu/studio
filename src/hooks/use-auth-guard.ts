
'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './use-auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Barber, Client } from '@/lib/types';

type Role = 'barber' | 'client' | 'any';

export const useAuthGuard = (role: Role = 'any') => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.replace('/');
      return;
    }

    if (!user.emailVerified) {
        if(pathname !== '/') {
            router.replace('/');
        }
        return;
    }

    const checkRoleAndProfile = async () => {
        const barberRef = doc(db, 'barbers', user.uid);
        const clientRef = doc(db, 'clients', user.uid);

        const [barberSnap, clientSnap] = await Promise.all([
            getDoc(barberRef),
            getDoc(clientRef),
        ]);
        
        const isBarber = barberSnap.exists();
        const isClient = clientSnap.exists();

        // If user document doesn't exist in either collection, they need to be directed to signup selection.
        if (!isBarber && !isClient) {
            // Allow access only to the main signup page, not sub-pages.
            if (pathname !== '/signup') {
                router.replace('/signup');
            }
            return;
        }

        if (isBarber) {
            const barberData = barberSnap.data() as Barber;
            if (!barberData.profileComplete && pathname !== '/profile-setup') {
                // Force barber to setup profile if not complete.
                router.replace('/profile-setup');
            } else if (role === 'client') {
                // If a barber tries to access a client-only page, redirect to their dashboard.
                router.replace('/dashboard'); 
            } else if (barberData.profileComplete && (pathname === '/' || pathname === '/signup')) {
                // If a fully setup barber is on login/signup, redirect to their dashboard.
                router.replace('/dashboard');
            }
        } else if (isClient) {
            const clientData = clientSnap.data() as Client;
            if (!clientData.profileComplete && pathname !== '/profile-setup/client') {
                // Force client to setup profile if not complete.
                router.replace('/profile-setup/client');
            } else if (role === 'barber') {
                // If a client tries to access a barber-only page, redirect to their dashboard.
                router.replace('/dashboard/client'); 
            } else if (clientData.profileComplete && (pathname === '/' || pathname === '/signup')) {
                 // If a fully setup client is on login/signup, redirect to their dashboard.
                router.replace('/dashboard/client');
            }
        }
    };
    
    checkRoleAndProfile();

  }, [user, loading, router, role, pathname]);

  return { user, loading };
};
