import { z } from 'zod';

export const ContactMethodTypeSchema = z.enum(['cell', 'email', 'work', 'home', 'other']);

export const ContactMethodSchema = z.object({
  id: z.string().uuid(),
  contact_id: z.string().uuid(),
  type: ContactMethodTypeSchema,
  value: z.string().min(1, 'Value is required').max(200),
  label: z.string().max(50).nullable(),
  is_primary: z.boolean(),
});

export const CreateContactMethodSchema = z.object({
  contact_id: z.string().uuid(),
  type: ContactMethodTypeSchema,
  value: z.string().min(1, 'Value is required').max(200),
  label: z.string().max(50).nullable().optional(),
  is_primary: z.boolean().optional().default(false),
});

export type ContactMethodInput = z.infer<typeof CreateContactMethodSchema>;
