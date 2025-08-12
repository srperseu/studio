import { Suspense } from "react";
import { getDoc, doc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { DashboardClient } from "@/components/dashboard-client";
import { Skeleton } from "@/components/ui/skeleton";
import type { Barber } from "@/lib/types";
import { redirect } from "next/navigation";

async function getBarberData(uid: string): Promise<Barber | null> {
    const docRef = doc(db, 'barbers', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Barber;
    }
    return null;
}

export default async function BarberDashboard() {
    const user = auth.currentUser;
    // This is a server component, auth.currentUser is not reliable here.
    // A proper solution would involve passing session from middleware.
    // For this app, we will rely on client-side auth check which will redirect.
    // So if we reach here, we assume user is logged in. 
    // The client component will handle the actual user logic.

    return (
        <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-8">
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
                <Skeleton className="h-9 w-64 bg-gray-800" />
                <div className="flex items-center gap-4 mt-4 sm:mt-0">
                    <Skeleton className="h-9 w-48 bg-gray-800" />
                    <Skeleton className="h-9 w-24 bg-gray-800" />
                    <Skeleton className="h-9 w-24 bg-gray-800" />
                </div>
            </header>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-gray-800 rounded-2xl shadow-lg p-6">
                    <Skeleton className="h-8 w-1/2 mb-4 bg-gray-700" />
                    <div className="space-y-4">
                        <Skeleton className="h-24 w-full bg-gray-700" />
                        <Skeleton className="h-24 w-full bg-gray-700" />
                        <Skeleton className="h-24 w-full bg-gray-700" />
                    </div>
                </div>
                <div className="bg-gray-800 rounded-2xl shadow-lg p-6 h-fit">
                    <Skeleton className="h-8 w-1/3 mb-4 bg-gray-700" />
                    <div className="space-y-4">
                        <Skeleton className="h-6 w-1/4 bg-gray-700" />
                        <Skeleton className="h-10 w-full bg-gray-700" />
                        <Skeleton className="h-6 w-1/4 bg-gray-700" />
                        <Skeleton className="h-10 w-full bg-gray-700" />
                    </div>
                </div>
            </div>
        </>
    )
}
