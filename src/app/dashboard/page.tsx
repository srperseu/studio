import { DashboardClient } from "@/components/dashboard-client";

export default function BarberDashboard() {
  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <DashboardClient />
      </div>
    </div>
  );
}
