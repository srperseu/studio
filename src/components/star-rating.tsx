
'use client';

import React from 'react';
import { Icons } from './icons';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  rating: number;
  maxRating?: number;
  size?: number;
  className?: string;
}

export function StarRating({
  rating,
  maxRating = 5,
  size = 16,
  className,
}: StarRatingProps) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 !== 0;

  return (
    <div className={cn('flex items-center gap-0.5', className)}>
      {Array.from({ length: maxRating }).map((_, index) => {
        const starValue = index + 1;
        return (
          <Icons.Star
            key={starValue}
            className={cn(
              'transition-colors',
              starValue <= rating ? 'fill-current text-primary' : 'text-muted-foreground/30'
            )}
            style={{ width: size, height: size }}
          />
        );
      })}
    </div>
  );
}
