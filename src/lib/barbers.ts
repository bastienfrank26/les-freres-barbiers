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
}

export type BarberInput = { name: string; color: string; is_active: boolean }

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

export async function createBarber(input: BarberInput): Promise<void> {
  const { error } = await supabase.from('barbers').insert(input)
  if (error) throw error
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
