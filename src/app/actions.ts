
'use server';

import { doc, getDoc, collection, addDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
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

interface ReminderDetails {
  clientName: string;
  service: string;
  date: string;
  time: string;
}

export async function generateReminderAction(appointmentDetails: ReminderDetails, barberName: string) {
  try {
    const result = await generateAppointmentReminder({
      clientName: appointmentDetails.clientName,
      service: appointmentDetails.service,
      date: new Date(appointmentDetails.date).toLocaleDateString('pt-BR', {weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      time: appointmentDetails.time,
      barberName,
    });
    return { success: true, reminderText: result.reminderText };
  } catch (error: any) {
    return { success: false, message: `Erro ao gerar lembrete: ${error.message}` };
  }
}

export async function createBooking(
  barberId: string,
  clientUid: string,
  clientName: string,
  selectedService: string,
  selectedDate: string,
  selectedTime: string
) {
  try {
    if (!selectedService || typeof selectedService !== 'string' || !selectedService.includes('|')) {
        return { success: false, message: 'Serviço inválido ou não selecionado.' };
    }

    const serviceParts = selectedService.split('|');
    if (serviceParts.length !== 2 || !serviceParts[0] || !serviceParts[1]) {
        return { success: false, message: 'Formato de serviço inválido.'};
    }
    const [serviceName, serviceType] = serviceParts;


    await addDoc(collection(db, `barbers/${barberId}/appointments`), {
      clientName,
      clientUid, // Store the client's UID
      service: serviceName,
      type: serviceType,
      date: selectedDate, // Salva a data como string 'YYYY-MM-DD'
      time: selectedTime,
      createdAt: serverTimestamp(),
      status: 'scheduled', // Novo campo
    });
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/client'); // Revalidate client dashboard too
    return { success: true, message: 'Agendamento realizado com sucesso!' };
  } catch (error: any) {
    console.error("Erro detalhado ao criar agendamento no servidor:", error);
    return { success: false, message: `Erro ao realizar o agendamento: ${error.message} (Código: ${error.code})` };
  }
}

export async function cancelAppointmentAction(barberId: string, appointmentId: string) {
    try {
        const appointmentRef = doc(db, `barbers/${barberId}/appointments`, appointmentId);
        await updateDoc(appointmentRef, {
            status: 'cancelled'
        });
        revalidatePath('/dashboard');
        revalidatePath('/dashboard/client');
        return { success: true, message: 'Agendamento cancelado.' };
    } catch (error: any) {
        return { success: false, message: `Erro ao cancelar agendamento: ${error.message}` };
    }
}
