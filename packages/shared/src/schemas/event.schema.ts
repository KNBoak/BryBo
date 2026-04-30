import { z } from 'zod';

export const EventSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  day_id: z.string().uuid(),
  type: z.string().min(1, 'Event type is required').max(100),
  notes: z.string().nullable(),
  amount: z.number().positive().nullable(),
  is_cancelled: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const CreateEventSchema = z.object({
  user_id: z.string().uuid(),
  day_id: z.string().uuid(),
  type: z.string().min(1, 'Event type is required').max(100),
  notes: z.string().nullable().optional(),
  amount: z.number().positive().nullable().optional(),
  is_cancelled: z.boolean().optional().default(false),
});

export const UpdateEventSchema = CreateEventSchema.partial().omit({ user_id: true });

export type EventInput = z.infer<typeof CreateEventSchema>;
export type EventUpdate = z.infer<typeof UpdateEventSchema>;
