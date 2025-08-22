
import type { Timestamp } from 'firebase/firestore';

export interface Service {
  id: string;
  name: string;
  description?: string;
  price: number;
  atHomePrice?: number;
  duration?: number; // Duração em minutos
}

export interface Availability {
  [day: string]: {
    active: boolean;
    start: string;
    end:string;
  };
}

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface Address {
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  fullAddress: string;
}


export interface Barber {
  id: string;
  uid: string;
  fullName: string;
  email: string;
  phone: string;
  profileComplete: boolean;
  photoURL?: string;
  coverPhotoURL?: string;
  description?: string;
  address?: Address;
  coordinates?: GeoPoint;
  availability: Availability;
  services: Service[];
  barbershopPhotos?: string[];
  reviewCount?: number;
  ratingAverage?: number;
}

export interface Client {
    id: string;
    uid: string;
    fullName: string;
    email: string;
    phone: string;
    address?: Address;
    coordinates?: GeoPoint;
    profileComplete: boolean;
}

export interface Appointment {
  id: string;
  barberId?: string;
  clientName: string;
  clientUid: string;
  clientCoordinates?: GeoPoint | null;
  clientFullAddress?: string;
  serviceName: string;
  servicePrice: number;
  type: 'inShop' | 'atHome';
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM"
  createdAt: Timestamp;
  status: 'scheduled' | 'cancelled' | 'completed' | 'no-show';
  reviewed: boolean;
}

export interface Review {
    id: string;
    barberId: string;
    clientUid: string;
    clientName: string;
    appointmentId: string;
    rating: number; // 1-5
    comment?: string;
    praises?: string[]; // e.g., ["Pontual", "Bom de Papo"]
    createdAt: Timestamp;
}
