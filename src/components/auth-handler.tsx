'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { Icons } from '@/components/icons';

const protectedRoutes = ['/dashboard', '/profile-setup'];
const authRoutes = ['/login', '/signup'];

export function AuthHandler({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      const isProtectedRoute = protectedRoutes.some(route => pathname.startsWith(route));
      const isAuthRoute = authRoutes.some(route => pathname.startsWith(route));

      if (!user) {
        // Not logged in
        if (isProtectedRoute) {
          router.replace('/login');
        } else {
          setLoading(false);
        }
        return;
      }

      // User is logged in
      try {
        const userDocRef = doc(db, 'barbers', user.uid);
        const userDoc = await getDoc(userDocRef);
        const profileComplete = userDoc.exists() && userDoc.data().profileComplete;

        if (profileComplete) {
          // Profile is complete, can access dashboard. Redirect from auth routes.
          if (isAuthRoute) {
            router.replace('/dashboard');
          } else {
            setLoading(false);
          }
        } else {
          // Profile is not complete, must go to setup.
          if (pathname !== '/profile-setup') {
            router.replace('/profile-setup');
          } else {
            setLoading(false);
          }
        }
      } catch (error) {
        console.error("Error fetching user document:", error);
        await auth.signOut();
        router.replace('/login');
      }
    });

    return () => unsubscribe();
  }, [pathname, router]);

  if (loading) {
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
