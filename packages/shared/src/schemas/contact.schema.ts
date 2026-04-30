import { z } from 'zod';

export const ContactSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  account_id: z.string().uuid().nullable(),
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
  title: z.string().max(150).nullable(),
  notes: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export const CreateContactSchema = z.object({
  user_id: z.string().uuid(),
  account_id: z.string().uuid().nullable().optional(),
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
  title: z.string().max(150).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const UpdateContactSchema = CreateContactSchema.partial().omit({ user_id: true });

export type ContactInput = z.infer<typeof CreateContactSchema>;
export type ContactUpdate = z.infer<typeof UpdateContactSchema>;
