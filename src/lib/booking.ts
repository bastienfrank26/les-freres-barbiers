import { supabase } from './supabase'

export async function getAvailableSlots(serviceId: string, barberId: string, date: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('available_slots', {
    p_service_id: serviceId,
    p_barber_id: barberId,
    p_date: date,
  })
  if (error) throw error
  return (data ?? []) as string[]
}

export type BookResult = { id: string; status: 'pending' | 'confirmed' }

export async function bookAppointment(args: {
  serviceId: string
  barberId: string
  startsAt: string // ISO
  firstName: string
  lastName?: string
  phone?: string
  email?: string
  notes?: string
}): Promise<BookResult> {
  const { data, error } = await supabase.rpc('book_appointment', {
    p_service_id: args.serviceId,
    p_barber_id: args.barberId,
    p_starts_at: args.startsAt,
    p_first_name: args.firstName,
    p_last_name: args.lastName ?? '',
    p_phone: args.phone ?? '',
    p_email: args.email ?? '',
    p_notes: args.notes ?? '',
  })
  if (error) throw error
  return data as BookResult
}
