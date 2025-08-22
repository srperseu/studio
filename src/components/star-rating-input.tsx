
'use client';

import React from 'react';
import { Icons } from './icons';
import { cn } from '@/lib/utils';

interface StarRatingInputProps {
  rating: number;
  onRatingChange: (rating: number) => void;
  maxRating?: number;
  size?: number;
}

export function StarRatingInput({
  rating,
  onRatingChange,
  maxRating = 5,
  size = 28,
}: StarRatingInputProps) {
  const [hoverRating, setHoverRating] = React.useState(0);

  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: maxRating }).map((_, index) => {
        const starValue = index + 1;
        return (
          <button
            type="button"
            key={starValue}
            onClick={() => onRatingChange(starValue)}
            onMouseEnter={() => setHoverRating(starValue)}
            onMouseLeave={() => setHoverRating(0)}
            className="p-1 text-primary transition-transform duration-150 ease-in-out hover:scale-125 focus:outline-none"
          >
            <Icons.Star
              className={cn(
                'transition-colors',
                (hoverRating >= starValue || rating >= starValue)
                  ? 'fill-current text-primary'
                  : 'text-muted-foreground/50'
              )}
              style={{ width: size, height: size }}
            />
          </button>
        );
      })}
    </div>
  );
}
