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

        // Se não for nem barbeiro nem cliente (ex: Google Sign-In primeira vez)
        if (!isBarber && !isClient) {
            // Por padrão, pode-se redirecionar para a escolha de perfil ou um setup inicial.
            // Por enquanto, vamos redirecionar para a escolha de cadastro.
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
                router.replace('/dashboard'); // Um barbeiro tentou acessar uma rota de cliente
            }
        } else if (isClient) {
            const clientData = clientSnap.data() as Client;
            if (!clientData.profileComplete && pathname !== '/profile-setup/client') {
                router.replace('/profile-setup/client');
            } else if (role === 'barber') {
                router.replace('/booking'); // Um cliente tentou acessar uma rota de barbeiro
            }
        }
    };
    
    checkRoleAndProfile();

  }, [user, loading, router, role, pathname]);

  return { user, loading };
};
