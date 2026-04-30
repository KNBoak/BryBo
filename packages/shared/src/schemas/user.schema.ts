import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Name is required').max(100),
  created_at: z.string().datetime(),
});

export const CreateUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
});

export type UserInput = z.infer<typeof CreateUserSchema>;
