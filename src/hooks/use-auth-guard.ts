
'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './use-auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Barber, Client } from '@/lib/types';

type Role = 'barber' | 'client' | 'any';
type AuthStatus = 'validating' | 'valid' | 'invalid';

export const useAuthGuard = (role: Role = 'any') => {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<AuthStatus>('validating');

  useEffect(() => {
    if (authLoading) {
      setStatus('validating');
      return;
    }

    if (!user) {
      if (pathname !== '/') {
        router.replace('/');
      }
      setStatus('invalid');
      return;
    }

    if (!user.emailVerified) {
        if(pathname !== '/') {
            router.replace('/');
        }
        setStatus('invalid');
        return;
    }

    if (pathname === '/profile-setup' || pathname === '/profile-setup/client') {
        setStatus('valid');
        return;
    }

    const checkRoleAndProfile = async () => {
        setStatus('validating');
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
            setStatus('invalid');
            return;
        }

        if (isBarber) {
            const barberData = barberSnap.data() as Barber;
            if (!barberData.profileComplete && pathname !== '/profile-setup') {
                router.replace('/profile-setup');
                setStatus('invalid');
            } else if (role === 'client') {
                router.replace('/dashboard'); 
                setStatus('invalid');
            } else if (barberData.profileComplete && (pathname === '/' || pathname === '/signup')) {
                router.replace('/dashboard');
                setStatus('invalid');
            } else {
                setStatus('valid');
            }
        } else if (isClient) {
            const clientData = clientSnap.data() as Client;
             if (!clientData.profileComplete && pathname !== '/profile-setup/client') {
                router.replace('/profile-setup/client');
                setStatus('invalid');
            } else if (role === 'barber') {
                router.replace('/dashboard/client'); 
                setStatus('invalid');
            } else if (clientData.profileComplete && (pathname === '/' || pathname === '/signup')) {
                router.replace('/dashboard/client');
                setStatus('invalid');
            } else {
                setStatus('valid');
            }
        }
    };
    
    checkRoleAndProfile();

  }, [user, authLoading, router, role, pathname]);

  return { user, loading: authLoading || status === 'validating', status };
};
