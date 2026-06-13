import { useEffect, useState } from 'react'
import {
  createClosure,
  deleteClosure,
  listBusinessHours,
  listClosures,
  updateBusinessHour,
} from '../../lib/businessHours'
import type { Closure } from '../../lib/businessHours'
import { listBarbers } from '../../lib/barbers'
import type { Barber } from '../../lib/barbers'
import { getSettings, setSetting } from '../../lib/settings'
import type { BookingMode, Settings } from '../../lib/settings'
import { DAY_LABELS } from '../../lib/datetime'

type HourRow = { id: string; weekday: number; open: string; close: string; closed: boolean }

function hhmm(t: string | null): string {
  return t ? t.slice(0, 5) : ''
}

export function Parametres() {
  const [hours, setHours] = useState<HourRow[]>([])
  const [closures, setClosures] = useState<Closure[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedHours, setSavedHours] = useState(false)

  const [newClosure, setNewClosure] = useState({ date: '', reason: '', barber_id: '' })

  useEffect(() => {
    let active = true
    Promise.all([listBusinessHours(), listClosures(), listBarbers(), getSettings()])
      .then(([h, c, b, s]) => {
        if (!active) return
        setHours(h.map((x) => ({ id: x.id, weekday: x.weekday, open: hhmm(x.open_time), close: hhmm(x.close_time), closed: x.is_closed })))
        setClosures(c)
        setBarbers(b)
        setSettings(s)
      })
      .catch((err) => active && setError(err instanceof Error ? err.message : 'Erreur de chargement'))
    return () => {
      active = false
    }
  }, [])

  function setHour(weekday: number, patch: Partial<HourRow>) {
    setHours((rows) => rows.map((r) => (r.weekday === weekday ? { ...r, ...patch } : r)))
    setSavedHours(false)
  }

  async function saveHours() {
    setError(null)
    try {
      await Promise.all(
        hours.map((r) =>
          updateBusinessHour(r.id, {
            is_closed: r.closed,
            open_time: r.closed || !r.open ? null : r.open,
            close_time: r.closed || !r.close ? null : r.close,
          }),
        ),
      )
      setSavedHours(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur d’enregistrement des horaires')
    }
  }

  async function addClosure() {
    if (!newClosure.date) return
    try {
      await createClosure({
        date: newClosure.date,
        reason: newClosure.reason.trim() || null,
        barber_id: newClosure.barber_id || null,
      })
      setNewClosure({ date: '', reason: '', barber_id: '' })
      setClosures(await listClosures())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur d’ajout du congé')
    }
  }

  async function removeClosure(id: string) {
    try {
      await deleteClosure(id)
      setClosures((cs) => cs.filter((c) => c.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de suppression')
    }
  }

  async function changeSetting<K extends keyof Settings>(key: K, value: Settings[K], stored: string) {
    if (!settings) return
    setSettings({ ...settings, [key]: value })
    try {
      await setSetting(key, stored)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur d’enregistrement')
    }
  }

  const sortedHours = [...hours].sort((a, b) => a.weekday - b.weekday)

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-stone-800">Paramètres</h1>
      <p className="mt-1 text-sm text-stone-500">Heures d’ouverture, congés, réservation en ligne et notifications.</p>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* Heures d'ouverture */}
      <section className="mt-8 rounded-2xl border border-stone-200 bg-white p-6">
        <h2 className="text-lg font-medium text-stone-800">Heures d’ouverture</h2>
        <div className="mt-4 space-y-2">
          {sortedHours.map((r) => (
            <div key={r.id} className="flex items-center gap-3">
              <span className="w-24 text-sm text-stone-600">{DAY_LABELS[r.weekday]}</span>
              <label className="flex items-center gap-1.5 text-sm text-stone-500">
                <input type="checkbox" checked={r.closed} onChange={(e) => setHour(r.weekday, { closed: e.target.checked })} />
                Fermé
              </label>
              <input
                type="time"
                disabled={r.closed}
                value={r.open}
                onChange={(e) => setHour(r.weekday, { open: e.target.value })}
                className="rounded-lg border border-stone-300 px-2 py-1 text-sm disabled:bg-stone-100"
              />
              <span className="text-stone-400">→</span>
              <input
                type="time"
                disabled={r.closed}
                value={r.close}
                onChange={(e) => setHour(r.weekday, { close: e.target.value })}
                className="rounded-lg border border-stone-300 px-2 py-1 text-sm disabled:bg-stone-100"
              />
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={saveHours} className="rounded-lg bg-amber-800 px-4 py-2 text-sm font-medium text-white hover:bg-amber-900">
            Enregistrer les horaires
          </button>
          {savedHours && <span className="text-sm text-green-700">Enregistré ✓</span>}
        </div>
        <p className="mt-3 text-xs text-stone-400">Les pauses repas ne sont pas gérées pour le moment.</p>
      </section>

      {/* Congés */}
      <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-6">
        <h2 className="text-lg font-medium text-stone-800">Congés et fermetures</h2>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-stone-500">Date</label>
            <input
              type="date"
              value={newClosure.date}
              onChange={(e) => setNewClosure((c) => ({ ...c, date: e.target.value }))}
              className="mt-1 rounded-lg border border-stone-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-stone-500">Motif</label>
            <input
              value={newClosure.reason}
              onChange={(e) => setNewClosure((c) => ({ ...c, reason: e.target.value }))}
              placeholder="Optionnel"
              className="mt-1 rounded-lg border border-stone-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-stone-500">Concerne</label>
            <select
              value={newClosure.barber_id}
              onChange={(e) => setNewClosure((c) => ({ ...c, barber_id: e.target.value }))}
              className="mt-1 rounded-lg border border-stone-300 px-2 py-1.5 text-sm"
            >
              <option value="">Tout le salon</option>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <button onClick={addClosure} className="rounded-lg bg-amber-800 px-4 py-2 text-sm font-medium text-white hover:bg-amber-900">
            Ajouter
          </button>
        </div>

        <ul className="mt-4 divide-y divide-stone-100">
          {closures.length === 0 && <li className="py-2 text-sm text-stone-400">Aucun congé enregistré.</li>}
          {closures.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-stone-700">
                {c.date}
                {c.reason ? ` · ${c.reason}` : ''}
                <span className="text-stone-400"> · {c.barber_id ? barbers.find((b) => b.id === c.barber_id)?.name ?? 'Barbier' : 'Tout le salon'}</span>
              </span>
              <button onClick={() => removeClosure(c.id)} className="text-red-600 hover:underline">
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Réservation en ligne + notifications */}
      {settings && (
        <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-6">
          <h2 className="text-lg font-medium text-stone-800">Réservation en ligne</h2>
          <div className="mt-3 space-y-2">
            {(['request', 'auto'] as BookingMode[]).map((mode) => (
              <label key={mode} className="flex items-start gap-2 text-sm text-stone-700">
                <input
                  type="radio"
                  name="booking_mode"
                  checked={settings.online_booking_mode === mode}
                  onChange={() => changeSetting('online_booking_mode', mode, mode)}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">{mode === 'request' ? 'Demande à confirmer' : 'Confirmation automatique'}</span>
                  <span className="block text-xs text-stone-500">
                    {mode === 'request'
                      ? 'Les réservations arrivent « en attente » ; vous les confirmez.'
                      : 'Le créneau est réservé et confirmé immédiatement.'}
                  </span>
                </span>
              </label>
            ))}
          </div>

          <h2 className="mt-6 text-lg font-medium text-stone-800">Notifications</h2>
          <div className="mt-3 space-y-2">
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={settings.notify_email_enabled}
                onChange={(e) => changeSetting('notify_email_enabled', e.target.checked, String(e.target.checked))}
              />
              Notifications par courriel
            </label>
            <label className="flex items-center gap-2 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={settings.notify_sms_enabled}
                onChange={(e) => changeSetting('notify_sms_enabled', e.target.checked, String(e.target.checked))}
              />
              Notifications par SMS
            </label>
            <p className="text-xs text-stone-400">L’envoi effectif (fournisseur courriel / SMS) sera branché ultérieurement.</p>
          </div>
        </section>
      )}
    </div>
  )
}
