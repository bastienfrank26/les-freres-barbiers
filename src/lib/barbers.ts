import { supabase } from './supabase'

export type BarberRole = 'admin' | 'barber'

export type Barber = {
  id: string
  name: string
  color: string
  is_active: boolean
  created_at: string
  role: BarberRole
  user_id: string | null
  email: string | null
  must_change_password: boolean
}

export type BarberInput = { name: string; is_active: boolean }

const EMAIL_DOMAIN = 'les-freres-barbiers.com'

/** Normalise un segment de nom pour l'adresse courriel (sans accents/espaces). */
function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Construit l'adresse prenom.nom@les-freres-barbiers.com. */
export function barberEmail(firstName: string, lastName: string): string {
  return `${slug(firstName)}.${slug(lastName)}@${EMAIL_DOMAIN}`
}

export async function listBarbers(): Promise<Barber[]> {
  const { data, error } = await supabase.from('barbers').select('*').order('name')
  if (error) throw error
  return data ?? []
}

export async function listActiveBarbers(): Promise<Barber[]> {
  const { data, error } = await supabase.from('barbers').select('*').eq('is_active', true).order('name')
  if (error) throw error
  return data ?? []
}

/**
 * (Admin) Crée un barbier AVEC son compte de connexion.
 * Le courriel est dérivé du prénom et du nom ; le mot de passe est le mot de
 * passe temporaire « Barbier123 » à changer à la première connexion.
 * Retourne l'adresse courriel générée.
 */
export async function createBarberWithAccount(
  firstName: string,
  lastName: string,
  tempPassword: string,
  role: BarberRole = 'barber',
): Promise<string> {
  const email = barberEmail(firstName, lastName)
  const name = `${firstName.trim()} ${lastName.trim()}`.trim()
  const { error } = await supabase.rpc('admin_create_barber', {
    p_name: name,
    p_email: email,
    p_password: tempPassword,
    p_role: role,
  })
  if (error) throw error
  return email
}

export async function updateBarber(id: string, input: Partial<BarberInput>): Promise<void> {
  const { error } = await supabase.from('barbers').update(input).eq('id', id)
  if (error) throw error
}

export async function deleteBarber(id: string): Promise<void> {
  const { error } = await supabase.from('barbers').delete().eq('id', id)
  if (error) throw error
}

/* ---------- rôles & comptes de connexion ---------- */

/** Rôle de l'utilisateur connecté ('admin' | 'barber' | null si pas de barbier lié). */
export async function getMyRole(): Promise<BarberRole | null> {
  const { data, error } = await supabase.rpc('current_barber_role')
  if (error) throw error
  return (data as BarberRole | null) ?? null
}

/** Barbier rattaché au compte connecté (null si aucun). */
export async function getMyBarber(): Promise<Barber | null> {
  const { data: auth } = await supabase.auth.getUser()
  const userId = auth.user?.id
  if (!userId) return null
  const { data, error } = await supabase.from('barbers').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw error
  return data ?? null
}

/** (Admin) Crée un compte de connexion et le rattache à un barbier existant. */
export async function createAccountForBarber(barberId: string, email: string, password: string, role: BarberRole): Promise<void> {
  const { error } = await supabase.rpc('admin_create_account_for_barber', {
    p_barber_id: barberId,
    p_email: email,
    p_password: password,
    p_role: role,
  })
  if (error) throw error
}

/** (Admin) Réinitialise le mot de passe du compte d'un barbier. */
export async function setBarberPassword(barberId: string, password: string): Promise<void> {
  const { error } = await supabase.rpc('admin_set_barber_password', { p_barber_id: barberId, p_password: password })
  if (error) throw error
}

/** (Admin) Change le rôle d'un barbier. */
export async function setBarberRole(barberId: string, role: BarberRole): Promise<void> {
  const { error } = await supabase.rpc('admin_set_barber_role', { p_barber_id: barberId, p_role: role })
  if (error) throw error
}

/** Change son propre mot de passe (utilisateur connecté). */
export async function changeMyPassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
}

/** Efface le drapeau « doit changer son mot de passe » de l'utilisateur connecté. */
export async function clearMyPasswordChangeFlag(): Promise<void> {
  const { error } = await supabase.rpc('clear_my_password_change_flag')
  if (error) throw error
}
