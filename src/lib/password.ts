/** Mot de passe temporaire attribué à la création d'un compte barbier. */
export const TEMP_PASSWORD = 'Barbier123'

/** Critères de sécurité élevés exigés au choix d'un nouveau mot de passe. */
export const PASSWORD_RULES: { label: string; test: (p: string) => boolean }[] = [
  { label: 'Au moins 10 caractères', test: (p) => p.length >= 10 },
  { label: 'Une lettre minuscule', test: (p) => /[a-z]/.test(p) },
  { label: 'Une lettre majuscule', test: (p) => /[A-Z]/.test(p) },
  { label: 'Un chiffre', test: (p) => /\d/.test(p) },
  { label: 'Un caractère spécial', test: (p) => /[^A-Za-z0-9]/.test(p) },
]

/** Retourne un message d'erreur si le mot de passe ne respecte pas les critères, sinon null. */
export function validateStrongPassword(password: string): string | null {
  const failing = PASSWORD_RULES.filter((r) => !r.test(password))
  if (failing.length === 0) return null
  return 'Le mot de passe doit respecter : ' + failing.map((r) => r.label.toLowerCase()).join(', ') + '.'
}
