import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { createBarber, deleteBarber, listBarbers, updateBarber } from '../../lib/barbers'
import type { Barber, BarberInput } from '../../lib/barbers'

type Draft = { name: string; color: string; is_active: boolean }

function toDraft(b?: Barber): Draft {
  return { name: b?.name ?? '', color: b?.color ?? '#b87333', is_active: b?.is_active ?? true }
}

function toInput(d: Draft): BarberInput {
  return { name: d.name.trim(), color: d.color, is_active: d.is_active }
}

const inputClass =
  'mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-700/20'

function BarberForm({ initial, onCancel, onSaved }: { initial?: Barber; onCancel: () => void; onSaved: () => void }) {
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
      if (initial) await updateBarber(initial.id, toInput(draft))
      else await createBarber(toInput(draft))
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l’enregistrement')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onCancel}>
      <form onSubmit={onSubmit} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-stone-800">{initial ? 'Modifier le barbier' : 'Nouveau barbier'}</h2>

        <div className="mt-4">
          <label className="block text-sm font-medium text-stone-700">Nom</label>
          <input className={inputClass} value={draft.name} onChange={(e) => set('name', e.target.value)} required />
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div>
            <label className="block text-sm font-medium text-stone-700">Couleur d’agenda</label>
            <input type="color" value={draft.color} onChange={(e) => set('color', e.target.value)} className="mt-1 h-10 w-16 rounded border border-stone-300" />
          </div>
          <label className="mt-5 flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" checked={draft.is_active} onChange={(e) => set('is_active', e.target.checked)} />
            Actif
          </label>
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

export function Barbiers() {
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Barber | 'new' | null>(null)

  async function load() {
    try {
      setBarbers(await listBarbers())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    listBarbers()
      .then((data) => active && setBarbers(data))
      .catch((err) => active && setError(err instanceof Error ? err.message : 'Erreur de chargement'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  async function onDelete(b: Barber) {
    if (!window.confirm(`Supprimer le barbier « ${b.name} » ?`)) return
    try {
      await deleteBarber(b.id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de suppression')
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-800">Barbiers</h1>
          <p className="mt-1 text-sm text-stone-500">{barbers.length} barbier{barbers.length > 1 ? 's' : ''} · agendas et disponibilités.</p>
        </div>
        <button onClick={() => setEditing('new')} className="rounded-lg bg-amber-800 px-4 py-2 text-sm font-medium text-white hover:bg-amber-900">
          + Ajouter
        </button>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-6 overflow-hidden rounded-2xl border border-stone-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3 font-medium">Couleur</th>
              <th className="px-4 py-3 font-medium">Nom</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-stone-400">
                  Chargement…
                </td>
              </tr>
            ) : barbers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-stone-400">
                  Aucun barbier.
                </td>
              </tr>
            ) : (
              barbers.map((b) => (
                <tr key={b.id} className={b.is_active ? '' : 'opacity-50'}>
                  <td className="px-4 py-3">
                    <span className="inline-block h-5 w-5 rounded-full" style={{ backgroundColor: b.color }} />
                  </td>
                  <td className="px-4 py-3 font-medium text-stone-800">{b.name}</td>
                  <td className="px-4 py-3 text-stone-500">{b.is_active ? 'Actif' : 'Inactif'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setEditing(b)} className="text-amber-800 hover:underline">
                      Modifier
                    </button>
                    <button onClick={() => onDelete(b)} className="ml-4 text-red-600 hover:underline">
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
        <BarberForm
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
