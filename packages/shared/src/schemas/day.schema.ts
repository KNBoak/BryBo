import { z } from 'zod';

export const DaySchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  notes: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const CreateDaySchema = z.object({
  user_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  notes: z.string().nullable().optional(),
});

export const UpdateDaySchema = CreateDaySchema.partial().omit({ user_id: true, date: true });

export type DayInput = z.infer<typeof CreateDaySchema>;
export type DayUpdate = z.infer<typeof UpdateDaySchema>;
