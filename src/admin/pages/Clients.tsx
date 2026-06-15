import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  clientFullName,
  createClient,
  deleteClient,
  listClients,
  updateClient,
} from '../../lib/clients'
import type { Client, ClientInput } from '../../lib/clients'
import { STATUS_LABELS, listAppointmentsForClient } from '../../lib/appointments'
import type { Appointment } from '../../lib/appointments'
import { listBarbers } from '../../lib/barbers'
import type { Barber } from '../../lib/barbers'
import { formatLongDate, hm } from '../../lib/datetime'
import { useAdminContext } from '../../lib/adminContext'

type Draft = {
  first_name: string
  last_name: string
  phone: string
  email: string
  notes: string
  barber_id: string
}

function toDraft(c?: Client): Draft {
  return {
    first_name: c?.first_name ?? '',
    last_name: c?.last_name ?? '',
    phone: c?.phone ?? '',
    email: c?.email ?? '',
    notes: c?.notes ?? '',
    barber_id: c?.barber_id ?? '',
  }
}

function toInput(d: Draft): ClientInput {
  return {
    first_name: d.first_name.trim(),
    last_name: d.last_name.trim() || null,
    phone: d.phone.trim() || null,
    email: d.email.trim() || null,
    notes: d.notes.trim() || null,
    barber_id: d.barber_id || null,
  }
}

const inputClass =
  'mt-1 w-full ui-input'

function ClientForm({
  initial,
  barbers,
  isAdmin,
  defaultBarberId,
  onCancel,
  onSaved,
}: {
  initial?: Client
  barbers: Barber[]
  isAdmin: boolean
  defaultBarberId: string | null
  onCancel: () => void
  onSaved: () => void
}) {
  const [draft, setDraft] = useState<Draft>(() => {
    const d = toDraft(initial)
    if (!initial && defaultBarberId) d.barber_id = defaultBarberId
    return d
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<Appointment[]>([])

  useEffect(() => {
    if (!initial) return
    let active = true
    listAppointmentsForClient(initial.id)
      .then((a) => active && setHistory(a))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [initial])

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (initial) await updateClient(initial.id, toInput(draft))
      else await createClient(toInput(draft))
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l’enregistrement')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onCancel}>
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg ui-card p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-fg">
          {initial ? 'Modifier le client' : 'Nouveau client'}
        </h2>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-fg">Prénom</label>
            <input className={inputClass} value={draft.first_name} onChange={(e) => set('first_name', e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-fg">Nom</label>
            <input className={inputClass} value={draft.last_name} onChange={(e) => set('last_name', e.target.value)} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-fg">Téléphone</label>
            <input className={inputClass} type="tel" value={draft.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-fg">Courriel</label>
            <input className={inputClass} type="email" value={draft.email} onChange={(e) => set('email', e.target.value)} />
          </div>
        </div>

        {isAdmin && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-fg">Barbier assigné</label>
            <select className={inputClass} value={draft.barber_id} onChange={(e) => set('barber_id', e.target.value)}>
              <option value="">— Aucun —</option>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-4">
          <label className="block text-sm font-medium text-fg">Notes internes</label>
          <textarea className={inputClass} rows={3} value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>

        {initial && (
          <div className="mt-5">
            <h3 className="text-sm font-medium text-fg">Historique des rendez-vous</h3>
            {history.length === 0 ? (
              <p className="mt-1 text-sm text-muted">Aucun rendez-vous.</p>
            ) : (
              <ul className="mt-2 max-h-40 space-y-1 overflow-auto text-sm">
                {history.map((a) => (
                  <li key={a.id} className="flex justify-between gap-3 rounded-lg bg-bg-subtle px-3 py-1.5">
                    <span className="text-muted">
                      {formatLongDate(new Date(a.starts_at))} · {hm(new Date(a.starts_at))}
                    </span>
                    <span className="shrink-0 text-muted">
                      {a.service?.name ?? ''} · {STATUS_LABELS[a.status]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {error && <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="ui-btn-ghost">
            Annuler
          </button>
          <button type="submit" disabled={busy} className="ui-btn-primary">
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  )
}

export function Clients() {
  const { isAdmin, myBarber } = useAdminContext()
  const [clients, setClients] = useState<Client[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Client | 'new' | null>(null)
  const [query, setQuery] = useState('')

  const barberName = (id: string | null) => (id ? barbers.find((b) => b.id === id)?.name ?? '—' : '—')

  async function load() {
    try {
      const data = await listClients()
      setClients(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    listClients()
      .then((data) => {
        if (!active) return
        setClients(data)
        setError(null)
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Erreur de chargement')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!isAdmin) return
    let active = true
    listBarbers()
      .then((b) => active && setBarbers(b))
      .catch(() => {})
    return () => {
      active = false
    }
  }, [isAdmin])

  async function onDelete(c: Client) {
    if (!window.confirm(`Supprimer le client « ${clientFullName(c)} » ?`)) return
    try {
      await deleteClient(c.id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de suppression')
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return clients
    return clients.filter((c) =>
      [c.first_name, c.last_name, c.phone, c.email].some((v) => v?.toLowerCase().includes(q)),
    )
  }, [clients, query])

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-fg">Clients</h1>
          <p className="mt-1 text-sm text-muted">
            {clients.length} client{clients.length > 1 ? 's' : ''} · coordonnées et notes internes.
          </p>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="ui-btn-primary"
        >
          + Ajouter
        </button>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher par nom, téléphone ou courriel…"
        className="mt-6 w-full max-w-md ui-input"
      />

      {error && <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-bg-subtle text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Nom</th>
              <th className="px-4 py-3 font-medium">Téléphone</th>
              <th className="px-4 py-3 font-medium">Courriel</th>
              {isAdmin && <th className="px-4 py-3 font-medium">Barbier</th>}
              <th className="px-4 py-3 font-medium">Notes</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={isAdmin ? 6 : 5} className="px-4 py-8 text-center text-muted">
                  Chargement…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 6 : 5} className="px-4 py-8 text-center text-muted">
                  {query ? 'Aucun résultat.' : 'Aucun client.'}
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3">
                    <button onClick={() => setEditing(c)} className="font-medium text-fg hover:text-accent hover:underline">
                      {clientFullName(c)}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-muted">{c.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-muted">{c.email ?? '—'}</td>
                  {isAdmin && <td className="px-4 py-3 text-muted">{barberName(c.barber_id)}</td>}
                  <td className="max-w-xs truncate px-4 py-3 text-muted">{c.notes ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setEditing(c)} className="text-accent hover:underline">
                      Modifier
                    </button>
                    <button onClick={() => onDelete(c)} className="ml-4 text-danger hover:underline">
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <ClientForm
          initial={editing === 'new' ? undefined : editing}
          barbers={barbers}
          isAdmin={isAdmin}
          defaultBarberId={myBarber?.id ?? null}
          onCancel={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
          }}
        />
      )}
    </div>
  )
}
