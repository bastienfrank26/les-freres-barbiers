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
import { getTheme, setTheme } from '../../lib/theme'
import type { Theme } from '../../lib/theme'
import { changeMyPassword } from '../../lib/barbers'
import { PASSWORD_RULES, validateStrongPassword } from '../../lib/password'
import { useAdminContext } from '../../lib/adminContext'

type HourRow = { id: string; weekday: number; open: string; close: string; closed: boolean }

function hhmm(t: string | null): string {
  return t ? t.slice(0, 5) : ''
}

/* ---------- Section : changer mon mot de passe (barbiers) ---------- */
function MyPasswordSection() {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit() {
    const invalid = validateStrongPassword(password)
    if (invalid) {
      setError(invalid)
      setDone(false)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await changeMyPassword(password)
      setPassword('')
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mt-6 ui-card p-6">
      <h2 className="text-lg font-medium text-fg">Mon mot de passe</h2>
      <div className="mt-3 max-w-sm">
        <label className="block text-sm font-medium text-fg">Nouveau mot de passe</label>
        <input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setDone(false) }}
          className="mt-1 w-full ui-input"
        />
        <ul className="mt-3 space-y-1 text-xs">
          {PASSWORD_RULES.map((r) => (
            <li key={r.label} className={r.test(password) ? 'text-success' : 'text-muted'}>
              {r.test(password) ? '✓' : '•'} {r.label}
            </li>
          ))}
        </ul>
        {error && <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        {done && <p className="mt-3 text-sm text-success">Mot de passe mis à jour ✓</p>}
        <button onClick={submit} disabled={busy} className="mt-4 ui-btn-primary">
          {busy ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>
    </section>
  )
}

export function Parametres() {
  const { isAdmin } = useAdminContext()
  const [hours, setHours] = useState<HourRow[]>([])
  const [closures, setClosures] = useState<Closure[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedHours, setSavedHours] = useState(false)

  const [newClosure, setNewClosure] = useState({ date: '', reason: '', barber_id: '' })
  const [theme, setThemeState] = useState<Theme>(() => getTheme())

  function changeTheme(t: Theme) {
    setThemeState(t)
    setTheme(t)
  }

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
      <h1 className="text-2xl font-semibold text-fg">Paramètres</h1>
      <p className="mt-1 text-sm text-muted">
        {isAdmin
          ? 'Apparence, heures d’ouverture, congés, réservation en ligne et notifications.'
          : 'Apparence et sécurité de votre compte.'}
      </p>

      {error && <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

      {/* Apparence (mode sombre / clair) */}
      <section className="mt-8 ui-card p-6">
        <h2 className="text-lg font-medium text-fg">Apparence</h2>
        <div className="mt-3 inline-flex rounded-lg border border-border p-0.5">
          {(['light', 'dark'] as Theme[]).map((t) => (
            <button
              key={t}
              onClick={() => changeTheme(t)}
              className={`rounded-md px-4 py-1.5 text-sm transition ${
                theme === t ? 'bg-accent text-accent-fg' : 'text-muted hover:bg-bg-subtle'
              }`}
            >
              {t === 'light' ? '☀ Clair' : '🌙 Sombre'}
            </button>
          ))}
        </div>
      </section>

      {/* Mot de passe (barbiers non administrateurs) */}
      {!isAdmin && <MyPasswordSection />}

      {/* Heures d'ouverture */}
      {isAdmin && (
      <section className="mt-6 ui-card p-6">
        <h2 className="text-lg font-medium text-fg">Heures d’ouverture</h2>
        <div className="mt-4 space-y-2">
          {sortedHours.map((r) => (
            <div key={r.id} className="flex items-center gap-3">
              <span className="w-24 text-sm text-muted">{DAY_LABELS[r.weekday]}</span>
              <label className="flex items-center gap-1.5 text-sm text-muted">
                <input type="checkbox" checked={r.closed} onChange={(e) => setHour(r.weekday, { closed: e.target.checked })} />
                Fermé
              </label>
              <input
                type="time"
                disabled={r.closed}
                value={r.open}
                onChange={(e) => setHour(r.weekday, { open: e.target.value })}
                className="ui-input px-2 py-1"
              />
              <span className="text-muted">→</span>
              <input
                type="time"
                disabled={r.closed}
                value={r.close}
                onChange={(e) => setHour(r.weekday, { close: e.target.value })}
                className="ui-input px-2 py-1"
              />
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={saveHours} className="ui-btn-primary">
            Enregistrer les horaires
          </button>
          {savedHours && <span className="text-sm text-success">Enregistré ✓</span>}
        </div>
        <p className="mt-3 text-xs text-muted">Les pauses repas ne sont pas gérées pour le moment.</p>
      </section>
      )}

      {/* Congés */}
      {isAdmin && (
      <section className="mt-6 ui-card p-6">
        <h2 className="text-lg font-medium text-fg">Congés et fermetures</h2>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-muted">Date</label>
            <input
              type="date"
              value={newClosure.date}
              onChange={(e) => setNewClosure((c) => ({ ...c, date: e.target.value }))}
              className="mt-1 ui-input px-2 py-1.5"
            />
          </div>
          <div>
            <label className="block text-xs text-muted">Motif</label>
            <input
              value={newClosure.reason}
              onChange={(e) => setNewClosure((c) => ({ ...c, reason: e.target.value }))}
              placeholder="Optionnel"
              className="mt-1 ui-input px-2 py-1.5"
            />
          </div>
          <div>
            <label className="block text-xs text-muted">Concerne</label>
            <select
              value={newClosure.barber_id}
              onChange={(e) => setNewClosure((c) => ({ ...c, barber_id: e.target.value }))}
              className="mt-1 ui-input px-2 py-1.5"
            >
              <option value="">Tout le salon</option>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <button onClick={addClosure} className="ui-btn-primary">
            Ajouter
          </button>
        </div>

        <ul className="mt-4 divide-y divide-border">
          {closures.length === 0 && <li className="py-2 text-sm text-muted">Aucun congé enregistré.</li>}
          {closures.map((c) => (
            <li key={c.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-fg">
                {c.date}
                {c.reason ? ` · ${c.reason}` : ''}
                <span className="text-muted"> · {c.barber_id ? barbers.find((b) => b.id === c.barber_id)?.name ?? 'Barbier' : 'Tout le salon'}</span>
              </span>
              <button onClick={() => removeClosure(c.id)} className="text-danger hover:underline">
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      </section>
      )}

      {/* Réservation en ligne + notifications */}
      {isAdmin && settings && (
        <section className="mt-6 ui-card p-6">
          <h2 className="text-lg font-medium text-fg">Réservation en ligne</h2>
          <div className="mt-3 space-y-2">
            {(['request', 'auto'] as BookingMode[]).map((mode) => (
              <label key={mode} className="flex items-start gap-2 text-sm text-fg">
                <input
                  type="radio"
                  name="booking_mode"
                  checked={settings.online_booking_mode === mode}
                  onChange={() => changeSetting('online_booking_mode', mode, mode)}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">{mode === 'request' ? 'Demande à confirmer' : 'Confirmation automatique'}</span>
                  <span className="block text-xs text-muted">
                    {mode === 'request'
                      ? 'Les réservations arrivent « en attente » ; vous les confirmez.'
                      : 'Le créneau est réservé et confirmé immédiatement.'}
                  </span>
                </span>
              </label>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-medium text-fg">Notifications</h2>
            <span className="rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-medium text-warning">
              Option disponible
            </span>
          </div>
          <p className="mt-2 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning">
            📱 Les notifications <strong>par SMS</strong> nécessitent un <strong>abonnement mensuel</strong> auprès d’un
            fournisseur SMS. En revanche, la <strong>confirmation par courriel</strong> peut être offerte
            <strong> gratuitement via Resend</strong> (jusqu’à 3 000 courriels par mois).
          </p>
          <div className="mt-3 space-y-2">
            <label className="flex items-center gap-2 text-sm text-fg">
              <input
                type="checkbox"
                checked={settings.notify_email_enabled}
                onChange={(e) => changeSetting('notify_email_enabled', e.target.checked, String(e.target.checked))}
              />
              Notifications par courriel (Resend — gratuit)
            </label>
            <label className="flex items-center gap-2 text-sm text-fg">
              <input
                type="checkbox"
                checked={settings.notify_sms_enabled}
                onChange={(e) => changeSetting('notify_sms_enabled', e.target.checked, String(e.target.checked))}
              />
              Notifications par SMS (abonnement requis)
            </label>
            <p className="text-xs text-muted">L’envoi effectif (fournisseur courriel / SMS) sera branché ultérieurement.</p>
          </div>
        </section>
      )}
    </div>
  )
}
