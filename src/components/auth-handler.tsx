'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth, AuthProvider } from '@/hooks/use-auth.tsx';
import { db } from '@/lib/firebase';
import { Icons } from '@/components/icons';

const protectedRoutes = ['/dashboard', '/profile-setup'];
const authRoutes = ['/login', '/signup'];

function AuthChecker({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);

  useEffect(() => {
    if (loading) {
      return;
    }

    const isAuthRoute = authRoutes.includes(pathname);
    const isProtectedRoute = protectedRoutes.includes(pathname);

    if (!user) {
      setIsCheckingProfile(false);
      if (isProtectedRoute) {
        router.replace('/login');
      }
      return;
    }

    // User is logged in
    const checkProfile = async () => {
      try {
        const userDocRef = doc(db, 'barbers', user.uid);
        const userDoc = await getDoc(userDocRef);
        const profileComplete = userDoc.exists() && userDoc.data().profileComplete;

        if (isAuthRoute) {
            router.replace(profileComplete ? '/dashboard' : '/profile-setup');
        } else if (isProtectedRoute) {
            if (!profileComplete && pathname !== '/profile-setup') {
                router.replace('/profile-setup');
            } else if (profileComplete && pathname === '/profile-setup') {
                router.replace('/dashboard');
            }
        }
      } catch (error) {
        console.error("Error fetching user document:", error);
        router.replace('/login'); // Fallback on error
      } finally {
        setIsCheckingProfile(false);
      }
    };

    checkProfile();

  }, [user, loading, pathname, router]);

  if (loading || (protectedRoutes.includes(pathname) && isCheckingProfile)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-4">
          <Icons.Spinner className="h-8 w-8" />
          <h1 className="text-2xl font-headline">Carregando a Barbearia Digital...</h1>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function AuthHandler({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <AuthChecker>{children}</AuthChecker>
        </AuthProvider>
    )
}