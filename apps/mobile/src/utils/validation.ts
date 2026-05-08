// North-American phone formatting: digits-only input → "###-###-####".
// Strips a leading "1" country code whenever there are more than 10 digits
// (e.g. "+1 (555) 555-5555", "1-555-555-5555", "15551234567 ext 12") so the
// "1" doesn't get treated as the first area-code digit.
export function formatPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('1')) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function isValidPhone(s: string): boolean {
  return s.replace(/\D/g, '').length === 10;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(s: string): boolean {
  return EMAIL_RE.test(s.trim());
}

export type ContactMethodKind = 'cell' | 'email' | 'work' | 'home' | 'other';

export function isPhoneKind(t: ContactMethodKind): boolean {
  return t === 'cell' || t === 'work' || t === 'home';
}
