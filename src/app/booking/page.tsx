import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Barber } from '@/lib/types';
import { BookingForm } from '@/components/booking-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

async function getBarbers(): Promise<Barber[]> {
  try {
    const q = query(collection(db, 'barbers'), where('profileComplete', '==', true));
    const querySnapshot = await getDocs(q);
    const barbersList: Barber[] = [];
    querySnapshot.forEach((doc) => {
      barbersList.push({ id: doc.id, ...doc.data() } as Barber);
    });
    return barbersList;
  } catch (error) {
    console.error("Error fetching barbers: ", error);
    return [];
  }
}

export default async function ClientBookingPage() {
  const barbers = await getBarbers();

  return (
    <main className="min-h-screen bg-background p-4 sm:p-8 font-body text-foreground">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold font-headline">BarberFlow</h1>
          <p className="text-muted-foreground mt-2">Agende um Horário com os Melhores Barbeiros</p>
        </div>

        {barbers.length === 0 ? (
          <Card className="w-full max-w-md mx-auto bg-card">
            <CardHeader>
              <CardTitle className="text-center">Nenhum Barbeiro Disponível</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center">
                Volte mais tarde ou peça para um barbeiro se cadastrar na plataforma.
              </p>
            </CardContent>
          </Card>
        ) : (
          <BookingForm barbers={barbers} />
        )}
      </div>
    </main>
  );
}
