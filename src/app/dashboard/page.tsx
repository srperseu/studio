'use client';

import { useAuthGuard } from '@/hooks/use-auth-guard';
import { DashboardClient } from "@/components/dashboard-client";
import { Icons } from "@/components/icons";
import { Header } from '@/components/header';

export default function BarberDashboard() {
  const { user, loading } = useAuthGuard();

  if (loading || !user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-4">
          <Icons.Spinner className="h-8 w-8" />
          <h1 className="text-2xl font-headline">Carregando...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <Header title="Painel do Barbeiro" />
        <DashboardClient />
      </div>
    </div>
  );
}
