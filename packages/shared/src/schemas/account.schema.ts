import { z } from 'zod';

export const AccountSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string().min(1, 'Account name is required').max(200),
  city: z.string().max(100).nullable(),
  state: z.string().max(50).nullable(),
  address: z.string().max(300).nullable(),
  phone: z.string().max(30).nullable(),
  website: z.string().max(300).nullable(),
  notes: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const CreateAccountSchema = z.object({
  user_id: z.string().uuid(),
  name: z.string().min(1, 'Account name is required').max(200),
  city: z.string().max(100).nullable().optional(),
  state: z.string().max(50).nullable().optional(),
  address: z.string().max(300).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  website: z.string().max(300).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const UpdateAccountSchema = CreateAccountSchema.partial().omit({ user_id: true });

export type AccountInput = z.infer<typeof CreateAccountSchema>;
export type AccountUpdate = z.infer<typeof UpdateAccountSchema>;
