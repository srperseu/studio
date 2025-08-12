import { Suspense } from "react";
import { DashboardClient } from "@/components/dashboard-client";
import { Skeleton } from "@/components/ui/skeleton";

export default async function BarberDashboard() {
    // This is a server component, auth is handled by AuthHandler and DashboardClient.
    // If we reach here, we assume user is logged in. 
    // The client component will handle the actual user logic.

    return (
        <div className="min-h-screen bg-background text-foreground p-4 sm:p-8">
            <div className="max-w-7xl mx-auto">
                <Suspense fallback={<DashboardSkeleton />}>
                    <DashboardLoader />
                </Suspense>
            </div>
        </div>
    );
}

async function DashboardLoader() {
    // This is a placeholder for where you'd get the UID on the server.
    // Since we're client-side redirecting, we'll let the client component fetch with its own UID.
    return <DashboardClient />;
}

function DashboardSkeleton() {
    return (
        <>
            <header className="flex flex-col sm:flex-row justify-between items-center mb-8">
                <Skeleton className="h-9 w-64 bg-card" />
                <div className="flex items-center gap-4 mt-4 sm:mt-0">
                    <Skeleton className="h-9 w-48 bg-card" />
                    <Skeleton className="h-9 w-24 bg-card" />
                    <Skeleton className="h-9 w-24 bg-card" />
                </div>
            </header>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-card rounded-2xl shadow-lg p-6">
                    <Skeleton className="h-8 w-1/2 mb-4 bg-muted" />
                    <div className="space-y-4">
                        <Skeleton className="h-24 w-full bg-muted" />
                        <Skeleton className="h-24 w-full bg-muted" />
                        <Skeleton className="h-24 w-full bg-muted" />
                    </div>
                </div>
                <div className="bg-card rounded-2xl shadow-lg p-6 h-fit">
                    <Skeleton className="h-8 w-1/3 mb-4 bg-muted" />
                    <div className="space-y-4">
                        <Skeleton className="h-6 w-1/4 bg-muted" />
                        <Skeleton className="h-10 w-full bg-muted" />
                        <Skeleton className="h-6 w-1/4 bg-muted" />
                        <Skeleton className="h-10 w-full bg-muted" />
                    </div>
                </div>
            </div>
        </>
    )
}
