import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  STATUS_LABELS,
  createAppointment,
  deleteAppointment,
  updateAppointment,
  validateSlot,
} from '../../lib/appointments'
import type { Appointment, AppointmentStatus } from '../../lib/appointments'
import type { BusinessHour, Closure } from '../../lib/businessHours'
import type { Barber } from '../../lib/barbers'
import type { Client } from '../../lib/clients'
import type { Service } from '../../lib/services'
import { clientFullName } from '../../lib/clients'
import { formatPrice } from '../../lib/services'
import { addMinutes, combine, hm, ymd } from '../../lib/datetime'

export type ModalState =
  | { mode: 'create'; date: string; time: string; barberId: string }
  | { mode: 'edit'; appointment: Appointment }

type Props = {
  state: ModalState
  clients: Client[]
  services: Service[]
  barbers: Barber[]
  ctx: { hours: BusinessHour[]; closures: Closure[]; appointments: Appointment[] }
  onCancel: () => void
  onSaved: () => void
}

const inputClass =
  'mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-700/20 dark:border-stone-600 dark:bg-stone-700 dark:text-stone-100'

const STATUSES: AppointmentStatus[] = ['pending', 'confirmed', 'completed', 'no_show', 'paid', 'cancelled']

const QUICK: { status: AppointmentStatus; label: string; cls: string }[] = [
  { status: 'confirmed', label: 'Confirmé', cls: 'bg-green-100 text-green-700 hover:bg-green-200' },
  { status: 'cancelled', label: 'Annulé', cls: 'bg-red-100 text-red-700 hover:bg-red-200' },
  { status: 'no_show', label: 'Absent', cls: 'bg-stone-200 text-stone-600 hover:bg-stone-300' },
  { status: 'paid', label: 'Payé', cls: 'bg-amber-100 text-amber-800 hover:bg-amber-200' },
]

export function AppointmentModal({ state, clients, services, barbers, ctx, onCancel, onSaved }: Props) {
  const editing = state.mode === 'edit' ? state.appointment : null

  const [isBlock, setIsBlock] = useState(editing?.is_block ?? false)
  const [clientId, setClientId] = useState(editing?.client_id ?? '')
  const [serviceId, setServiceId] = useState(editing?.service_id ?? services[0]?.id ?? '')
  const [barberId, setBarberId] = useState(
    editing?.barber_id ?? (state.mode === 'create' ? state.barberId : barbers[0]?.id ?? ''),
  )
  const [date, setDate] = useState(editing ? ymd(new Date(editing.starts_at)) : state.mode === 'create' ? state.date : '')
  const [time, setTime] = useState(editing ? hm(new Date(editing.starts_at)) : state.mode === 'create' ? state.time : '')
  const [endTime, setEndTime] = useState(editing ? hm(new Date(editing.ends_at)) : '')
  const [status, setStatus] = useState<AppointmentStatus>(editing?.status ?? 'confirmed')
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const service = useMemo(() => services.find((s) => s.id === serviceId), [services, serviceId])
  const duration = service?.duration_min ?? 60

  function toggleBlock(checked: boolean) {
    setIsBlock(checked)
    if (checked && !endTime && date && time) {
      setEndTime(hm(addMinutes(combine(date, time), 60)))
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!barberId || !date || !time) {
      setError('Barbier, date et heure sont requis.')
      return
    }
    const start = combine(date, time)
    let end: Date
    if (isBlock) {
      if (!endTime) {
        setError('Indiquez l’heure de fin de la plage à bloquer.')
        return
      }
      end = combine(date, endTime)
      if (end <= start) {
        setError('L’heure de fin doit être après l’heure de début.')
        return
      }
    } else {
      if (!serviceId) {
        setError('Choisissez un service.')
        return
      }
      end = addMinutes(start, duration)
    }

    const validationError = validateSlot(start, end, barberId, { ...ctx, excludeId: editing?.id })
    if (validationError) {
      setError(validationError)
      return
    }
    setBusy(true)
    setError(null)
    const payload = {
      client_id: isBlock ? null : clientId || null,
      service_id: isBlock ? null : serviceId,
      barber_id: barberId,
      starts_at: start.toISOString(),
      ends_at: end.toISOString(),
      status: isBlock ? ('confirmed' as AppointmentStatus) : status,
      notes: notes.trim() || null,
      is_block: isBlock,
    }
    try {
      if (editing) await updateAppointment(editing.id, payload)
      else await createAppointment({ ...payload, source: 'internal' })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l’enregistrement')
      setBusy(false)
    }
  }

  async function quickStatus(s: AppointmentStatus) {
    if (!editing) return
    setBusy(true)
    setError(null)
    try {
      await updateAppointment(editing.id, { status: s })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la mise à jour')
      setBusy(false)
    }
  }

  async function onDelete() {
    if (!editing) return
    if (!window.confirm(isBlock ? 'Supprimer cette plage bloquée ?' : 'Supprimer ce rendez-vous ?')) return
    setBusy(true)
    try {
      await deleteAppointment(editing.id)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de suppression')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onCancel}>
      <form onSubmit={onSubmit} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-stone-800">
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-100">
            {editing ? (isBlock ? 'Plage bloquée' : 'Rendez-vous') : 'Nouveau rendez-vous'}
          </h2>
          <div className="flex items-center gap-3">
            {!editing && (
              <label className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
                <input type="checkbox" checked={isBlock} onChange={(e) => toggleBlock(e.target.checked)} />
                Bloquer cette plage horaire
              </label>
            )}
            <button type="button" onClick={onCancel} className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200" aria-label="Fermer">
              ✕
            </button>
          </div>
        </div>

        {editing && !isBlock && (
          <div className="mt-2 rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-600 dark:bg-stone-700 dark:text-stone-300">
            {service ? `${service.name} · ${duration} min · ${formatPrice(service.price_cents)}` : ''}
            {editing.client?.phone ? ` · ☎ ${editing.client.phone}` : ''}
          </div>
        )}

        {!isBlock && (
          <>
            <div className="mt-4">
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">Client</label>
              <select className={inputClass} value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">— Sans fiche client —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {clientFullName(c)}
                    {c.phone ? ` (${c.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">Service</label>
              <select className={inputClass} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {formatPrice(s.price_cents)}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <div className="mt-4">
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">Barbier</label>
          <select className={inputClass} value={barberId} onChange={(e) => setBarberId(e.target.value)} required>
            {barbers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">Date</label>
            <input className={inputClass} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">{isBlock ? 'Début' : 'Heure'}</label>
            <input className={inputClass} type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
          </div>
          <div>
            {isBlock ? (
              <>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">Fin</label>
                <input className={inputClass} type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
              </>
            ) : (
              <>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">Statut</label>
                <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as AppointmentStatus)}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">Notes internes</label>
          <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {editing && !isBlock && (
          <div className="mt-4 flex flex-wrap gap-2">
            {QUICK.map((q) => (
              <button
                key={q.status}
                type="button"
                disabled={busy}
                onClick={() => quickStatus(q.status)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-60 ${q.cls}`}
              >
                {q.label}
              </button>
            ))}
          </div>
        )}

        {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="mt-6 flex items-center justify-between">
          {editing ? (
            <button type="button" onClick={onDelete} disabled={busy} className="text-sm text-red-600 hover:underline disabled:opacity-60">
              Supprimer
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-3">
            <button type="button" onClick={onCancel} className="rounded-lg px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-700">
              Annuler
            </button>
            <button type="submit" disabled={busy} className="rounded-lg bg-amber-800 px-4 py-2 text-sm font-medium text-white hover:bg-amber-900 disabled:opacity-60">
              {busy ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
