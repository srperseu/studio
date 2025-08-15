import { DashboardClient } from "@/components/dashboard-client";
import { Skeleton } from "@/components/ui/skeleton";

export default function BarberDashboard() {
  // A autenticação agora é tratada principalmente pelo AuthHandler e pelo DashboardClient.
  // Se chegarmos aqui, o usuário está logado e o componente cliente cuidará da lógica.
  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <DashboardClient />
      </div>
    </div>
  );
}
