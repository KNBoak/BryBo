import type { User } from '@brybo/shared';

export const PROFILE_COLORS = [
  '#2563eb',
  '#0f766e',
  '#7e22ce',
  '#b45309',
  '#be123c',
  '#15803d',
];

export function colorForUser(user: User, index = 0): string {
  return user.color ?? PROFILE_COLORS[index % PROFILE_COLORS.length];
}

export function nextProfileColor(existingCount: number): string {
  return PROFILE_COLORS[existingCount % PROFILE_COLORS.length];
}
