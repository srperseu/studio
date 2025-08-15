'use server';

import { signOut } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { generateBarberBio } from '@/ai/flows/generate-barber-bio';
import { generateAppointmentReminder } from '@/ai/flows/generate-appointment-reminder';
import { revalidatePath } from 'next/cache';
import type { Barber } from '@/lib/types';

// As funções de signUp e signIn foram movidas para o hook useAuth para serem executadas no lado do cliente.

export async function signOutUser() {
  // A função de signOut também foi movida para o hook useAuth.
  // Esta função pode ser removida se não for usada em nenhum outro lugar do lado do servidor.
  // Por enquanto, vamos mantê-la vazia para evitar que seja chamada por engano.
  try {
    // await signOut(auth);
    return { success: true, message: 'Você saiu da sua conta.' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function updateProfile(uid: string, profileData: any) {
  try {
    const barberRef = doc(db, 'barbers', uid);
    await setDoc(barberRef, { ...profileData, profileComplete: true }, { merge: true });
    revalidatePath('/dashboard');
    revalidatePath('/');
    return { success: true, message: 'Perfil salvo com sucesso!' };
  } catch (error: any) {
    return { success: false, message: `Erro ao salvar: ${error.message}` };
  }
}

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
