
'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useState, useEffect } from 'react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from './ui/button';
import { Icons } from './icons';
import { Skeleton } from './ui/skeleton';

export function UserNav() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [userRole, setUserRole] = useState<'barber' | 'client' | null>(null);

  useEffect(() => {
    const fetchUserRole = async () => {
      if (user) {
        const barberRef = doc(db, 'barbers', user.uid);
        const clientRef = doc(db, 'clients', user.uid);
        const [barberSnap, clientSnap] = await Promise.all([getDoc(barberRef), getDoc(clientRef)]);
        if (barberSnap.exists()) {
          setUserRole('barber');
        } else if (clientSnap.exists()) {
          setUserRole('client');
        }
      }
    };
    fetchUserRole();
  }, [user]);

  const handleLogout = async () => {
    try {
      await signOut();
      toast({ description: 'Você saiu da sua conta.' });
      router.push('/');
    } catch (error: any) {
      toast({ description: 'Falha ao sair da conta.', variant: 'destructive' });
    }
  };

  if (loading) {
    return <Skeleton className="h-10 w-10 rounded-full" />;
  }
  
  if (!user) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
            {user?.photoURL ? (
                <Image
                    src={user.photoURL}
                    alt={user.displayName || 'Avatar do usuário'}
                    fill
                    className="rounded-full object-cover"
                />
            ) : (
                <Icons.CircleUserRound className="h-10 w-10" />
            )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user?.displayName || 'Usuário'}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user?.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {userRole === 'barber' && (
            <>
              <DropdownMenuItem onSelect={() => router.push('/dashboard')}>
                <Icons.Calendar className="mr-2" />
                <span>Minha Agenda</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => router.push('/dashboard/history')}>
                <Icons.Clock className="mr-2" />
                <span>Histórico</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => router.push('/profile-setup')}>
                <Icons.User className="mr-2" />
                <span>Meu Perfil</span>
              </DropdownMenuItem>
            </>
          )}
           {userRole === 'client' && (
            <>
              <DropdownMenuItem onSelect={() => router.push('/dashboard/client')}>
                <Icons.Calendar className="mr-2" />
                <span>Meus Agendamentos</span>
              </DropdownMenuItem>
               <DropdownMenuItem onSelect={() => router.push('/dashboard/client/history')}>
                <Icons.Clock className="mr-2" />
                <span>Histórico</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => router.push('/profile-setup/client')}>
                <Icons.User className="mr-2" />
                <span>Meu Perfil</span>
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleLogout}>
          <Icons.LogOut className="mr-2" />
          <span>Sair</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
