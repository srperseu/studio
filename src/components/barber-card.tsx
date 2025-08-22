
'use client';

import Image from 'next/image';
import type { Barber } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Icons } from './icons';
import { Badge } from './ui/badge';
import { StarRating } from './star-rating';


interface BarberWithDistance extends Barber {
    distanceText?: string;
}

interface BarberCardProps {
    barber: BarberWithDistance;
    onSelect: (barber: BarberWithDistance) => void;
}

export function BarberCard({ barber, onSelect }: BarberCardProps) {
    return (
        <Card className="flex flex-col bg-card border shadow-lg transition-all hover:shadow-xl hover:-translate-y-1">
            <CardHeader className="flex flex-row items-start gap-4">
                <Image
                    src={barber.photoURL || 'https://placehold.co/80x80.png'}
                    alt={`Foto de ${barber.fullName}`}
                    width={80}
                    height={80}
                    className="rounded-full object-cover border-2 border-border"
                    data-ai-hint="barber portrait"
                />
                <div className="flex-grow">
                    <CardTitle>{barber.fullName}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                       {barber.ratingAverage && barber.reviewCount ? (
                            <Badge variant="secondary" className="flex items-center gap-1 bg-amber-500 text-black">
                               <Icons.Star className="h-3 w-3 fill-current" />
                               <span>{barber.ratingAverage.toFixed(1)}</span>
                               <span className="text-muted-foreground/80 ml-1">({barber.reviewCount})</span>
                            </Badge>
                       ) : (
                           <Badge variant="outline">Novo</Badge>
                       )}
                    </div>
                    {barber.distanceText && (
                        <Badge variant="secondary" className="mt-2">
                           ~ {barber.distanceText}
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="flex-grow">
                 <CardDescription className="flex items-center gap-1 mb-2">
                        <Icons.MapPin className="h-4 w-4 flex-shrink-0" />
                        <span>{barber.address?.city} - {barber.address?.state}</span>
                </CardDescription>
                <p className="text-muted-foreground line-clamp-3">
                    {barber.description || 'Este barbeiro ainda não adicionou uma descrição.'}
                </p>
            </CardContent>
            <CardFooter>
                <Button className="w-full" onClick={() => onSelect(barber)}>
                    <Icons.Scissors className="mr-2 h-4 w-4" />
                    Ver Perfil e Agendar
                </Button>
            </CardFooter>
        </Card>
    )
}
