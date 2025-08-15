'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth, AuthProvider } from '@/hooks/use-auth';
import { db } from '@/lib/firebase';
import { Icons } from '@/components/icons';

const protectedRoutes = ['/dashboard', '/profile-setup'];
const authRoutes = ['/login', '/signup'];

function AuthChecker({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return; // Wait for auth state to be confirmed

    const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
    const isAuthRoute = authRoutes.some(route => pathname.startsWith(route));

    if (!user) {
      // Not logged in
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

        if (profileComplete) {
          // Profile is complete, can access dashboard. Redirect from auth routes.
          if (isAuthRoute) {
            router.replace('/dashboard');
          }
        } else {
          // Profile is not complete, must go to setup.
          if (pathname !== '/profile-setup') {
            router.replace('/profile-setup');
          }
        }
      } catch (error) {
        console.error("Error fetching user document:", error);
        // Handle error appropriately, maybe sign out user
        router.replace('/login');
      }
    };

    checkProfile();

  }, [user, loading, pathname, router]);

  if (loading || (protectedRoutes.some(route => pathname.startsWith(route)) && !user)) {
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
