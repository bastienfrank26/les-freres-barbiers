import { supabase } from './supabase'

export type Client = {
  id: string
  first_name: string
  last_name: string | null
  phone: string | null
  email: string | null
  notes: string | null
  created_at: string
}

export type ClientInput = Omit<Client, 'id' | 'created_at'>

export async function listClients(): Promise<Client[]> {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('last_name', { ascending: true, nullsFirst: false })
    .order('first_name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createClient(input: ClientInput): Promise<void> {
  const { error } = await supabase.from('clients').insert(input)
  if (error) throw error
}

export async function updateClient(id: string, input: Partial<ClientInput>): Promise<void> {
  const { error } = await supabase.from('clients').update(input).eq('id', id)
  if (error) throw error
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await supabase.from('clients').delete().eq('id', id)
  if (error) throw error
}

export function clientFullName(c: Client): string {
  return [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || '—'
}
