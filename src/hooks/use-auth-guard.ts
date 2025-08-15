
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

    // If user is not logged in, redirect to home/login page.
    if (!user) {
      if (pathname !== '/') {
        router.replace('/');
      }
      return;
    }

    // If user's email is not verified, keep them on the login page to see verification message.
    if (!user.emailVerified) {
        if(pathname !== '/') {
            router.replace('/');
        }
        return;
    }

    // Allow access to profile setup pages without interference
    if (pathname === '/profile-setup' || pathname === '/profile-setup/client') {
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

        if (!isBarber && !isClient) {
            if (pathname !== '/signup') {
                router.replace('/signup');
            }
            return;
        }

        if (isBarber) {
            const barberData = barberSnap.data() as Barber;
            if (!barberData.profileComplete && pathname !== '/profile-setup') {
                router.replace('/profile-setup');
            } else if (role === 'client') {
                router.replace('/dashboard'); 
            } else if (barberData.profileComplete && (pathname === '/' || pathname === '/signup')) {
                router.replace('/dashboard');
            }
        } else if (isClient) {
            const clientData = clientSnap.data() as Client;
             if (!clientData.profileComplete && pathname !== '/profile-setup/client') {
                router.replace('/profile-setup/client');
            } else if (role === 'barber') {
                router.replace('/dashboard/client'); 
            } else if (clientData.profileComplete && (pathname === '/' || pathname === '/signup')) {
                router.replace('/dashboard/client');
            }
        }
    };
    
    checkRoleAndProfile();

  }, [user, loading, router, role, pathname]);

  return { user, loading };
};
