export interface PasswordStrengthResult {
  score: number; // 0 to 4
  label: 'Too Short' | 'Weak' | 'Fair' | 'Good' | 'Strong';
  checks: {
    minLength: boolean;
    hasUpper: boolean;
    hasLower: boolean;
    hasNumber: boolean;
    hasSpecial: boolean;
  };
}

export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const checks = {
    minLength: password.length >= 8,
    hasUpper: /[A-Z]/.test(password),
    hasLower: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password)
  };

  if (!checks.minLength) {
    return { score: 0, label: 'Too Short', checks };
  }

  let score = 1;
  if (checks.hasUpper && checks.hasLower) score += 1;
  if (checks.hasNumber) score += 1;
  if (checks.hasSpecial || password.length >= 12) score += 1;

  const labels: Record<number, PasswordStrengthResult['label']> = {
    1: 'Weak',
    2: 'Fair',
    3: 'Good',
    4: 'Strong'
  };

  return {
    score,
    label: labels[score] || 'Weak',
    checks
  };
}

export function isValidEmailAddress(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
