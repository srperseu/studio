
'use client'

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { submitReviewAction } from '@/app/actions';
import type { Appointment, Review } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Icons } from './icons';
import { StarRatingInput } from './star-rating-input';
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';

const reviewSchema = z.object({
  rating: z.number().min(1, 'A avaliação por estrelas é obrigatória.'),
  comment: z.string().optional(),
  praises: z.array(z.string()).optional(),
});

type ReviewFormValues = z.infer<typeof reviewSchema>;

const PRAISE_OPTIONS = [
  'Ótimo Corte',
  'Bom de Papo',
  'Mão Leve',
  'Ambiente Limpo',
  'Pontualidade',
  'Estiloso',
];

interface ReviewFormProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment & { barberId?: string };
  onSubmitSuccess: () => void;
}

export function ReviewForm({ isOpen, onClose, appointment, onSubmitSuccess }: ReviewFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedPraises, setSelectedPraises] = useState<string[]>([]);
  
  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      rating: 0,
      comment: '',
      praises: [],
    },
  });

  const {
    handleSubmit,
    control,
    register,
    setValue,
    watch,
    formState: { isSubmitting, errors },
  } = form;

  const rating = watch('rating');

  const togglePraise = (praise: string) => {
    setSelectedPraises((prev) =>
      prev.includes(praise) ? prev.filter((p) => p !== praise) : [...prev, praise]
    );
  };
  
  React.useEffect(() => {
      setValue('praises', selectedPraises);
  }, [selectedPraises, setValue])

  const onSubmit = async (data: ReviewFormValues) => {
    if (!user || !appointment.barberId) {
      toast({ title: 'Erro', description: 'Não foi possível enviar a avaliação.', variant: 'destructive' });
      return;
    }

    const reviewData: Omit<Review, 'id' | 'createdAt' | 'barberId'> = {
      ...data,
      clientUid: user.uid,
      clientName: user.displayName || 'Anônimo',
      appointmentId: appointment.id,
    };

    const result = await submitReviewAction(appointment.barberId, appointment.id, reviewData);
    if (result.success) {
      toast({ title: 'Sucesso', description: 'Sua avaliação foi enviada!' });
      onSubmitSuccess();
    } else {
      toast({ title: 'Erro', description: result.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle>Avalie o Serviço</DialogTitle>
          <DialogDescription>
            Seu feedback ajuda outros clientes e o profissional a melhorar.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label className="font-medium">Sua nota</label>
            <StarRatingInput
              rating={rating}
              onRatingChange={(newRating) => setValue('rating', newRating, { shouldValidate: true })}
            />
            {errors.rating && <p className="text-sm text-destructive mt-1">{errors.rating.message}</p>}
          </div>

          <div>
            <label htmlFor="comment" className="font-medium">
              Seu comentário (opcional)
            </label>
            <Textarea
              id="comment"
              {...register('comment')}
              placeholder="Conte como foi sua experiência..."
              className="mt-1"
            />
          </div>

          <div>
            <label className="font-medium">Elogios (opcional)</label>
            <div className="flex flex-wrap gap-2 mt-2">
              {PRAISE_OPTIONS.map((praise) => (
                <Badge
                  key={praise}
                  variant="outline"
                  onClick={() => togglePraise(praise)}
                  className={cn(
                    'cursor-pointer hover:bg-muted',
                    selectedPraises.includes(praise) &&
                      'bg-primary text-primary-foreground hover:bg-primary/90'
                  )}
                >
                  {praise}
                </Badge>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Icons.Spinner /> : 'Enviar Avaliação'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
