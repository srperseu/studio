
'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { createBooking } from '@/app/actions';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { z } from 'zod';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, LayoutGroup } from 'framer-motion';

import type { Barber, Client, GeoPoint, Service, Appointment, Review } from '@/lib/types';
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StarRating } from './star-rating';
import { Badge } from './ui/badge';

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
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isReviewsLoading, setIsReviewsLoading] = useState(true);
  const [starFilter, setStarFilter] = useState<number | 'all'>('all');
  const [activeTab, setActiveTab] = useState('booking');

  const filteredReviews = useMemo(() => {
    if (starFilter === 'all') return reviews;
    return reviews.filter(r => r.rating === starFilter);
  }, [reviews, starFilter]);

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
    async function fetchInitialData() {
      if (user) {
        // Fetch client name
        const clientRef = doc(db, 'clients', user.uid);
        const docSnap = await getDoc(clientRef);
        if (docSnap.exists()) {
          const clientData = docSnap.data() as Client;
          setClientName(clientData.fullName);
        } else {
          setClientName(user.displayName || '');
        }
      }
      
      // Fetch reviews
      setIsReviewsLoading(true);
      const q = query(collection(db, `barbers/${barber.id}/reviews`), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const reviewsData = querySnapshot.docs.map(doc => doc.data() as Review);
      setReviews(reviewsData);
      setIsReviewsLoading(false);
    }
    fetchInitialData();
  }, [user, barber.id]);

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
      
       // Check for all-day blockouts
      const isDayBlocked = barber.blockouts?.some(event => {
          const startDate = parseISO(event.startDate);
          const endDate = parseISO(event.endDate);
          return event.isAllDay && selectedDate >= startDate && selectedDate <= endDate;
      });

      if (isDayBlocked) {
          setAvailableTimeSlots([]);
          setIsTimeLoading(false);
          return;
      }
      
      const dayOfWeekIndex = selectedDate.getDay();
      const dayOfWeekName = dayOfWeekMap[dayOfWeekIndex];
      const availabilityForDay = barber.availability[dayOfWeekName];

      if (!availabilityForDay || !availabilityForDay.active) {
          setAvailableTimeSlots([]);
          setIsTimeLoading(false);
          return;
      }
      
      const workStartMinutes = timeToMinutes(availabilityForDay.start);
      const workEndMinutes = timeToMinutes(availabilityForDay.end);

      // Create a list of occupied blocks including appointments and time-specific blockouts
      const appointmentBlocks = existingAppointments.map(app => {
          const bookedService = barber.services.find(s => s.name === app.serviceName);
          const duration = bookedService?.duration || DEFAULT_APPOINTMENT_DURATION;
          const start = timeToMinutes(app.time);
          const end = start + duration;
          return { start, end };
      });
      
      const eventBlocks = (barber.blockouts || [])
        .filter(event => !event.isAllDay && format(parseISO(event.startDate), 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd') && event.startTime && event.endTime)
        .map(event => ({
            start: timeToMinutes(event.startTime!),
            end: timeToMinutes(event.endTime!)
        }));

      const occupiedBlocks = [...appointmentBlocks, ...eventBlocks].sort((a, b) => a.start - b.start);
      
      const slots: string[] = [];
      const searchIncrement = 15; // check every 15 min
      
      let currentTime = workStartMinutes;
      while (currentTime + serviceDuration <= workEndMinutes) {
          const potentialEndTime = currentTime + serviceDuration;
          let isAvailable = true;

          for (const block of occupiedBlocks) {
              // Check for overlap
              if (currentTime < block.end && potentialEndTime > block.start) {
                  isAvailable = false;
                  // Jump to the end of the current block to find the next free slot
                  currentTime = block.end;
                  break;
              }
          }

          if (isAvailable) {
              slots.push(minutesToTime(currentTime));
              currentTime += searchIncrement;
          } else {
              // If we jumped, we need to continue the outer loop
              continue;
          }
      }
      
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
        const clientSnap = await getDoc(doc(db, 'clients', user.uid));
        const clientData = clientSnap.data() as Client;

        const newAppointment: Appointment = {
            id: 'temp-' + Date.now(), // temporary id
            clientName: clientName,
            clientUid: user.uid,
            clientCoordinates: clientData.coordinates,
            clientFullAddress: clientData.address?.fullAddress,
            serviceName: selectedService.name,
            servicePrice: finalPrice,
            type: data.bookingType,
            date: format(data.selectedDate, 'yyyy-MM-dd'),
            time: data.selectedTime,
            status: 'scheduled',
            createdAt: new Date() as any, // This is temporary, Firestore will set the real one
            reviewed: false,
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
        variant: 'destructive'
      });
    }
  };
  
  const BarberProfileCard = () => (
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
               <div className="flex items-center gap-2 mt-2">
                   {barber.ratingAverage && barber.reviewCount ? (
                         <Button onClick={() => setActiveTab('details')} variant="link" className="flex items-center gap-1 text-sm text-amber-500 p-0 h-auto hover:opacity-80">
                           <Icons.Star className="h-4 w-4 fill-current" />
                           <span className="font-bold text-foreground">{barber.ratingAverage.toFixed(1)}</span>
                           <span className="text-muted-foreground">({barber.reviewCount} avaliações)</span>
                        </Button>
                   ) : (
                       <Badge variant="outline">Novo</Badge>
                   )}
                </div>
            </div>
          </div>
          <p className="text-muted-foreground">{barber.description}</p>
        </CardHeader>
        <CardContent>
          <div className="border-t border-border pt-4">
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
  );
  
  const TABS = [
    { value: "booking", label: "Agendamento" },
    { value: "details", label: "Detalhes e Avaliações" },
  ];

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-8 w-full">
      <LayoutGroup>
        <TabsList className="grid w-full grid-cols-2 relative bg-muted p-1 h-10">
            {TABS.map((tab) => (
            <TabsTrigger
                key={tab.value}
                value={tab.value}
                className={cn(
                "relative z-10 transition-colors duration-200 ease-in-out",
                activeTab !== tab.value &&
                    "text-muted-foreground hover:text-foreground"
                )}
            >
                {tab.label}
                 {activeTab === tab.value && (
                    <motion.div
                        layoutId="active-tab-indicator-booking"
                        className="absolute inset-0 z-[-1] rounded-md bg-card shadow-sm"
                        transition={{ type: "spring", stiffness: 350, damping: 30 }}
                    />
                )}
            </TabsTrigger>
            ))}
        </TabsList>
      </LayoutGroup>
      
      <TabsContent value="booking" className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start mt-4">
          <BarberProfileCard />
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
      </TabsContent>

      <TabsContent value="details" className="mt-4">
        <Card>
            <CardHeader>
                <CardTitle>Avaliações dos Clientes</CardTitle>
                <CardDescription>Veja o que outros clientes estão dizendo.</CardDescription>
            </CardHeader>
            <CardContent>
                 {isReviewsLoading ? (
                    <p>Carregando avaliações...</p>
                 ) : reviews.length === 0 ? (
                     <p className="text-muted-foreground">Este barbeiro ainda não tem avaliações.</p>
                 ) : (
                    <>
                        <div className="flex flex-wrap gap-2 mb-4">
                            <Button variant={starFilter === 'all' ? 'default' : 'outline'} onClick={() => setStarFilter('all')}>
                                Todas ({reviews.length})
                            </Button>
                            {[5, 4, 3, 2, 1].map(star => (
                                <Button key={star} variant={starFilter === star ? 'default' : 'outline'} onClick={() => setStarFilter(star)}>
                                    {star} <Icons.Star className="ml-1 h-4 w-4 fill-current"/>
                                </Button>
                            ))}
                        </div>
                         <div className="space-y-4 max-h-[500px] overflow-y-auto p-2">
                            {filteredReviews.length > 0 ? (
                                filteredReviews.map(review => (
                                    <div key={review.id} className="p-4 bg-muted/50 rounded-lg border border-border">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-semibold">{review.clientName}</p>
                                                <StarRating rating={review.rating} />
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                {review.createdAt ? new Date(review.createdAt.seconds * 1000).toLocaleDateString('pt-BR') : ''}
                                            </p>
                                        </div>
                                        {review.comment && <p className="mt-2 text-foreground/90 italic">"{review.comment}"</p>}
                                        {review.praises && review.praises.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {review.praises.map(praise => <Badge key={praise} variant="secondary">{praise}</Badge>)}
                                            </div>
                                        )}
                                        {review.barberReply && (
                                            <div className="mt-3 pt-3 border-t border-border/50 bg-primary/10 p-3 rounded-md">
                                                <p className="font-semibold text-primary text-sm">Resposta do Barbeiro</p>
                                                <p className="text-foreground/80 italic">"{review.barberReply}"</p>
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <p className="text-muted-foreground text-center py-8">Nenhuma avaliação encontrada para este filtro.</p>
                            )}
                        </div>
                    </>
                 )}
            </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
