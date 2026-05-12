const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\+?[\d\s\-()]{10,20}$/;

export function validateEmail(email: string): string | null {
  const v = (email || "").trim();
  if (!v) return "Email is required";
  if (!EMAIL_REGEX.test(v)) return "Invalid email format";
  return null;
}

export function validatePhone(phone: string): string | null {
  const v = (phone || "").trim();
  if (!v) return null; // optional
  const digits = v.replace(/\D/g, "");
  if (digits.length < 10) return "Phone must have at least 10 digits";
  if (!PHONE_REGEX.test(v)) return "Invalid phone format";
  return null;
}
