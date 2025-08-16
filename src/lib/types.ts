
import type { Timestamp } from 'firebase/firestore';

export interface ServiceDetail {
  active: boolean;
  price: string;
}

export interface Services {
  inShop: ServiceDetail;
  atHome: ServiceDetail;
}

export interface Availability {
  [day: string]: {
    active: boolean;
    start: string;
    end:string;
  };
}

export interface Barber {
  id: string;
  uid: string;
  fullName: string;
  email: string;
  phone: string;
  profileComplete: boolean;
  photoURL?: string;
  description?: string;
  address?: string;
  availability: Availability;
  services: Services;
}

export interface Client {
    id: string;
    uid: string;
    fullName: string;
    email: string;
    phone: string;
    address?: string;
    profileComplete: boolean;
}

export interface Appointment {
  id: string;
  clientName: string;
  clientUid: string;
  service: string;
  type: 'inShop' | 'atHome';
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM"
  createdAt: Timestamp;
  status: 'scheduled' | 'cancelled' | 'completed' | 'no-show';
}
