'use server';

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import {GetTravelInfoOutputSchema} from '../flows/get-travel-info';

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

export const getDistanceMatrix = ai.defineTool(
  {
    name: 'getDistanceMatrix',
    description: 'Get the travel distance and duration between an origin and a destination.',
    inputSchema: z.object({
      originLat: z.number(),
      originLng: z.number(),
      destinationLat: z.number(),
      destinationLng: z.number(),
    }),
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
