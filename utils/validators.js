// ── Phone ────────────────────────────────────────────────────────────────────
// Accepts: 07XXXXXXXX, 01XXXXXXXX, +2547XXXXXXXX, +2541XXXXXXXX
function validateKenyanPhone(phone) {
  if (!phone) return false;
  const cleaned = String(phone).replace(/\s+/g, '');
  return (
    /^0[17]\d{8}$/.test(cleaned) ||           // 0712345678
    /^\+2547\d{8}$/.test(cleaned) ||           // +254712345678
    /^\+2541\d{8}$/.test(cleaned) ||           // +254112345678
    /^2547\d{8}$/.test(cleaned)  ||            // 254712345678
    /^2541\d{8}$/.test(cleaned)                // 254112345678
  );
}

function normalizeKenyanPhone(phone) {
  const cleaned = String(phone).replace(/\s+/g, '').replace(/^\+/, '');
  if (cleaned.startsWith('254') && cleaned.length === 12) return '+' + cleaned;
  if (cleaned.startsWith('0')   && cleaned.length === 10) return '+254' + cleaned.slice(1);
  if (cleaned.length === 9)                               return '+254' + cleaned;
  throw new Error('Invalid Kenyan phone number');
}

// ── Email ─────────────────────────────────────────────────────────────────────
function validateEmail(email) {
  if (!email) return false;
  // RFC 5322 simplified – must have @, a domain, and a TLD
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

// ── Password ──────────────────────────────────────────────────────────────────
// Rules: min 6 chars, at least one uppercase, one number, one special char
function validatePassword(password) {
  if (!password)                 return { valid: false, message: 'Password is required' };
  if (password.length < 6)       return { valid: false, message: 'Password must be at least 6 characters' };
  if (!/[A-Z]/.test(password))   return { valid: false, message: 'Password must contain at least one uppercase letter' };
  if (!/[0-9]/.test(password))   return { valid: false, message: 'Password must contain at least one number' };
  if (!/[!@#$%^&*()\-_=+\[\]{};:'",.<>?/\\|`~]/.test(password)) {
    return { valid: false, message: 'Password must contain at least one special character (e.g. @, #, !)' };
  }
  return { valid: true, message: 'Strong password' };
}

// Password strength score 0-4
function passwordStrength(password) {
  let score = 0;
  if (password.length >= 6)  score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password) && /[!@#$%^&*]/.test(password)) score++;
  return score; // 0=very weak, 4=strong
}

// ── Name check in password ────────────────────────────────────────────────────
function passwordContainsName(password, name) {
  if (!name) return false;
  const nameParts = name.toLowerCase().split(/\s+/);
  const pwd = password.toLowerCase();
  return nameParts.some(part => part.length >= 3 && pwd.includes(part));
}

module.exports = {
  validateKenyanPhone,
  normalizeKenyanPhone,
  validateEmail,
  validatePassword,
  passwordStrength,
  passwordContainsName,
};
