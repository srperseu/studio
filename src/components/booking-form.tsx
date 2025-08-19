
'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { createBooking } from '@/app/actions';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import type { Barber, Client, GeoPoint, Service } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';


const dayOfWeekMap = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado'
];

interface BookingFormProps {
    barber: Barber;
    clientCoords: GeoPoint | null;
}

export function BookingForm({ barber, clientCoords }: BookingFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [clientName, setClientName] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [bookingType, setBookingType] = useState<'inShop' | 'atHome'>('inShop');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [timeSlot, setTimeSlot] = useState<{min: string, max: string, disabled: boolean, error?: string}>({min: '00:00', max: '23:59', disabled: true});
  
  const [travelInfo, setTravelInfo] = useState<{distance: string; duration: string} | null>(null);
  const [isTravelInfoLoading, setIsTravelInfoLoading] = useState(true);
  const [isComboboxOpen, setIsComboboxOpen] = useState(false);


  const selectedService = useMemo(() => {
    // Ensure barber.services is an array before calling find
    if (!Array.isArray(barber.services)) return undefined;
    return barber.services.find((s: Service) => s.id === selectedServiceId);
  }, [selectedServiceId, barber.services]);

  const finalPrice = useMemo(() => {
    if (!selectedService) return 0;
    return bookingType === 'atHome' && selectedService.atHomeFee 
        ? selectedService.price + selectedService.atHomeFee
        : selectedService.price;
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
  
  useEffect(() => {
    if (selectedDate && barber?.availability) {
      const dayOfWeekIndex = selectedDate.getDay();
      const dayOfWeekName = dayOfWeekMap[dayOfWeekIndex];
      const availabilityForDay = barber.availability[dayOfWeekName];

      if (availabilityForDay && availabilityForDay.active) {
        setTimeSlot({ 
            min: availabilityForDay.start, 
            max: availabilityForDay.end, 
            disabled: false,
            error: undefined
        });
      } else {
        setTimeSlot({ 
            min: '00:00', 
            max: '23:59', 
            disabled: true,
            error: `O barbeiro não atende neste dia.`
        });
        setSelectedTime(''); // Reset time if day is unavailable
      }
    } else {
      setTimeSlot({ min: '00:00', max: '23:59', disabled: true, error: 'Selecione uma data para ver os horários.' });
    }
  }, [selectedDate, barber]);

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


  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!clientName.trim()) newErrors.clientName = 'Seu nome é obrigatório';
    if (!selectedService) newErrors.selectedService = 'Selecione um serviço';
    if (!selectedDate) newErrors.selectedDate = 'Selecione uma data';
    if (!selectedTime) newErrors.selectedTime = 'Selecione um horário';
    if (timeSlot.disabled) newErrors.selectedTime = 'Horário ou dia inválido';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
        toast({ title: "Erro de Autenticação", description: "Você precisa estar logado para agendar.", variant: "destructive" });
        return;
    }
    if (!validateForm() || !selectedDate || !selectedService) {
        return;
    }
    
    setIsLoading(true);

    try {
        const result = await createBooking(
            barber.id,
            user.uid,
            clientName,
            selectedService,
            bookingType,
            format(selectedDate, 'yyyy-MM-dd'),
            selectedTime
        );

        if (result.success) {
          toast({ title: "Sucesso!", description: `Agendamento com ${barber.fullName} realizado!` });
          setSelectedServiceId('');
          setSelectedDate(undefined);
          setSelectedTime('');
          setErrors({});
        } else {
          console.error("Booking failed with message:", result.message);
          toast({ 
              title: "Erro ao Agendar", 
              description: `Falha: ${result.message || 'Ocorreu um erro desconhecido.'}`, 
              variant: "destructive" 
          });
        }
    } catch (error: any) {
        console.error("Booking failed with exception:", error);
        toast({
            title: "Erro Crítico",
            description: `Ocorreu uma exceção: ${error.message}`,
            variant: "destructive",
        });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start mt-8">
        <Card className="bg-card">
            <CardHeader>
                <div className="flex items-start gap-4 mb-4">
                    <Image src={barber.photoURL || 'https://placehold.co/80x80.png'} alt={barber.fullName} width={80} height={80} className="rounded-full object-cover border" data-ai-hint="barber portrait" />
                    <div className='flex-grow'>
                    <h2 className="text-2xl font-bold">{barber.fullName}</h2>
                    <p className="text-muted-foreground flex items-center gap-1"><Icons.MapPin className="h-4 w-4" /> {barber.address?.fullAddress || 'Endereço não informado'}</p>
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
                                <span>{s.name}</span>
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
                            <p><span className="font-medium text-foreground">Distância:</span> {travelInfo.distance}</p>
                            <p><span className="font-medium text-foreground">Tempo Estimado:</span> {travelInfo.duration}</p>
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
                <form onSubmit={onSubmit} className="space-y-6">
                <div>
                    <Label htmlFor="clientName" className="block text-sm font-medium text-muted-foreground mb-1">Seu Nome</Label>
                    <Input id="clientName" value={clientName} onChange={(e) => setClientName(e.target.value)} required disabled={!!user}/>
                    {errors.clientName && <p className="text-destructive text-xs mt-1">{errors.clientName}</p>}
                </div>
                <div className="space-y-4">
                    <div>
                        <Label htmlFor="service" className="block text-sm font-medium text-muted-foreground mb-1">Serviço</Label>
                        <Popover open={isComboboxOpen} onOpenChange={setIsComboboxOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={isComboboxOpen}
                                className="w-full justify-between"
                                >
                                {selectedServiceId
                                    ? barber.services?.find((service) => service.id === selectedServiceId)?.name
                                    : "Selecione um serviço..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-full p-0">
                                <Command>
                                <CommandInput placeholder="Buscar serviço..." />
                                <CommandList>
                                    <CommandEmpty>Nenhum serviço encontrado.</CommandEmpty>
                                    <CommandGroup>
                                    {barber.services?.map((service) => (
                                        <CommandItem
                                        key={service.id}
                                        value={service.name}
                                        onSelect={() => {
                                            setSelectedServiceId(service.id);
                                            setIsComboboxOpen(false);
                                        }}
                                        >
                                        <Check
                                            className={cn(
                                            "mr-2 h-4 w-4",
                                            selectedServiceId === service.id ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        {service.name}
                                        </CommandItem>
                                    ))}
                                    </CommandGroup>
                                </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        {errors.selectedService && <p className="text-destructive text-xs mt-1">{errors.selectedService}</p>}
                    </div>

                    {selectedService && (
                        <div>
                            <Label className="block text-sm font-medium text-muted-foreground mb-2">Local de Atendimento</Label>
                            <RadioGroup value={bookingType} onValueChange={(value) => setBookingType(value as any)} className="flex gap-4">
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="inShop" id="inShop" />
                                    <Label htmlFor="inShop">Na Barbearia (R$ {selectedService.price.toFixed(2)})</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="atHome" id="atHome" disabled={!selectedService.atHomeFee || selectedService.atHomeFee <= 0}/>
                                    <Label htmlFor="atHome">Em Domicílio (+ R$ {selectedService.atHomeFee?.toFixed(2)})</Label>
                                </div>
                            </RadioGroup>
                        </div>
                    )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                    <Label htmlFor="date" className="block text-sm font-medium text-muted-foreground mb-1">Data</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn(
                            "w-full justify-start text-left font-normal",
                            !selectedDate && "text-muted-foreground"
                            )}
                        >
                            <Icons.Calendar className="mr-2 h-4 w-4" />
                            {selectedDate ? format(selectedDate, "PPP", { locale: ptBR }) : <span>Escolha uma data</span>}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                        <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={setSelectedDate}
                            disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                            initialFocus
                            locale={ptBR}
                        />
                        </PopoverContent>
                    </Popover>
                    {errors.selectedDate && <p className="text-destructive text-xs mt-1">{errors.selectedDate}</p>}
                    </div>
                    <div>
                    <Label htmlFor="time" className="block text-sm font-medium text-muted-foreground mb-1">Horário</Label>
                    <Input type="time" id="time" value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)} disabled={timeSlot.disabled} min={timeSlot.min} max={timeSlot.max} />
                    {errors.selectedTime && <p className="text-destructive text-xs mt-1">{errors.selectedTime}</p>}
                    {timeSlot.error && <p className="text-destructive text-xs mt-1">{timeSlot.error}</p>}
                    </div>
                </div>

                {selectedService && (
                    <div className="text-right font-bold text-lg">
                        Total: R$ {finalPrice.toFixed(2)}
                    </div>
                )}

                <Button type="submit" disabled={isLoading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
                    {isLoading && <Icons.Spinner className="mr-2" />}
                    {isLoading ? 'Agendando...' : 'Agendar Horário'}
                </Button>
                </form>
            </CardContent>
        </Card>
      </div>
  );
}
