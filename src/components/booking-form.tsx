'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { createBooking } from '@/app/actions';

import type { Barber } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Icons } from './icons';

const bookingSchema = z.object({
  clientName: z.string().min(1, 'Seu nome é obrigatório'),
  selectedService: z.string().min(1, 'Selecione um serviço'),
  selectedDate: z.string().min(1, 'Selecione uma data'),
  selectedTime: z.string().min(1, 'Selecione um horário'),
});

type BookingFormValues = z.infer<typeof bookingSchema>;

export function BookingForm({ barbers }: { barbers: Barber[] }) {
  const [selectedBarberId, setSelectedBarberId] = useState<string>(barbers[0]?.id || '');
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<BookingFormValues>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
        clientName: '',
        selectedService: '',
        selectedDate: '',
        selectedTime: ''
    }
  });

  const selectedBarber = useMemo(() => {
    return barbers.find(b => b.id === selectedBarberId);
  }, [barbers, selectedBarberId]);

  const onSubmit = async (data: BookingFormValues) => {
    if (!selectedBarber) return;
    setIsLoading(true);
    const result = await createBooking(selectedBarber.id, data);
    if(result.success) {
        toast({ title: "Sucesso!", description: `Agendamento com ${selectedBarber.fullName} realizado!` });
        reset();
    } else {
        toast({ title: "Erro", description: result.message, variant: "destructive" });
    }
    setIsLoading(false);
  };
  
  return (
    <>
      <div className="flex justify-end mb-4">
        <Link href="/login">
            <Button variant="outline">
                Área do Barbeiro &rarr;
            </Button>
        </Link>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        <Card className="bg-card">
          <CardHeader>
            <label htmlFor="barber-select" className="block text-sm font-medium text-muted-foreground mb-2">Escolha o Barbeiro</label>
            <Select onValueChange={setSelectedBarberId} defaultValue={selectedBarberId}>
                <SelectTrigger id="barber-select">
                    <SelectValue placeholder="Selecione um barbeiro" />
                </SelectTrigger>
                <SelectContent>
                    {barbers.map(b => <SelectItem key={b.id} value={b.id}>{b.fullName}</SelectItem>)}
                </SelectContent>
            </Select>
          </CardHeader>
          {selectedBarber && (
            <CardContent>
              <div className="flex items-center gap-4 mb-4">
                <Image src={selectedBarber.photoURL || 'https://placehold.co/80x80.png'} alt={selectedBarber.fullName} width={80} height={80} className="rounded-full object-cover" data-ai-hint="barber portrait" />
                <div>
                  <h2 className="text-2xl font-bold">{selectedBarber.fullName}</h2>
                  <p className="text-muted-foreground flex items-center gap-1"><Icons.MapPin className="h-4 w-4" /> {selectedBarber.address}</p>
                </div>
              </div>
              <p className="text-muted-foreground mb-4">{selectedBarber.description}</p>
              <div className="border-t border-border pt-4">
                <h3 className="font-semibold mb-2">Serviços Disponíveis</h3>
                {selectedBarber.services.inShop.active && <p className="text-muted-foreground">Corte na Barbearia - R$ {selectedBarber.services.inShop.price}</p>}
                {selectedBarber.services.atHome.active && <p className="text-muted-foreground">Corte em Domicílio - R$ {selectedBarber.services.atHome.price}</p>}
              </div>
            </CardContent>
          )}
        </Card>
        {selectedBarber && (
          <Card className="bg-card">
            <CardHeader>
              <CardTitle>Faça seu agendamento</CardTitle>
              <CardDescription>Preencha os detalhes abaixo para marcar seu horário.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label htmlFor="clientName" className="block text-sm font-medium text-muted-foreground">Seu Nome</label>
                  <Input id="clientName" {...register('clientName')} className="mt-1" />
                  {errors.clientName && <p className="text-destructive text-xs mt-1">{errors.clientName.message}</p>}
                </div>
                <div>
                    <label htmlFor="service" className="block text-sm font-medium text-muted-foreground">Serviço</label>
                    <Controller
                        control={control}
                        name="selectedService"
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <SelectTrigger id="service" className="mt-1">
                                    <SelectValue placeholder="Selecione um serviço" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="" disabled>Selecione um serviço</SelectItem>
                                    {selectedBarber.services.inShop.active && <SelectItem value={`Corte na Barbearia|inShop`}>Corte na Barbearia (R$ {selectedBarber.services.inShop.price})</SelectItem>}
                                    {selectedBarber.services.atHome.active && <SelectItem value={`Corte em Domicílio|atHome`}>Corte em Domicílio (R$ {selectedBarber.services.atHome.price})</SelectItem>}
                                </SelectContent>
                            </Select>
                        )}
                    />
                    {errors.selectedService && <p className="text-destructive text-xs mt-1">{errors.selectedService.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="date" className="block text-sm font-medium text-muted-foreground">Data</label>
                    <Input type="date" id="date" {...register('selectedDate')} className="mt-1" />
                    {errors.selectedDate && <p className="text-destructive text-xs mt-1">{errors.selectedDate.message}</p>}
                  </div>
                  <div>
                    <label htmlFor="time" className="block text-sm font-medium text-muted-foreground">Horário</label>
                    <Input type="time" id="time" {...register('selectedTime')} className="mt-1" />
                    {errors.selectedTime && <p className="text-destructive text-xs mt-1">{errors.selectedTime.message}</p>}
                  </div>
                </div>
                <Button type="submit" disabled={isLoading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold">
                  {isLoading && <Icons.Spinner className="mr-2" />}
                  {isLoading ? 'Agendando...' : 'Agendar Horário'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
