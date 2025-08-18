'use server';
/**
 * @fileOverview A Genkit flow for getting travel distance and duration using the Google Maps Distance Matrix API.
 *
 * - getTravelInfo - A function that gets the travel info between an origin and a destination.
 * - GetTravelInfoInput - The input type for the getTravelInfo function.
 * - GetTravelInfoOutput - The return type for the getTravelInfo function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Schemas and Types
const GetTravelInfoInputSchema = z.object({
  originLat: z.number().describe("The latitude of the origin."),
  originLng: z.number().describe("The longitude of the origin."),
  destinationLat: z.number().describe("The latitude of the destination."),
  destinationLng: z.number().describe("The longitude of the destination."),
});
export type GetTravelInfoInput = z.infer<typeof GetTravelInfoInputSchema>;

const GetTravelInfoOutputSchema = z.object({
    distance: z.string().describe("The total distance of the route."),
    duration: z.string().describe("The total duration of the route."),
});
export type GetTravelInfoOutput = z.infer<typeof GetTravelInfoOutputSchema>;


// Helper function to call Google Maps API
async function fetchDistanceMatrix(origin: string, destination: string, apiKey: string) {
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destination}&key=${apiKey}&units=metric&language=pt-BR`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.status === 'OK' && data.rows[0].elements[0].status === 'OK') {
      return {
        distance: data.rows[0].elements[0].distance.text,
        duration: data.rows[0].elements[0].duration.text,
      };
    }
    console.error('Distance Matrix API Error:', data.error_message || data.status);
    return null;
  } catch (error) {
    console.error('Error fetching distance matrix data:', error);
    return null;
  }
}

// Exported wrapper function
export async function getTravelInfo(input: GetTravelInfoInput): Promise<GetTravelInfoOutput> {
  return getTravelInfoFlow(input);
}

// Genkit Flow Definition
const getTravelInfoFlow = ai.defineFlow(
  {
    name: 'getTravelInfoFlow',
    inputSchema: GetTravelInfoInputSchema,
    outputSchema: GetTravelInfoOutputSchema,
  },
  async (input) => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      throw new Error('Google Maps API key is not configured.');
    }
    const origin = `${input.originLat},${input.originLng}`;
    const destination = `${input.destinationLat},${input.destinationLng}`;
    
    const result = await fetchDistanceMatrix(origin, destination, apiKey);
    if (!result) {
      throw new Error('Failed to retrieve distance matrix data.');
    }

    return result;
  }
);
