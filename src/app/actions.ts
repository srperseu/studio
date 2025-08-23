
'use server';

import { doc, getDoc, collection, addDoc, serverTimestamp, setDoc, updateDoc, runTransaction, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { generateBarberBio } from '@/ai/flows/generate-barber-bio';
import { generateAppointmentReminder } from '@/ai/flows/generate-appointment-reminder';
import { revalidatePath } from 'next/cache';
import type { Barber, Service, Client, Address, Availability, Review } from '@/lib/types';

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
  selectedServiceId: string,
  bookingType: 'inShop' | 'atHome',
  selectedDate: string,
  selectedTime: string
) {
  try {
    // 1. Fetch barber data to validate service
    const barberRef = doc(db, 'barbers', barberId);
    const barberSnap = await getDoc(barberRef);
     if (!barberSnap.exists()) {
      return { success: false, message: 'Barbeiro não encontrado.' };
    }
    const barberData = barberSnap.data() as Barber;
    const selectedService = barberData.services?.find(s => s.id === selectedServiceId);
    
    if (!selectedService || !selectedService.name || !selectedService.price) {
        return { success: false, message: 'Serviço inválido ou não selecionado.' };
    }
    
    // 2. Fetch client data to get coordinates and address
    const clientRef = doc(db, 'clients', clientUid);
    const clientSnap = await getDoc(clientRef);
    if (!clientSnap.exists()) {
      return { success: false, message: 'Perfil do cliente não encontrado.' };
    }
    const clientData = clientSnap.data() as Client;


    const finalPrice = bookingType === 'atHome' 
        ? (selectedService.atHomePrice || selectedService.price)
        : selectedService.price;

    const newAppointmentRef = await addDoc(collection(db, `barbers/${barberId}/appointments`), {
      clientName,
      clientUid, // Store the client's UID
      clientCoordinates: clientData.coordinates || null,
      clientFullAddress: clientData.address?.fullAddress || '',
      serviceName: selectedService.name,
      serviceId: selectedService.id, // Armazena o ID do serviço
      servicePrice: finalPrice,
      type: bookingType,
      date: selectedDate, // Salva a data como string 'YYYY-MM-DD'
      time: selectedTime,
      createdAt: serverTimestamp(),
      status: 'scheduled',
      reviewed: false, // Add reviewed flag
    });
    revalidatePath('/dashboard');
    revalidatePath('/dashboard/client'); // Revalidate client dashboard too
    return { success: true, message: 'Agendamento realizado com sucesso!', appointmentId: newAppointmentRef.id };
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
        revalidatePath('/dashboard/history');
        revalidatePath('/dashboard/client/history');
        return { success: true, message: `Agendamento atualizado para ${status}.` };
    } catch (error: any) {
        return { success: false, message: `Erro ao atualizar agendamento: ${error.message}` };
    }
}

export async function submitReviewAction(
    barberId: string, 
    appointmentId: string,
    reviewData: Omit<Review, 'id' | 'createdAt' | 'barberId'>
) {
    try {
        const barberRef = doc(db, 'barbers', barberId);
        const appointmentRef = doc(db, 'barbers', barberId, 'appointments', appointmentId);
        const reviewRef = doc(collection(db, 'barbers', barberId, 'reviews'));

        await runTransaction(db, async (transaction) => {
            const barberDoc = await transaction.get(barberRef);
            if (!barberDoc.exists()) {
                throw new Error("Barbeiro não encontrado.");
            }
            
            // 1. Save the new review
            transaction.set(reviewRef, {
                ...reviewData,
                id: reviewRef.id,
                barberId: barberId,
                createdAt: serverTimestamp(),
                acknowledgedByBarber: false,
            });

            // 2. Mark appointment as reviewed
            transaction.update(appointmentRef, { reviewed: true });

            // 3. Update barber's average rating and review count
            const barberData = barberDoc.data() as Barber;
            const currentTotalRating = (barberData.ratingAverage || 0) * (barberData.reviewCount || 0);
            const newReviewCount = (barberData.reviewCount || 0) + 1;
            const newTotalRating = currentTotalRating + reviewData.rating;
            const newAverage = newTotalRating / newReviewCount;
            
            transaction.update(barberRef, {
                reviewCount: newReviewCount,
                ratingAverage: newAverage,
            });
        });

        revalidatePath(`/booking`);
        revalidatePath(`/dashboard/client/history`);
        return { success: true, message: "Avaliação enviada com sucesso!" };
    } catch (error: any) {
        console.error("Erro ao enviar avaliação:", error);
        return { success: false, message: error.message };
    }
}

export async function replyToReviewAction(barberId: string, reviewId: string, replyText: string) {
    try {
        const reviewRef = doc(db, `barbers/${barberId}/reviews`, reviewId);
        await updateDoc(reviewRef, { barberReply: replyText });
        revalidatePath('/dashboard/reviews');
        revalidatePath('/booking');
        return { success: true, message: 'Resposta enviada com sucesso!' };
    } catch (error: any) {
        return { success: false, message: `Erro ao enviar resposta: ${error.message}` };
    }
}

export async function acknowledgeLowRatedReviewsAction(barberId: string, reviewIds: string[]) {
    try {
        const batch = writeBatch(db);
        reviewIds.forEach(reviewId => {
            const reviewRef = doc(db, `barbers/${barberId}/reviews`, reviewId);
            batch.update(reviewRef, { acknowledgedByBarber: true });
        });
        await batch.commit();
        revalidatePath('/dashboard');
        return { success: true };
    } catch (error: any) {
        return { success: false, message: `Erro ao marcar como lido: ${error.message}` };
    }
}


export async function updateBarberSection<T extends keyof Barber>(
  uid: string,
  sectionData: Pick<Barber, T>
) {
  try {
    const barberRef = doc(db, 'barbers', uid);
    await updateDoc(barberRef, sectionData);
    revalidatePath('/profile-setup');
    return { success: true, message: 'Seção atualizada com sucesso!' };
  } catch (error: any) {
    return { success: false, message: `Erro ao atualizar seção: ${error.message}` };
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
