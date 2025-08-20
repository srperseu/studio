
'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { createBooking } from '@/app/actions';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, parse, set } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { z } from 'zod';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

import type { Barber, Client, GeoPoint, Service, Appointment } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Icons } from './icons';
import { useAuth } from '@/hooks/use-auth';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { getTravelInfo } from '@/ai/flows/get-travel-info';
import { Skeleton } from './ui/skeleton';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';

const dayOfWeekMap = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const DEFAULT_APPOINTMENT_DURATION = 60; // 60 minutos como padrão

const bookingSchema = z.object({
  selectedServiceId: z.string().min(1, { message: 'Selecione um serviço.' }),
  bookingType: z.enum(['inShop', 'atHome'], { required_error: 'Selecione o local de atendimento.' }),
  selectedDate: z.date({ required_error: 'Selecione uma data.' }),
  selectedTime: z.string().min(1, { message: 'Selecione um horário.' }),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

interface BookingFormProps {
  barber: Barber;
  clientCoords: GeoPoint | null;
}

// Helper to convert time string "HH:MM" to minutes from midnight
const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
};

// Helper to convert minutes from midnight to time string "HH:MM"
const minutesToTime = (minutes: number): string => {
    const h = Math.floor(minutes / 60).toString().padStart(2, '0');
    const m = (minutes % 60).toString().padStart(2, '0');
    return `${h}:${m}`;
};


export function BookingForm({ barber, clientCoords }: BookingFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
  });
  
  const { watch, control, setValue, reset, formState: { isSubmitting } } = form;

  const selectedServiceId = watch('selectedServiceId');
  const bookingType = watch('bookingType');
  const selectedDate = watch('selectedDate');

  const [clientName, setClientName] = useState('');
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>([]);
  const [isTimeLoading, setIsTimeLoading] = useState(false);
  const [travelInfo, setTravelInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [isTravelInfoLoading, setIsTravelInfoLoading] = useState(true);
  const [existingAppointments, setExistingAppointments] = useState<Appointment[]>([]);

  const selectedService = useMemo(() => {
    if (!selectedServiceId || !Array.isArray(barber.services)) return undefined;
    return barber.services.find((s: Service) => s.id === selectedServiceId);
  }, [selectedServiceId, barber.services]);

  const finalPrice = useMemo(() => {
    if (!selectedService) return 0;
    if (bookingType === 'atHome' && selectedService.atHomePrice) {
      return selectedService.atHomePrice;
    }
    return selectedService.price;
  }, [selectedService, bookingType]);

  useEffect(() => {
    async function fetchClientProfile() {
      if (user) {
        const clientRef = doc(db, 'clients', user.uid);
        const docSnap = await getDoc(clientRef);
        if (docSnap.exists()) {
          const clientData = docSnap.data() as Client;
          setClientName(clientData.fullName);
        } else {
          setClientName(user.displayName || '');
        }
      }
    }
    fetchClientProfile();
  }, [user]);

  // Fetch appointments when date changes
  useEffect(() => {
    if (!selectedDate || !barber.id) return;
    
    const fetchAppointments = async () => {
      setIsTimeLoading(true);
      const q = query(
        collection(db, `barbers/${barber.id}/appointments`),
        where('date', '==', format(selectedDate, 'yyyy-MM-dd')),
        where('status', 'in', ['scheduled', 'completed']) // Consider scheduled and completed
      );
      const querySnapshot = await getDocs(q);
      const appointments = querySnapshot.docs.map(doc => doc.data() as Appointment);
      setExistingAppointments(appointments);
      setIsTimeLoading(false);
    };

    fetchAppointments();
  }, [selectedDate, barber.id]);


  // Generate time slots when date, service, or appointments change
  useEffect(() => {
    // Reset time when date or service changes
    setValue('selectedTime', ''); 
    if (selectedDate && barber?.availability && selectedService) {
      setIsTimeLoading(true);
      const serviceDuration = selectedService?.duration || DEFAULT_APPOINTMENT_DURATION;
      
      const dayOfWeekIndex = selectedDate.getDay();
      const dayOfWeekName = dayOfWeekMap[dayOfWeekIndex];
      const availabilityForDay = barber.availability[dayOfWeekName];

      if (!availabilityForDay || !availabilityForDay.active) {
          setAvailableTimeSlots([]);
          setIsTimeLoading(false);
          return;
      }
      
      // 1. Get working hours in minutes
      const workStartMinutes = timeToMinutes(availabilityForDay.start);
      const workEndMinutes = timeToMinutes(availabilityForDay.end);

      // 2. Get occupied blocks in minutes
      const occupiedBlocks = existingAppointments
        .map(app => {
            const bookedService = barber.services.find(s => s.name === app.serviceName);
            const duration = bookedService?.duration || DEFAULT_APPOINTMENT_DURATION;
            const start = timeToMinutes(app.time);
            const end = start + duration;
            return { start, end };
        })
        .sort((a, b) => a.start - b.start);
        
      // 3. Determine free gaps
      const freeGaps = [];
      let lastEnd = workStartMinutes;

      occupiedBlocks.forEach(block => {
          if (block.start > lastEnd) {
              freeGaps.push({ start: lastEnd, end: block.start });
          }
          lastEnd = Math.max(lastEnd, block.end);
      });
      
      if (lastEnd < workEndMinutes) {
          freeGaps.push({ start: lastEnd, end: workEndMinutes });
      }

      // 4. Generate slots within the free gaps
      const slots: string[] = [];
      freeGaps.forEach(gap => {
          let currentMinute = gap.start;
          while (currentMinute + serviceDuration <= gap.end) {
              slots.push(minutesToTime(currentMinute));
              // Move to the next potential slot, e.g., every 15 minutes
              currentMinute += 15;
          }
      });
      
      setAvailableTimeSlots(slots);
      setIsTimeLoading(false);
    } else {
      setAvailableTimeSlots([]);
    }
  }, [selectedDate, barber, selectedService, setValue, existingAppointments]);


  useEffect(() => {
    async function fetchTravelInfo() {
      if (clientCoords && barber.coordinates) {
        setIsTravelInfoLoading(true);
        try {
          const info = await getTravelInfo({
            origin: clientCoords,
            destinations: [barber.coordinates],
          });
          if (info && info.length > 0) {
            setTravelInfo(info[0]);
          }
        } catch (error) {
          console.error("Failed to get travel info:", error);
          setTravelInfo(null);
        } finally {
          setIsTravelInfoLoading(false);
        }
      } else {
        setIsTravelInfoLoading(false);
      }
    }
    fetchTravelInfo();
  }, [clientCoords, barber.coordinates]);


  const onSubmit = async (data: BookingFormValues) => {
    if (!user) {
      toast({ title: 'Erro de Autenticação', description: 'Você precisa estar logado para agendar.', variant: 'destructive' });
      return;
    }
    if (!selectedService) {
        form.setError('selectedServiceId', { type: 'manual', message: 'Serviço inválido.' });
        return;
    }

    try {
      const result = await createBooking(
        barber.id,
        user.uid,
        clientName,
        selectedService,
        data.bookingType,
        format(data.selectedDate, 'yyyy-MM-dd'),
        data.selectedTime
      );

      if (result.success) {
        toast({ title: 'Sucesso!', description: `Agendamento com ${barber.fullName} realizado!` });
        
        // Add the new appointment to the local state to trigger UI update
        const newAppointment: Appointment = {
            id: 'temp-' + Date.now(), // temporary id
            clientName: clientName,
            clientUid: user.uid,
            serviceName: selectedService.name,
            servicePrice: finalPrice,
            type: data.bookingType,
            date: format(data.selectedDate, 'yyyy-MM-dd'),
            time: data.selectedTime,
            status: 'scheduled',
            createdAt: new Date() as any, // This is temporary, Firestore will set the real one
        }
        setExistingAppointments(prev => [...prev, newAppointment]);

        reset(); // Reset form fields
      } else {
        console.error('Booking failed with message:', result.message);
        toast({
          title: 'Erro ao Agendar',
          description: `Falha: ${result.message || 'Ocorreu um erro desconhecido.'}`,
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('Booking failed with exception:', error);
      toast({
        title: 'Erro Crítico',
        description: `Ocorreu uma exceção: ${error.message}`,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start mt-8">
      <Card className="bg-card">
        <CardHeader>
          <div className="flex items-start gap-4 mb-4">
            <Image
              src={barber.photoURL || 'https://placehold.co/80x80.png'}
              alt={barber.fullName}
              width={80}
              height={80}
              className="rounded-full object-cover border"
              data-ai-hint="barber portrait"
            />
            <div className="flex-grow">
              <h2 className="text-2xl font-bold">{barber.fullName}</h2>
              <p className="text-muted-foreground flex items-center gap-1">
                <Icons.MapPin className="h-4 w-4" /> {barber.address?.fullAddress || 'Endereço não informado'}
              </p>
            </div>
          </div>
          <p className="text-muted-foreground">{barber.description}</p>
        </CardHeader>
        <CardContent>
          <div className="border-t border-border pt-4">
            <h3 className="font-semibold mb-2">Catálogo de Serviços</h3>
            <div className="space-y-1 text-muted-foreground">
              {barber.services?.map(s => (
                <div key={s.id} className="flex justify-between">
                  <span>{s.name} ({s.duration || DEFAULT_APPOINTMENT_DURATION} min)</span>
                  <span>R$ {s.price.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-border pt-4 mt-4">
            <h3 className="font-semibold mb-2">Informações da Viagem</h3>
            {isTravelInfoLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : travelInfo ? (
              <div className="text-muted-foreground">
                <p>
                  <span className="font-medium text-foreground">Distância:</span> {travelInfo.distance}
                </p>
                <p>
                  <span className="font-medium text-foreground">Tempo Estimado:</span> {travelInfo.duration}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Não foi possível calcular a distância.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card">
        <CardHeader>
          <CardTitle>Faça seu agendamento</CardTitle>
          <CardDescription>Preencha os detalhes abaixo para marcar seu horário.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            
            <FormField
              control={control}
              name="selectedServiceId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="block text-sm font-medium text-muted-foreground mb-2">Serviço</FormLabel>
                  <FormControl>
                    <RadioGroup
                        onValueChange={(value) => {
                            field.onChange(value);
                            setValue('bookingType', 'inShop'); // Reset booking type on service change
                        }}
                        defaultValue={field.value}
                        className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-1"
                    >
                      {barber.services?.map(service => (
                        <FormItem key={service.id}>
                          <FormControl>
                            <RadioGroupItem value={service.id} id={service.id} className="peer sr-only" />
                          </FormControl>
                          <Label
                            htmlFor={service.id}
                            className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                          >
                            <div className="flex items-center justify-between w-full">
                              <p className="font-semibold">{service.name}</p>
                              <p className="font-bold text-lg">R$ {service.price.toFixed(2)}</p>
                            </div>
                            <p className="text-sm text-muted-foreground w-full mt-1">
                                {service.duration || DEFAULT_APPOINTMENT_DURATION} min
                            </p>
                          </Label>
                        </FormItem>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedService && (
                <FormField
                    control={control}
                    name="bookingType"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="block text-sm font-medium text-muted-foreground mb-2">Local de Atendimento</FormLabel>
                            <FormControl>
                                <RadioGroup
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                    className="flex gap-4"
                                >
                                    <FormItem className="flex items-center space-x-2">
                                        <FormControl>
                                            <RadioGroupItem value="inShop" id="inShop" />
                                        </FormControl>
                                        <Label htmlFor="inShop">Na Barbearia (R$ {selectedService.price.toFixed(2)})</Label>
                                    </FormItem>
                                    <FormItem className="flex items-center space-x-2">
                                         <FormControl>
                                            <RadioGroupItem value="atHome" id="atHome" disabled={!selectedService.atHomePrice || selectedService.atHomePrice <= 0} />
                                         </FormControl>
                                        <Label htmlFor="atHome">
                                          Em Domicílio
                                          {selectedService.atHomePrice ? ` (R$ ${selectedService.atHomePrice.toFixed(2)})` : ''}
                                        </Label>
                                    </FormItem>
                                </RadioGroup>
                            </FormControl>
                             <FormMessage />
                        </FormItem>
                    )}
                />
            )}

            <div className="grid grid-cols-1 gap-4">
                <FormField
                    control={control}
                    name="selectedDate"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel htmlFor="date" className="block text-sm font-medium text-muted-foreground mb-1">
                              Data
                            </FormLabel>
                            <Popover>
                                <PopoverTrigger asChild>
                                <FormControl>
                                    <Button
                                        variant={'outline'}
                                        className={cn('w-full justify-start text-left font-normal', !field.value && 'text-muted-foreground')}
                                    >
                                        <Icons.Calendar className="mr-2 h-4 w-4" />
                                        {field.value ? format(field.value, 'PPP', { locale: ptBR }) : <span>Escolha uma data</span>}
                                    </Button>
                                </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  disabled={date => date < new Date(new Date().setHours(0, 0, 0, 0))}
                                  initialFocus
                                  locale={ptBR}
                                />
                                </PopoverContent>
                            </Popover>
                             <FormMessage />
                        </FormItem>
                    )}
                />

              {selectedDate && (
                <FormField
                    control={control}
                    name="selectedTime"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel htmlFor="time" className="block text-sm font-medium text-muted-foreground mb-1">
                                Horário
                            </FormLabel>
                             <FormControl>
                                <div className="grid grid-cols-4 gap-2">
                                  {isTimeLoading ? (
                                    Array.from({ length: 8 }).map((_, i) => (
                                      <Skeleton key={i} className="h-10 w-full" />
                                    ))
                                  ) : availableTimeSlots.length > 0 ? (
                                    availableTimeSlots.map(time => (
                                      <Button
                                        key={time}
                                        type="button"
                                        variant={field.value === time ? 'default' : 'outline'}
                                        onClick={() => field.onChange(time)}
                                      >
                                        {time}
                                      </Button>
                                    ))
                                  ) : (
                                    <p className="col-span-4 text-muted-foreground text-sm text-center bg-muted p-4 rounded-md">
                                      Nenhum horário disponível para este serviço nesta data.
                                    </p>
                                  )}
                                </div>
                              </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
              )}
            </div>

            {selectedService && (
              <div className="text-right font-bold text-lg">Total: R$ {finalPrice.toFixed(2)}</div>
            )}

            <Button type="submit" disabled={isSubmitting} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
              {isSubmitting ? <Icons.Spinner /> : 'Agendar Horário'}
            </Button>
          </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
