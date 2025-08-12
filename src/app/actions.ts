'use server';

import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { generateBarberBio } from '@/ai/flows/generate-barber-bio';
import { generateAppointmentReminder } from '@/ai/flows/generate-appointment-reminder';
import { revalidatePath } from 'next/cache';

export async function signUp(data: Record<string, string>) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, data.email, data.password);
    const user = userCredential.user;
    await setDoc(doc(db, 'barbers', user.uid), {
      uid: user.uid,
      fullName: data.fullName,
      email: data.email,
      phone: data.phone,
      profileComplete: false,
    });
    return { success: true, message: 'Cadastro realizado! Configure seu perfil.' };
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

export async function signIn(data: Record<string, string>) {
  try {
    await signInWithEmailAndPassword(auth, data.email, data.password);
    return { success: true, message: 'Login bem-sucedido!' };
  } catch (error: any) {
    return { success: false, message: 'Credenciais inválidas. Tente novamente.' };
  }
}

export async function signOutUser() {
  try {
    await signOut(auth);
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
      return { success: true, data: docSnap.data() };
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
