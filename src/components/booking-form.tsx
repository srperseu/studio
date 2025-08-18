
'use client';

import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import { createBooking } from '@/app/actions';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import type { Barber, Client } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Icons } from './icons';
import { useAuth } from '@/hooks/use-auth';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { Calendar } from './ui/calendar';
import { cn } from '@/lib/utils';


const dayOfWeekMap = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado'
];


export function BookingForm({ barber }: { barber: Barber }) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [clientName, setClientName] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [timeSlot, setTimeSlot] = useState<{min: string, max: string, disabled: boolean, error?: string}>({min: '00:00', max: '23:59', disabled: true});

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
    if (!validateForm() || !selectedDate) {
        return;
    }
    
    setIsLoading(true);

    try {
        const result = await createBooking(
            barber.id,
            user.uid,
            clientName,
            selectedService,
            format(selectedDate, 'yyyy-MM-dd'),
            selectedTime
        );

        if (result.success) {
          toast({ title: "Sucesso!", description: `Agendamento com ${barber.fullName} realizado!` });
          setSelectedService('');
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
                    <h3 className="font-semibold mb-2">Serviços Disponíveis</h3>
                    {barber.services?.inShop?.active && <p className="text-muted-foreground">Corte na Barbearia - R$ {barber.services.inShop.price}</p>}
                    {barber.services?.atHome?.active && <p className="text-muted-foreground">Corte em Domicílio - R$ {barber.services.atHome.price}</p>}
                </div>
            </CardContent>
        </Card>

        <Card className="bg-card">
            <CardHeader>
                <CardTitle>Faça seu agendamento</CardTitle>
                <CardDescription>Preencha os detalhes abaixo para marcar seu horário.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={onSubmit} className="space-y-4">
                <div>
                    <label htmlFor="clientName" className="block text-sm font-medium text-muted-foreground">Seu Nome</label>
                    <Input id="clientName" value={clientName} onChange={(e) => setClientName(e.target.value)} className="mt-1" required disabled={!!user}/>
                    {errors.clientName && <p className="text-destructive text-xs mt-1">{errors.clientName}</p>}
                </div>
                <div>
                    <label htmlFor="service" className="block text-sm font-medium text-muted-foreground">Serviço</label>
                    <Select onValueChange={setSelectedService} value={selectedService}>
                        <SelectTrigger id="service" className="mt-1">
                            <SelectValue placeholder="Selecione um serviço" />
                        </SelectTrigger>
                        <SelectContent>
                            {barber.services?.inShop?.active && <SelectItem value={`Corte na Barbearia|inShop`}>Corte na Barbearia (R$ {barber.services.inShop.price})</SelectItem>}
                            {barber.services?.atHome?.active && <SelectItem value={`Corte em Domicílio|atHome`}>Corte em Domicílio (R$ {barber.services.atHome.price})</SelectItem>}
                        </SelectContent>
                    </Select>
                    {errors.selectedService && <p className="text-destructive text-xs mt-1">{errors.selectedService}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                    <label htmlFor="date" className="block text-sm font-medium text-muted-foreground">Data</label>
                    <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn(
                            "w-full justify-start text-left font-normal mt-1",
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
                    <label htmlFor="time" className="block text-sm font-medium text-muted-foreground">Horário</label>
                    <Input type="time" id="time" value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)} className="mt-1" disabled={timeSlot.disabled} min={timeSlot.min} max={timeSlot.max} />
                    {errors.selectedTime && <p className="text-destructive text-xs mt-1">{errors.selectedTime}</p>}
                    {timeSlot.error && <p className="text-destructive text-xs mt-1">{timeSlot.error}</p>}
                    </div>
                </div>
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
