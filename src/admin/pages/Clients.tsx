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

type Draft = {
  first_name: string
  last_name: string
  phone: string
  email: string
  notes: string
}

function toDraft(c?: Client): Draft {
  return {
    first_name: c?.first_name ?? '',
    last_name: c?.last_name ?? '',
    phone: c?.phone ?? '',
    email: c?.email ?? '',
    notes: c?.notes ?? '',
  }
}

function toInput(d: Draft): ClientInput {
  return {
    first_name: d.first_name.trim(),
    last_name: d.last_name.trim() || null,
    phone: d.phone.trim() || null,
    email: d.email.trim() || null,
    notes: d.notes.trim() || null,
  }
}

const inputClass =
  'mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-700/20'

function ClientForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial?: Client
  onCancel: () => void
  onSaved: () => void
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-stone-800">
          {initial ? 'Modifier le client' : 'Nouveau client'}
        </h2>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700">Prénom</label>
            <input className={inputClass} value={draft.first_name} onChange={(e) => set('first_name', e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">Nom</label>
            <input className={inputClass} value={draft.last_name} onChange={(e) => set('last_name', e.target.value)} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700">Téléphone</label>
            <input className={inputClass} type="tel" value={draft.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700">Courriel</label>
            <input className={inputClass} type="email" value={draft.email} onChange={(e) => set('email', e.target.value)} />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-stone-700">Notes internes</label>
          <textarea className={inputClass} rows={3} value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
        </div>

        {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm text-stone-600 hover:bg-stone-100">
            Annuler
          </button>
          <button type="submit" disabled={busy} className="rounded-lg bg-amber-800 px-4 py-2 text-sm font-medium text-white hover:bg-amber-900 disabled:opacity-60">
            {busy ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  )
}

export function Clients() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Client | 'new' | null>(null)
  const [query, setQuery] = useState('')

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
          <h1 className="text-2xl font-semibold text-stone-800">Clients</h1>
          <p className="mt-1 text-sm text-stone-500">
            {clients.length} client{clients.length > 1 ? 's' : ''} · coordonnées et notes internes.
          </p>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="rounded-lg bg-amber-800 px-4 py-2 text-sm font-medium text-white hover:bg-amber-900"
        >
          + Ajouter
        </button>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher par nom, téléphone ou courriel…"
        className="mt-6 w-full max-w-md rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-700/20"
      />

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-4 overflow-hidden rounded-2xl border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3 font-medium">Nom</th>
              <th className="px-4 py-3 font-medium">Téléphone</th>
              <th className="px-4 py-3 font-medium">Courriel</th>
              <th className="px-4 py-3 font-medium">Notes</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-stone-400">
                  Chargement…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-stone-400">
                  {query ? 'Aucun résultat.' : 'Aucun client.'}
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-3 font-medium text-stone-800">{clientFullName(c)}</td>
                  <td className="px-4 py-3 text-stone-500">{c.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-stone-500">{c.email ?? '—'}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-stone-500">{c.notes ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setEditing(c)} className="text-amber-800 hover:underline">
                      Modifier
                    </button>
                    <button onClick={() => onDelete(c)} className="ml-4 text-red-600 hover:underline">
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
