
'use client';

import Image from 'next/image';
import type { Barber } from '@/lib/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Icons } from './icons';
import { Badge } from './ui/badge';

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
                    <CardDescription className="flex items-center gap-1 mt-1">
                        <Icons.MapPin className="h-4 w-4 flex-shrink-0" />
                        <span>{barber.address?.city} - {barber.address?.state}</span>
                    </CardDescription>
                    {barber.distanceText && (
                        <Badge variant="secondary" className="mt-2">
                           ~ {barber.distanceText}
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="flex-grow">
                <p className="text-muted-foreground line-clamp-3">
                    {barber.description || 'Este barbeiro ainda não adicionou uma descrição.'}
                </p>
            </CardContent>
            <CardFooter>
                <Button className="w-full" onClick={() => onSelect(barber)}>
                    <Icons.Scissors className="mr-2 h-4 w-4" />
                    Agendar
                </Button>
            </CardFooter>
        </Card>
    )
}
