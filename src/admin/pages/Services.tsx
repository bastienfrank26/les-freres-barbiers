import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  createService,
  deleteService,
  dollarsToCents,
  formatPrice,
  listServices,
  updateService,
} from '../../lib/services'
import type { Service, ServiceInput } from '../../lib/services'

type Draft = {
  category: string
  name: string
  description: string
  price: string
  duration_min: string
  is_active: boolean
  display_order: string
}

function toDraft(s?: Service): Draft {
  return {
    category: s?.category ?? '',
    name: s?.name ?? '',
    description: s?.description ?? '',
    price: s ? String(s.price_cents / 100) : '',
    duration_min: String(s?.duration_min ?? 60),
    is_active: s?.is_active ?? true,
    display_order: String(s?.display_order ?? 0),
  }
}

function toInput(d: Draft): ServiceInput {
  return {
    category: d.category.trim(),
    name: d.name.trim(),
    description: d.description.trim() || null,
    price_cents: dollarsToCents(d.price),
    duration_min: Number(d.duration_min) || 0,
    prep_min: 0,
    cleanup_min: 0,
    is_active: d.is_active,
    display_order: Number(d.display_order) || 0,
  }
}

const inputClass =
  'mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-700/20 dark:border-stone-600 dark:bg-stone-700 dark:text-stone-100'

function ServiceForm({
  initial,
  onCancel,
  onSaved,
}: {
  initial?: Service
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
      if (initial) await updateService(initial.id, toInput(draft))
      else await createService(toInput(draft))
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
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-stone-800"
      >
        <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-100">
          {initial ? 'Modifier le service' : 'Nouveau service'}
        </h2>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="col-span-1">
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">Catégorie</label>
            <input className={inputClass} value={draft.category} onChange={(e) => set('category', e.target.value)} required />
          </div>
          <div className="col-span-1">
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">Nom</label>
            <input className={inputClass} value={draft.name} onChange={(e) => set('name', e.target.value)} required />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">Description</label>
          <textarea
            className={inputClass}
            rows={2}
            value={draft.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">Prix ($)</label>
            <input className={inputClass} value={draft.price} onChange={(e) => set('price', e.target.value)} inputMode="decimal" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">Durée (min)</label>
            <input className={inputClass} type="number" min={0} value={draft.duration_min} onChange={(e) => set('duration_min', e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">Ordre</label>
            <input className={inputClass} type="number" value={draft.display_order} onChange={(e) => set('display_order', e.target.value)} />
          </div>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" checked={draft.is_active} onChange={(e) => set('is_active', e.target.checked)} />
          Actif (affiché sur le site et réservable)
        </label>

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

export function Services() {
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Service | 'new' | null>(null)

  async function load() {
    try {
      const data = await listServices()
      setServices(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    listServices()
      .then((data) => {
        if (!active) return
        setServices(data)
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

  async function onToggleActive(s: Service) {
    try {
      await updateService(s.id, { is_active: !s.is_active })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de mise à jour')
    }
  }

  async function onDelete(s: Service) {
    if (!window.confirm(`Supprimer le service « ${s.name} » ?`)) return
    try {
      await deleteService(s.id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de suppression')
    }
  }

  const count = useMemo(() => services.filter((s) => s.is_active).length, [services])

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-800 dark:text-stone-100">Services</h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            {count} service{count > 1 ? 's' : ''} actif{count > 1 ? 's' : ''} · catalogue des prestations réservables.
          </p>
        </div>
        <button
          onClick={() => setEditing('new')}
          className="rounded-lg bg-amber-800 px-4 py-2 text-sm font-medium text-white hover:bg-amber-900"
        >
          + Ajouter
        </button>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-6 overflow-hidden rounded-2xl border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-800">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500 dark:bg-stone-900 dark:text-stone-400">
            <tr>
              <th className="px-4 py-3 font-medium">Catégorie</th>
              <th className="px-4 py-3 font-medium">Nom</th>
              <th className="px-4 py-3 font-medium">Prix</th>
              <th className="px-4 py-3 font-medium">Durée</th>
              <th className="px-4 py-3 font-medium">Actif</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-stone-700">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-stone-400">
                  Chargement…
                </td>
              </tr>
            ) : services.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-stone-400">
                  Aucun service.
                </td>
              </tr>
            ) : (
              services.map((s) => (
                <tr key={s.id} className={s.is_active ? '' : 'opacity-50'}>
                  <td className="px-4 py-3 text-stone-500 dark:text-stone-400">{s.category}</td>
                  <td className="px-4 py-3 font-medium text-stone-800 dark:text-stone-100">{s.name}</td>
                  <td className="px-4 py-3">{formatPrice(s.price_cents)}</td>
                  <td className="px-4 py-3 text-stone-500 dark:text-stone-400">{s.duration_min} min</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => onToggleActive(s)}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        s.is_active ? 'bg-green-100 text-green-700' : 'bg-stone-200 text-stone-500'
                      }`}
                    >
                      {s.is_active ? 'Actif' : 'Inactif'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setEditing(s)} className="text-amber-800 hover:underline">
                      Modifier
                    </button>
                    <button onClick={() => onDelete(s)} className="ml-4 text-red-600 hover:underline">
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
        <ServiceForm
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
