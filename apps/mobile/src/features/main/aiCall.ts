import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `You are an AI sales-CRM assistant helping the user prepare for or recap a workday. You will receive: the user's name, the date they're viewing, today's date, the day's logged events (each marked todo or done, with optional sale amounts and linked accounts/contacts), and recent history for every account and contact linked to those events.

Your job: surface what the user should know. Lead with the highest-leverage items first.

- For TODOs on today/future dates: prep notes — anything from prior interactions worth raising, names to greet by relationship details, open threads with that account or contact.
- For DONE items: flag follow-ups the day's events imply (a sale that should trigger a thank-you, a meeting that referenced sending samples, a quoted account that hasn't ordered).
- For past dates: a brief recap of what happened, plus what the user should remember next time they touch these accounts/contacts.

Be concise. Bullet points only. No preamble, no apologies, no restating the data the user just gave you. Skip sections that aren't relevant. Aim for 150–300 words total.`;

export interface AiCallArgs {
  apiKey: string;
  context: string;
  signal?: AbortSignal;
}

export class AiAuthError extends Error {}
export class AiRateLimitError extends Error {}
export class AiNetworkError extends Error {}
export class AiServerError extends Error {}

/**
 * One-shot Claude call. Caches the system prompt (stable across calls) so
 * repeat invocations within the 5-minute cache window pay reduced input cost.
 */
export async function runAiAssist({ apiKey, context, signal }: AiCallArgs): Promise<string> {
  const client = new Anthropic({
    apiKey,
    dangerouslyAllowBrowser: true, // React Native runtime; keys are stored in expo-secure-store
  });

  try {
    const res = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      thinking: { type: 'adaptive' },
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: context }],
    }, signal ? { signal } : undefined);

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n\n');
    return text.trim() || '(empty response)';
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      throw new AiAuthError('Authentication failed — check your API key.');
    }
    if (e instanceof Anthropic.RateLimitError) {
      throw new AiRateLimitError('Rate limited — wait a moment and try again.');
    }
    if (e instanceof Anthropic.APIError) {
      const status = e.status ?? 0;
      if (status >= 500) {
        throw new AiServerError(`Anthropic service error (${status}). Try again shortly.`);
      }
      throw new Error(e.message);
    }
    throw new AiNetworkError(`Network error: ${(e as Error).message}`);
  }
}
