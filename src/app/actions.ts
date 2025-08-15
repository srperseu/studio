'use server';

import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { generateBarberBio } from '@/ai/flows/generate-barber-bio';
import { generateAppointmentReminder } from '@/ai/flows/generate-appointment-reminder';
import { revalidatePath } from 'next/cache';
import type { Barber } from '@/lib/types';

// As funções de signUp e signIn foram movidas para o hook useAuth para serem executadas no lado do cliente.
// A função de updateProfile foi movida para o lado do cliente para garantir o contexto de autenticação.

export async function getBarberProfile(uid: string) {
  try {
    const docRef = doc(db, "barbers", uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return { success: true, data: docSnap.data() as Barber };
    }
    return { success: false, message: "No such document!" };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function generateBioAction(keywords: string) {
  try {
    const result = await generateBarberBio({ keywords });
    return { success: true, bio: result.bio };
  } catch (error: any) {
    return { success: false, message: `Erro ao gerar bio: ${error.message}` };
  }
}

export async function generateReminderAction(appointment: any, barberName: string) {
  try {
    const result = await generateAppointmentReminder({
      clientName: appointment.clientName,
      service: appointment.service,
      date: new Date(appointment.date).toLocaleDateString('pt-BR', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      time: appointment.time,
      barberName,
    });
    return { success: true, reminderText: result.reminderText };
  } catch (error: any) {
    return { success: false, message: `Erro ao gerar lembrete: ${error.message}` };
  }
}

export async function createBooking(barberId: string, bookingData: any) {
  try {
    const { clientName, selectedService, selectedDate, selectedTime } = bookingData;
    const [serviceName, serviceType] = selectedService.split('|');

    await addDoc(collection(db, `barbers/${barberId}/appointments`), {
      clientName,
      service: serviceName,
      type: serviceType,
      date: selectedDate,
      time: selectedTime,
      createdAt: serverTimestamp(),
    });
    revalidatePath('/dashboard');
    return { success: true, message: 'Agendamento realizado com sucesso!' };
  } catch (error: any) {
    return { success: false, message: 'Erro ao realizar o agendamento.' };
  }
}
