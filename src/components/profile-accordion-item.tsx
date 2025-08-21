"use client";

import React from 'react';
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from './ui/button';
import { Icons } from './icons';

interface ProfileAccordionItemProps {
  value: string;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  isDirty: boolean;
  onSave: () => void;
  isSaving: boolean;
}

export function ProfileAccordionItem({
  value,
  title,
  icon,
  children,
  isDirty,
  onSave,
  isSaving
}: ProfileAccordionItemProps) {
  return (
    <AccordionItem value={value} className="bg-card border-none shadow-md rounded-lg p-2">
      <AccordionTrigger className="text-xl font-semibold text-primary px-4">
        {icon}
        <span>{title}</span>
        {isDirty && <span className="text-destructive ml-1">*</span>}
      </AccordionTrigger>
      <AccordionContent className="p-4 space-y-4">
        {children}
        {isDirty && (
          <div className="flex justify-end pt-4 border-t border-border">
            <Button type="button" onClick={onSave} disabled={isSaving}>
              {isSaving ? <Icons.Spinner /> : 'Salvar Alterações'}
            </Button>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
