import { supabase } from './supabase'
import { dayConfig, isClosedByClosure } from './businessHours'
import type { BusinessHour, Closure } from './businessHours'

export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show' | 'paid'
export type AppointmentSource = 'online' | 'internal'

export type AppointmentInput = {
  client_id: string | null
  service_id: string | null
  barber_id: string
  starts_at: string
  ends_at: string
  status: AppointmentStatus
  source: AppointmentSource
  notes: string | null
  is_block: boolean
}

/** Rendez-vous avec ses relations jointes (pour l'affichage). */
export type Appointment = AppointmentInput & {
  id: string
  created_at: string
  client: { first_name: string; last_name: string | null; phone: string | null } | null
  service: { name: string; price_cents: number; duration_min: number } | null
  barber: { name: string; color: string } | null
}

const SELECT =
  '*, client:clients(first_name,last_name,phone), service:services(name,price_cents,duration_min), barber:barbers(name,color)'

export async function listAppointmentsBetween(startISO: string, endISO: string): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select(SELECT)
    .gte('starts_at', startISO)
    .lt('starts_at', endISO)
    .order('starts_at')
  if (error) throw error
  return (data ?? []) as unknown as Appointment[]
}

export async function listAppointmentsForClient(clientId: string): Promise<Appointment[]> {
  const { data, error } = await supabase
    .from('appointments')
    .select(SELECT)
    .eq('client_id', clientId)
    .order('starts_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as Appointment[]
}

export async function createAppointment(input: AppointmentInput): Promise<void> {
  const { error } = await supabase.from('appointments').insert(input)
  if (error) throw error
}

export async function updateAppointment(id: string, input: Partial<AppointmentInput>): Promise<void> {
  const { error } = await supabase.from('appointments').update(input).eq('id', id)
  if (error) throw error
}

export async function deleteAppointment(id: string): Promise<void> {
  const { error } = await supabase.from('appointments').delete().eq('id', id)
  if (error) throw error
}

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: 'En attente',
  confirmed: 'Confirmé',
  cancelled: 'Annulé',
  completed: 'Terminé',
  no_show: 'Absence',
  paid: 'Payé',
}

/**
 * Valide un créneau : heures d'ouverture, congés, conflits.
 * Retourne un message d'erreur, ou null si le créneau est valide.
 */
export function validateSlot(
  start: Date,
  end: Date,
  barberId: string,
  ctx: { hours: BusinessHour[]; closures: Closure[]; appointments: Appointment[]; excludeId?: string },
): string | null {
  if (isClosedByClosure(start, ctx.closures, barberId)) {
    return 'Le salon (ou ce barbier) est en congé à cette date.'
  }
  const cfg = dayConfig(start, ctx.hours)
  if (cfg.closed) return 'Le salon est fermé ce jour-là.'

  const startMin = start.getHours() * 60 + start.getMinutes()
  const endMin = end.getHours() * 60 + end.getMinutes()
  if (startMin < cfg.openMin || endMin > cfg.closeMin) {
    return 'Le créneau est en dehors des heures d’ouverture.'
  }

  const s = start.getTime()
  const e = end.getTime()
  const conflict = ctx.appointments.some((a) => {
    if (a.id === ctx.excludeId) return false
    if (a.barber_id !== barberId) return false
    if (a.status === 'cancelled') return false
    const as = new Date(a.starts_at).getTime()
    const ae = new Date(a.ends_at).getTime()
    return s < ae && e > as
  })
  if (conflict) return 'Conflit avec un autre rendez-vous de ce barbier.'

  return null
}
