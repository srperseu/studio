'use server';
/**
 * @fileOverview This file defines a Genkit flow for generating a barber bio using AI.
 *
 * - generateBarberBio - A function that generates a barber bio based on input keywords.
 * - GenerateBarberBioInput - The input type for the generateBarberBio function.
 * - GenerateBarberBioOutput - The return type for the generateBarberBio function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateBarberBioInputSchema = z.object({
  keywords: z
    .string()
    .describe("Keywords describing the barber's expertise, e.g., 'classic cuts', 'beard trimming'."),
});
export type GenerateBarberBioInput = z.infer<typeof GenerateBarberBioInputSchema>;

const GenerateBarberBioOutputSchema = z.object({
  bio: z.string().describe('A professional and attractive bio for the barber.'),
});
export type GenerateBarberBioOutput = z.infer<typeof GenerateBarberBioOutputSchema>;

export async function generateBarberBio(input: GenerateBarberBioInput): Promise<GenerateBarberBioOutput> {
  return generateBarberBioFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateBarberBioPrompt',
  input: {schema: GenerateBarberBioInputSchema},
  output: {schema: GenerateBarberBioOutputSchema},
  prompt: `Você é um especialista em marketing para barbearias. Crie uma biografia curta (2-3 frases) e atraente para um barbeiro especialista em "{{{keywords}}}". Use um tom profissional, moderno e convidativo. Retorne apenas o texto da biografia em português.`,
});

const generateBarberBioFlow = ai.defineFlow(
  {
    name: 'generateBarberBioFlow',
    inputSchema: GenerateBarberBioInputSchema,
    outputSchema: GenerateBarberBioOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
