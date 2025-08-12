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
  prompt: `You are an expert in marketing for barbershops. Create a short (2-3 sentences)\n  and attractive bio for a barber specializing in "{{{keywords}}}". Use a professional,\n  modern, and inviting tone. Return only the text of the bio.`, 
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
