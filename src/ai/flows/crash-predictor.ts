'use server';
/**
 * @fileOverview Crash prediction AI agent.
 *
 * - predictCrashPoint - A function that predicts the crash point for the game.
 * - PredictCrashPointInput - The input type for the predictCrashPoint function.
 * - PredictCrashPointOutput - The return type for the predictCrashPoint function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PredictCrashPointInputSchema = z.object({
  roundHistory: z
    .array(
      z.object({
        finalMultiplier: z.number(),
        timestamp: z.string(),
      })
    )
    .describe('History of recent rounds, including the final multiplier and timestamp.'),
  currentPot: z.number().describe('The current total pot size for the round.'),
  averageCashoutMultiplier: z
    .number()
    .describe('Average cashout multiplier from previous rounds.'),
});
export type PredictCrashPointInput = z.infer<typeof PredictCrashPointInputSchema>;

const PredictCrashPointOutputSchema = z.object({
  predictedCrashPoint: z
    .number()
    .describe(
      'The predicted crash point multiplier.  This value should be greater than 1.0.
      The prediction should add excitement and dynamic volatility to the game.'
    ),
  reasoning: z.string().describe('The reasoning behind the predicted crash point.'),
});
export type PredictCrashPointOutput = z.infer<typeof PredictCrashPointOutputSchema>;

export async function predictCrashPoint(input: PredictCrashPointInput): Promise<PredictCrashPointOutput> {
  return predictCrashPointFlow(input);
}

const prompt = ai.definePrompt({
  name: 'predictCrashPointPrompt',
  input: {schema: PredictCrashPointInputSchema},
  output: {schema: PredictCrashPointOutputSchema},
  prompt: `You are an AI game developer specializing in creating engaging and dynamic casino games.

You are designing the crash point logic for a crypto crash game. Your goal is to predict the next crash point based on the game's recent history and current state to add excitement and dynamic volatility.

Here is the recent round history:
{{#each roundHistory}}
  - Round at {{timestamp}}: crashed at {{finalMultiplier}}x
{{/each}}

The current total pot size is {{currentPot}}.
The average cashout multiplier from previous rounds is {{averageCashoutMultiplier}}.

Consider these factors to determine a crash point that is both plausible and exciting for the players.

It is very important that the predictedCrashPoint is greater than 1.0.  It is also very important that you justify your reasoning in the reasoning field.  Your job is to create fun and exciting gameplay.

Output:
{{output hints=PredictCrashPointOutputSchema}}`,
});

const predictCrashPointFlow = ai.defineFlow(
  {
    name: 'predictCrashPointFlow',
    inputSchema: PredictCrashPointInputSchema,
    outputSchema: PredictCrashPointOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
