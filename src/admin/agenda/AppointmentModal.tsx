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
import type { Client } from '../../lib/clients'
import type { Service } from '../../lib/services'
import { clientFullName, createClient } from '../../lib/clients'
import { formatPrice } from '../../lib/services'
import { addMinutes, combine, hm, ymd } from '../../lib/datetime'

export type ModalState =
  | { mode: 'create'; date: string; time: string; barberId: string }
  | { mode: 'edit'; appointment: Appointment }

type Props = {
  state: ModalState
  clients: Client[]
  services: Service[]
  ctx: { hours: BusinessHour[]; closures: Closure[]; appointments: Appointment[] }
  canEdit?: boolean
  onCancel: () => void
  onSaved: () => void
}

const inputClass =
  'mt-1 w-full ui-input'

const NEW_CLIENT = '__new__'

const STATUSES: AppointmentStatus[] = ['pending', 'confirmed', 'completed', 'no_show', 'paid', 'cancelled']

const QUICK: { status: AppointmentStatus; label: string; cls: string }[] = [
  { status: 'confirmed', label: 'Confirmé', cls: 'bg-success-soft text-success hover:opacity-80' },
  { status: 'cancelled', label: 'Annulé', cls: 'bg-danger-soft text-danger hover:opacity-80' },
  { status: 'no_show', label: 'Absent', cls: 'bg-bg-subtle text-muted hover:opacity-80' },
  { status: 'paid', label: 'Payé', cls: 'bg-accent-soft text-accent hover:opacity-80' },
]

export function AppointmentModal({ state, clients, services, ctx, canEdit = true, onCancel, onSaved }: Props) {
  const editing = state.mode === 'edit' ? state.appointment : null
  const barberId = editing?.barber_id ?? (state.mode === 'create' ? state.barberId : '')

  const [isBlock, setIsBlock] = useState(editing?.is_block ?? false)
  const [clientId, setClientId] = useState(editing?.client_id ?? '')
  const [newClient, setNewClient] = useState({ name: '', email: '', phone: '' })
  const [serviceId, setServiceId] = useState(editing?.service_id ?? services[0]?.id ?? '')
  const [date, setDate] = useState(editing ? ymd(new Date(editing.starts_at)) : state.mode === 'create' ? state.date : '')
  const [time, setTime] = useState(editing ? hm(new Date(editing.starts_at)) : state.mode === 'create' ? state.time : '')
  const [endTime, setEndTime] = useState(editing ? hm(new Date(editing.ends_at)) : '')
  const [status, setStatus] = useState<AppointmentStatus>(editing?.status ?? 'confirmed')
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const service = useMemo(() => services.find((s) => s.id === serviceId), [services, serviceId])
  const duration = service?.duration_min ?? 60
  const readOnly = !canEdit

  function toggleBlock(checked: boolean) {
    setIsBlock(checked)
    if (checked && !endTime && date && time) {
      setEndTime(hm(addMinutes(combine(date, time), 60)))
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (readOnly) return
    if (!barberId || !date || !time) {
      setError('Date et heure sont requis.')
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

    // Création éventuelle d'une nouvelle fiche client.
    let resolvedClientId: string | null = clientId || null
    if (!isBlock && clientId === NEW_CLIENT) {
      const name = newClient.name.trim()
      if (!name) {
        setError('Indiquez le nom du nouveau client.')
        setBusy(false)
        return
      }
      const [first, ...rest] = name.split(/\s+/)
      try {
        resolvedClientId = await createClient({
          first_name: first,
          last_name: rest.join(' ') || null,
          email: newClient.email.trim() || null,
          phone: newClient.phone.trim() || null,
          notes: null,
          barber_id: barberId || null,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur lors de la création du client')
        setBusy(false)
        return
      }
    }

    const payload = {
      client_id: isBlock ? null : resolvedClientId,
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
    if (!editing || readOnly) return
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
    if (!editing || readOnly) return
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
      <form onSubmit={onSubmit} onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-lg overflow-y-auto ui-card p-6 shadow-xl">
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-semibold text-fg">
            {editing ? (isBlock ? 'Plage bloquée' : 'Rendez-vous') : 'Nouveau rendez-vous'}
          </h2>
          <div className="flex items-center gap-3">
            {!editing && (
              <label className="flex items-center gap-2 text-sm text-muted">
                <input type="checkbox" checked={isBlock} onChange={(e) => toggleBlock(e.target.checked)} />
                Bloquer cette plage horaire
              </label>
            )}
            <button type="button" onClick={onCancel} className="text-muted hover:text-fg" aria-label="Fermer">
              ✕
            </button>
          </div>
        </div>

        {readOnly && (
          <p className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
            Ce rendez-vous appartient à un autre barbier. Seul un administrateur peut le modifier.
          </p>
        )}

        {editing && !isBlock && (
          <div className="mt-2 rounded-lg bg-bg-subtle px-3 py-2 text-sm text-muted">
            {service ? `${service.name} · ${duration} min · ${formatPrice(service.price_cents)}` : ''}
            {editing.client?.phone ? ` · ☎ ${editing.client.phone}` : ''}
          </div>
        )}

        {!isBlock && (
          <>
            <div className="mt-4">
              <label className="block text-sm font-medium text-fg">Client</label>
              <select className={inputClass} value={clientId} onChange={(e) => setClientId(e.target.value)} disabled={readOnly}>
                <option value="">— Sans fiche client —</option>
                <option value={NEW_CLIENT}>+ Ajouter un nouveau client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {clientFullName(c)}
                    {c.phone ? ` (${c.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {clientId === NEW_CLIENT && (
              <div className="mt-3 grid grid-cols-1 gap-3 rounded-lg border border-border p-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-fg">Nom</label>
                  <input
                    className={inputClass}
                    value={newClient.name}
                    onChange={(e) => setNewClient((c) => ({ ...c, name: e.target.value }))}
                    disabled={readOnly}
                    placeholder="Prénom Nom"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-fg">Courriel</label>
                  <input
                    className={inputClass}
                    type="email"
                    value={newClient.email}
                    onChange={(e) => setNewClient((c) => ({ ...c, email: e.target.value }))}
                    disabled={readOnly}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-fg">Téléphone</label>
                  <input
                    className={inputClass}
                    type="tel"
                    value={newClient.phone}
                    onChange={(e) => setNewClient((c) => ({ ...c, phone: e.target.value }))}
                    disabled={readOnly}
                  />
                </div>
              </div>
            )}

            <div className="mt-4">
              <label className="block text-sm font-medium text-fg">Service</label>
              <select className={inputClass} value={serviceId} onChange={(e) => setServiceId(e.target.value)} disabled={readOnly}>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {formatPrice(s.price_cents)}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <div className="mt-4 grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-fg">Date</label>
            <input className={inputClass} type="date" value={date} onChange={(e) => setDate(e.target.value)} required disabled={readOnly} />
          </div>
          <div>
            <label className="block text-sm font-medium text-fg">{isBlock ? 'Début' : 'Heure'}</label>
            <input className={inputClass} type="time" value={time} onChange={(e) => setTime(e.target.value)} required disabled={readOnly} />
          </div>
          <div>
            {isBlock ? (
              <>
                <label className="block text-sm font-medium text-fg">Fin</label>
                <input className={inputClass} type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required disabled={readOnly} />
              </>
            ) : (
              <>
                <label className="block text-sm font-medium text-fg">Statut</label>
                <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as AppointmentStatus)} disabled={readOnly}>
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
          <label className="block text-sm font-medium text-fg">Notes internes</label>
          <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={readOnly} />
        </div>

        {editing && !isBlock && !readOnly && (
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

        {error && <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

        <div className="mt-6 flex items-center justify-between">
          {editing && !readOnly ? (
            <button type="button" onClick={onDelete} disabled={busy} className="text-sm text-danger hover:underline disabled:opacity-60">
              Supprimer
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-3">
            <button type="button" onClick={onCancel} className="ui-btn-ghost">
              {readOnly ? 'Fermer' : 'Annuler'}
            </button>
            {!readOnly && (
              <button type="submit" disabled={busy} className="ui-btn-primary">
                {busy ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}
