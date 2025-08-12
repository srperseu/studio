'use server';

/**
 * @fileOverview An AI agent for generating appointment reminders for barbers.
 *
 * - generateAppointmentReminder - A function that generates a reminder message for an appointment.
 * - GenerateReminderInput - The input type for the generateAppointmentReminder function.
 * - GenerateReminderOutput - The return type for the generateAppointmentReminder function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateReminderInputSchema = z.object({
  clientName: z.string().describe('The name of the client.'),
  service: z.string().describe('The service the client has booked.'),
  date: z.string().describe('The date of the appointment in ISO format.'),
  time: z.string().describe('The time of the appointment.'),
  barberName: z.string().describe('The name of the barber.'),
});
export type GenerateReminderInput = z.infer<typeof GenerateReminderInputSchema>;

const GenerateReminderOutputSchema = z.object({
  reminderText: z.string().describe('The generated reminder message.'),
});
export type GenerateReminderOutput = z.infer<typeof GenerateReminderOutputSchema>;

export async function generateAppointmentReminder(input: GenerateReminderInput): Promise<GenerateReminderOutput> {
  return generateAppointmentReminderFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateAppointmentReminderPrompt',
  input: {schema: GenerateReminderInputSchema},
  output: {schema: GenerateReminderOutputSchema},
  prompt: `Crie uma mensagem de lembrete amigável e concisa para um agendamento de barbearia, para ser enviada por WhatsApp.

- Cliente: {{{clientName}}}
- Serviço: {{{service}}}
- Data: {{{date}}}
- Hora: {{{time}}}
- Barbearia de: {{{barberName}}}

Seja cordial e peça para o cliente confirmar a presença. Retorne apenas o texto da mensagem.`,
});

const generateAppointmentReminderFlow = ai.defineFlow(
  {
    name: 'generateAppointmentReminderFlow',
    inputSchema: GenerateReminderInputSchema,
    outputSchema: GenerateReminderOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
