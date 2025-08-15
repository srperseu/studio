'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, AuthProvider } from '@/hooks/use-auth.tsx';
import { Icons } from '@/components/icons';

const protectedRoutes = ['/dashboard', '/profile-setup'];
const authRoutes = ['/login', '/signup'];

function AuthChecker({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) {
      return;
    }

    const isProtectedRoute = protectedRoutes.includes(pathname);

    // If user is not logged in and tries to access a protected route, redirect to login
    if (!user && isProtectedRoute) {
      router.replace('/login');
      return;
    }

    // If user is logged in and tries to access an auth route, redirect to dashboard
    if (user && authRoutes.includes(pathname)) {
        router.replace('/dashboard');
        return;
    }

  }, [user, loading, pathname, router]);

  // Show a loader while Firebase is checking auth state, especially on protected routes
  if (loading && protectedRoutes.includes(pathname)) {
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
