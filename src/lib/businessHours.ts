import { supabase } from './supabase'
import { timeToMinutes, weekdayIndex, ymd } from './datetime'

export type BusinessHour = {
  id: string
  weekday: number
  open_time: string | null
  close_time: string | null
  is_closed: boolean
}

export type Closure = {
  id: string
  date: string
  reason: string | null
  barber_id: string | null
}

export async function listBusinessHours(): Promise<BusinessHour[]> {
  const { data, error } = await supabase.from('business_hours').select('*').order('weekday')
  if (error) throw error
  return data ?? []
}

export async function updateBusinessHour(
  id: string,
  input: { open_time: string | null; close_time: string | null; is_closed: boolean },
): Promise<void> {
  const { error } = await supabase.from('business_hours').update(input).eq('id', id)
  if (error) throw error
}

export async function listClosures(): Promise<Closure[]> {
  const { data, error } = await supabase.from('closures').select('*').order('date')
  if (error) throw error
  return data ?? []
}

export async function createClosure(input: { date: string; reason: string | null; barber_id: string | null }): Promise<void> {
  const { error } = await supabase.from('closures').insert(input)
  if (error) throw error
}

export async function deleteClosure(id: string): Promise<void> {
  const { error } = await supabase.from('closures').delete().eq('id', id)
  if (error) throw error
}

export type DayConfig = { closed: boolean; openMin: number; closeMin: number }

/** Heures d'ouverture effectives d'une journée (en minutes depuis minuit). */
export function dayConfig(date: Date, hours: BusinessHour[]): DayConfig {
  const wd = weekdayIndex(date)
  const h = hours.find((x) => x.weekday === wd)
  if (!h || h.is_closed || !h.open_time || !h.close_time) {
    return { closed: true, openMin: 0, closeMin: 0 }
  }
  return { closed: false, openMin: timeToMinutes(h.open_time), closeMin: timeToMinutes(h.close_time) }
}

/** Vrai si un congé/fermeture couvre la date (pour ce barbier ou tout le salon). */
export function isClosedByClosure(date: Date, closures: Closure[], barberId?: string | null): boolean {
  const ds = ymd(date)
  return closures.some((c) => c.date === ds && (c.barber_id == null || c.barber_id === barberId))
}

/** Plage horaire d'affichage de la grille (min ouverture / max fermeture sur la semaine). */
export function gridRange(hours: BusinessHour[]): { startMin: number; endMin: number } {
  const open = hours.filter((h) => !h.is_closed && h.open_time && h.close_time)
  if (open.length === 0) return { startMin: 8 * 60, endMin: 20 * 60 }
  const startMin = Math.min(...open.map((h) => timeToMinutes(h.open_time!)))
  const endMin = Math.max(...open.map((h) => timeToMinutes(h.close_time!)))
  return { startMin, endMin }
}
