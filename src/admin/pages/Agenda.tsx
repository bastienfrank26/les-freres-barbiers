import { useEffect, useMemo, useState } from 'react'
import { WeekDayGrid } from '../agenda/WeekDayGrid'
import { MonthView } from '../agenda/MonthView'
import { AppointmentModal } from '../agenda/AppointmentModal'
import type { ModalState } from '../agenda/AppointmentModal'
import {
  listAppointmentsBetween,
  updateAppointment,
  validateSlot,
} from '../../lib/appointments'
import type { Appointment } from '../../lib/appointments'
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
  const visibleAppointments = useMemo(() => {
    const base = appointments.filter((a) => activeBarberIds.has(a.barber_id))
    return barberFilter === 'all' ? base : base.filter((a) => a.barber_id === barberFilter)
  }, [appointments, activeBarberIds, barberFilter])

  const { startMin, endMin } = useMemo(() => gridRange(hours), [hours])

  function shift(dir: number) {
    if (view === 'day') setCursor((c) => addDays(c, dir))
    else if (view === 'week') setCursor((c) => addDays(c, dir * 7))
    else setCursor((c) => new Date(c.getFullYear(), c.getMonth() + dir, 1))
  }

  function onCreateSlot(slot: Date) {
    const barberId = barberFilter !== 'all' ? barberFilter : barbers[0]?.id ?? ''
    if (!barberId) {
      setError('Aucun barbier actif. Ajoutez un barbier avant de créer un rendez-vous.')
      return
    }
    setModal({ mode: 'create', date: ymd(slot), time: hm(slot), barberId })
  }

  async function onMoveAppointment(a: Appointment, newStart: Date) {
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
      className={`rounded-lg px-3 py-1.5 text-sm transition ${view === v ? 'bg-amber-800 text-white' : 'text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-700'}`}
    >
      {label}
    </button>
  )

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-800 dark:text-stone-100">Agenda</h1>
          <p className="mt-1 text-sm capitalize text-stone-500 dark:text-stone-400">{title}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={barberFilter}
            onChange={(e) => setBarberFilter(e.target.value)}
            className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm outline-none focus:border-amber-700 dark:border-stone-600 dark:bg-stone-700 dark:text-stone-100"
          >
            <option value="all">Tous les barbiers</option>
            {barbers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <div className="flex items-center rounded-lg border border-stone-200 bg-white p-0.5 dark:border-stone-700 dark:bg-stone-800">
            {viewBtn('day', 'Jour')}
            {viewBtn('week', 'Semaine')}
            {viewBtn('month', 'Mois')}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => shift(-1)} className="rounded-lg px-2 py-1.5 text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-700" aria-label="Précédent">
              ‹
            </button>
            <button onClick={() => setCursor(new Date())} className="rounded-lg px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-700">
              Aujourd’hui
            </button>
            <button onClick={() => shift(1)} className="rounded-lg px-2 py-1.5 text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-700" aria-label="Suivant">
              ›
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-4 flex items-center justify-between rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-3 text-red-500 hover:text-red-700">
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
            barberId={barberFilter === 'all' ? undefined : barberFilter}
            onCreateSlot={onCreateSlot}
            onSelectAppointment={(a) => setModal({ mode: 'edit', appointment: a })}
            onMoveAppointment={onMoveAppointment}
          />
        )}
      </div>

      {modal && (
        <AppointmentModal
          state={modal}
          clients={clients}
          services={services}
          barbers={barbers}
          ctx={{ hours, closures, appointments }}
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
