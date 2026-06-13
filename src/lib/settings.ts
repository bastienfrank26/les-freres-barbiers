import { supabase } from './supabase'

export type BookingMode = 'request' | 'auto'

export type Settings = {
  online_booking_mode: BookingMode
  notify_email_enabled: boolean
  notify_sms_enabled: boolean
}

export async function getSettings(): Promise<Settings> {
  const { data, error } = await supabase.from('settings').select('key, value')
  if (error) throw error
  const map = new Map((data ?? []).map((r) => [r.key as string, r.value as string]))
  return {
    online_booking_mode: map.get('online_booking_mode') === 'auto' ? 'auto' : 'request',
    notify_email_enabled: map.get('notify_email_enabled') === 'true',
    notify_sms_enabled: map.get('notify_sms_enabled') === 'true',
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  const { error } = await supabase.from('settings').update({ value }).eq('key', key)
  if (error) throw error
}
