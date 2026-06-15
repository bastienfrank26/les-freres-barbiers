import { useEffect, useMemo, useState } from 'react'
import { WeekDayGrid } from '../agenda/WeekDayGrid'
import { MonthView } from '../agenda/MonthView'
import { AppointmentModal } from '../agenda/AppointmentModal'
import type { ModalState } from '../agenda/AppointmentModal'
import {
  STATUS_COLORS,
  STATUS_LABELS,
  STATUS_ORDER,
  listAppointmentsBetween,
  updateAppointment,
  validateSlot,
} from '../../lib/appointments'
import type { Appointment } from '../../lib/appointments'
import { useAdminContext } from '../../lib/adminContext'
import { listActiveBarbers } from '../../lib/barbers'
import type { Barber } from '../../lib/barbers'
import { listActiveServices } from '../../lib/services'
import type { Service } from '../../lib/services'
import { listClients } from '../../lib/clients'
import type { Client } from '../../lib/clients'
import { gridRange, listBusinessHours, listClosures } from '../../lib/businessHours'
import type { BusinessHour, Closure } from '../../lib/businessHours'
import {
  addDays,
  addMinutes,
  formatLongDate,
  formatMonth,
  hm,
  startOfMonth,
  startOfWeek,
  ymd,
} from '../../lib/datetime'

type View = 'day' | 'week' | 'month'

export function Agenda() {
  const { myBarber, isAdmin } = useAdminContext()
  const [view, setView] = useState<View>('week')
  const [cursor, setCursor] = useState<Date>(() => new Date())
  const [barberFilter, setBarberFilter] = useState<string>('all')

  const [barbers, setBarbers] = useState<Barber[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [hours, setHours] = useState<BusinessHour[]>([])
  const [closures, setClosures] = useState<Closure[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])

  const [modal, setModal] = useState<ModalState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  /* Plage de dates visible */
  const range = useMemo(() => {
    if (view === 'day') {
      const start = new Date(cursor)
      start.setHours(0, 0, 0, 0)
      return { days: [start], start, end: addDays(start, 1) }
    }
    if (view === 'week') {
      const start = startOfWeek(cursor)
      return { days: Array.from({ length: 7 }, (_, i) => addDays(start, i)), start, end: addDays(start, 7) }
    }
    const start = startOfWeek(startOfMonth(cursor))
    return { days: [], start, end: addDays(start, 42) }
  }, [view, cursor])

  const startISO = range.start.toISOString()
  const endISO = range.end.toISOString()

  /* Données statiques (une fois) */
  useEffect(() => {
    let active = true
    Promise.all([listActiveBarbers(), listActiveServices(), listClients(), listBusinessHours(), listClosures()])
      .then(([b, s, c, h, cl]) => {
        if (!active) return
        setBarbers(b)
        setServices(s)
        setClients(c)
        setHours(h)
        setClosures(cl)
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Erreur de chargement')
      })
    return () => {
      active = false
    }
  }, [])

  /* Rendez-vous de la plage visible */
  useEffect(() => {
    let active = true
    listAppointmentsBetween(startISO, endISO)
      .then((a) => active && setAppointments(a))
      .catch((err) => active && setError(err instanceof Error ? err.message : 'Erreur de chargement des rendez-vous'))
    return () => {
      active = false
    }
  }, [startISO, endISO, refreshKey])

  // Barbiers actifs uniquement (les RDV des barbiers désactivés ne s'affichent pas).
  const activeBarberIds = useMemo(() => new Set(barbers.map((b) => b.id)), [barbers])

  // Un barbier ne voit que ses propres rendez-vous ; un admin voit selon le filtre choisi.
  const effectiveFilter = isAdmin ? barberFilter : myBarber?.id ?? '__none__'

  const visibleAppointments = useMemo(() => {
    const base = appointments.filter((a) => activeBarberIds.has(a.barber_id))
    return effectiveFilter === 'all' ? base : base.filter((a) => a.barber_id === effectiveFilter)
  }, [appointments, activeBarberIds, effectiveFilter])

  const { startMin, endMin } = useMemo(() => gridRange(hours), [hours])

  function shift(dir: number) {
    if (view === 'day') setCursor((c) => addDays(c, dir))
    else if (view === 'week') setCursor((c) => addDays(c, dir * 7))
    else setCursor((c) => new Date(c.getFullYear(), c.getMonth() + dir, 1))
  }

  function onCreateSlot(slot: Date) {
    // Un barbier crée toujours pour lui-même ; un admin pour le barbier filtré (ou le 1er).
    const barberId = isAdmin ? (barberFilter !== 'all' ? barberFilter : barbers[0]?.id ?? '') : myBarber?.id ?? ''
    if (!barberId) {
      setError(
        isAdmin
          ? 'Aucun barbier actif. Ajoutez un barbier avant de créer un rendez-vous.'
          : 'Votre compte n’est pas rattaché à un barbier actif.',
      )
      return
    }
    setModal({ mode: 'create', date: ymd(slot), time: hm(slot), barberId })
  }

  function canEditAppointment(a: Appointment): boolean {
    return isAdmin || a.barber_id === myBarber?.id
  }

  async function onMoveAppointment(a: Appointment, newStart: Date) {
    if (!canEditAppointment(a)) {
      setError('Seul un administrateur peut modifier le rendez-vous d’un autre barbier.')
      return
    }
    const duration = a.service?.duration_min ?? Math.round((new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) / 60000)
    const newEnd = addMinutes(newStart, duration)
    const validationError = validateSlot(newStart, newEnd, a.barber_id, { hours, closures, appointments, excludeId: a.id })
    if (validationError) {
      setError(validationError)
      return
    }
    setError(null)
    try {
      await updateAppointment(a.id, { starts_at: newStart.toISOString(), ends_at: newEnd.toISOString() })
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors du déplacement')
    }
  }

  const title =
    view === 'day' ? formatLongDate(cursor) : view === 'week' ? `Semaine du ${formatLongDate(range.days[0])}` : formatMonth(cursor)

  const viewBtn = (v: View, label: string) => (
    <button
      onClick={() => setView(v)}
      className={`rounded-lg px-3 py-1.5 text-sm transition ${view === v ? 'bg-accent text-accent-fg' : 'text-muted hover:bg-bg-subtle'}`}
    >
      {label}
    </button>
  )

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-fg">Agenda</h1>
          <p className="mt-1 text-sm capitalize text-muted">{title}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <select
              value={barberFilter}
              onChange={(e) => setBarberFilter(e.target.value)}
              className="ui-input px-3 py-1.5"
            >
              <option value="all">Tous les barbiers</option>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
          <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
            {viewBtn('day', 'Jour')}
            {viewBtn('week', 'Semaine')}
            {viewBtn('month', 'Mois')}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => shift(-1)} className="rounded-lg px-2 py-1.5 text-muted hover:bg-bg-subtle" aria-label="Précédent">
              ‹
            </button>
            <button onClick={() => setCursor(new Date())} className="rounded-lg px-3 py-1.5 text-sm text-muted hover:bg-bg-subtle">
              Aujourd’hui
            </button>
            <button onClick={() => shift(1)} className="rounded-lg px-2 py-1.5 text-muted hover:bg-bg-subtle" aria-label="Suivant">
              ›
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-4 flex items-center justify-between rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
          <button onClick={() => setError(null)} className="ml-3 text-danger hover:text-danger">
            ✕
          </button>
        </p>
      )}

      <div className="mt-6">
        {view === 'month' ? (
          <MonthView
            cursor={cursor}
            appointments={visibleAppointments}
            onSelectDay={(d) => {
              setCursor(d)
              setView('day')
            }}
            onSelectAppointment={(a) => setModal({ mode: 'edit', appointment: a })}
          />
        ) : (
          <WeekDayGrid
            days={range.days}
            startMin={startMin}
            endMin={endMin}
            hours={hours}
            closures={closures}
            appointments={visibleAppointments}
            barberId={effectiveFilter === 'all' ? undefined : effectiveFilter}
            onCreateSlot={onCreateSlot}
            onSelectAppointment={(a) => setModal({ mode: 'edit', appointment: a })}
            onMoveAppointment={onMoveAppointment}
          />
        )}
      </div>

      {/* Légende : code de couleurs selon l'état du rendez-vous */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
        <span className="font-medium text-muted">États :</span>
        {STATUS_ORDER.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ backgroundColor: STATUS_COLORS[s].bg }} />
            {STATUS_LABELS[s]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-sm bg-[#44403c]" />
          Plage bloquée
        </span>
      </div>

      {modal && (
        <AppointmentModal
          state={modal}
          clients={clients}
          services={services}
          ctx={{ hours, closures, appointments }}
          canEdit={modal.mode === 'create' || canEditAppointment(modal.appointment)}
          onCancel={() => setModal(null)}
          onSaved={() => {
            setModal(null)
            setRefreshKey((k) => k + 1)
          }}
        />
      )}
    </div>
  )
}
