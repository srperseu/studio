
'use server';

import { doc, getDoc, collection, addDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { generateBarberBio } from '@/ai/flows/generate-barber-bio';
import { generateAppointmentReminder } from '@/ai/flows/generate-appointment-reminder';
import { revalidatePath } from 'next/cache';
import type { Barber, Service, Client } from '@/lib/types';

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
  selectedService: Service,
  bookingType: 'inShop' | 'atHome',
  selectedDate: string,
  selectedTime: string
) {
  try {
    if (!selectedService || !selectedService.name || !selectedService.price) {
        return { success: false, message: 'Serviço inválido ou não selecionado.' };
    }
    
    // Fetch client data to get coordinates and address
    const clientRef = doc(db, 'clients', clientUid);
    const clientSnap = await getDoc(clientRef);
    if (!clientSnap.exists()) {
      return { success: false, message: 'Perfil do cliente não encontrado.' };
    }
    const clientData = clientSnap.data() as Client;


    const finalPrice = bookingType === 'atHome' 
        ? (selectedService.atHomePrice || selectedService.price)
        : selectedService.price;

    await addDoc(collection(db, `barbers/${barberId}/appointments`), {
      clientName,
      clientUid, // Store the client's UID
      clientCoordinates: clientData.coordinates || null,
      clientFullAddress: clientData.address?.fullAddress || '',
      serviceName: selectedService.name,
      servicePrice: finalPrice,
      type: bookingType,
      date: selectedDate, // Salva a data como string 'YYYY-MM-DD'
      time: selectedTime,
      createdAt: serverTimestamp(),
      status: 'scheduled',
    });
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/client'); // Revalidate client dashboard too
    return { success: true, message: 'Agendamento realizado com sucesso!' };
  } catch (error: any) {
    console.error("Erro detalhado ao criar agendamento no servidor:", error);
    return { success: false, message: `Erro ao realizar o agendamento: ${error.message} (Código: ${error.code})` };
  }
}

async function updateAppointmentStatus(barberId: string, appointmentId: string, status: 'cancelled' | 'completed' | 'no-show') {
    try {
        const appointmentRef = doc(db, `barbers/${barberId}/appointments`, appointmentId);
        await updateDoc(appointmentRef, { status });
        revalidatePath('/dashboard');
        revalidatePath('/dashboard/client');
        return { success: true, message: `Agendamento atualizado para ${status}.` };
    } catch (error: any) {
        return { success: false, message: `Erro ao atualizar agendamento: ${error.message}` };
    }
}


export async function cancelAppointmentAction(barberId: string, appointmentId: string) {
    return updateAppointmentStatus(barberId, appointmentId, 'cancelled');
}

export async function completeAppointmentAction(barberId: string, appointmentId: string) {
    return updateAppointmentStatus(barberId, appointmentId, 'completed');
}

export async function markAsNoShowAction(barberId: string, appointmentId: string) {
    return updateAppointmentStatus(barberId, appointmentId, 'no-show');
}
