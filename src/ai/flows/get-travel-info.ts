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
import { getDistanceMatrix, GetTravelInfoOutputSchema as ToolOutputSchema } from '../tools/google-maps';

export const GetTravelInfoOutputSchema = ToolOutputSchema;
export type GetTravelInfoOutput = z.infer<typeof GetTravelInfoOutputSchema>;


export const GetTravelInfoInputSchema = z.object({
  originLat: z.number().describe("The latitude of the origin."),
  originLng: z.number().describe("The longitude of the origin."),
  destinationLat: z.number().describe("The latitude of the destination."),
  destinationLng: z.number().describe("The longitude of the destination."),
});
export type GetTravelInfoInput = z.infer<typeof GetTravelInfoInputSchema>;


export async function getTravelInfo(input: GetTravelInfoInput): Promise<GetTravelInfoOutput> {
  return getTravelInfoFlow(input);
}

const getTravelInfoFlow = ai.defineFlow(
  {
    name: 'getTravelInfoFlow',
    inputSchema: GetTravelInfoInputSchema,
    outputSchema: GetTravelInfoOutputSchema,
    tools: [getDistanceMatrix],
  },
  async (input) => {
    
    const llmResponse = await ai.generate({
      prompt: `What is the distance and duration between origin ${input.originLat},${input.originLng} and destination ${input.destinationLat},${input.destinationLng}?`,
      tools: [getDistanceMatrix],
      model: 'googleai/gemini-2.0-flash'
    });

    const toolResponse = llmResponse.toolRequest?.output;
    if (!toolResponse) {
        throw new Error('Tool did not execute or returned no response.');
    }
    
    const travelInfo = toolResponse[0]?.result;

    if (!travelInfo || !travelInfo.distance || !travelInfo.duration) {
      throw new Error('Failed to get travel information from the tool.');
    }

    return {
      distance: travelInfo.distance,
      duration: travelInfo.duration,
    };
  }
);
