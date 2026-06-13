import type { Appointment } from '../../lib/appointments'
import type { BusinessHour, Closure } from '../../lib/businessHours'
import { dayConfig, isClosedByClosure } from '../../lib/businessHours'
import { DAY_LABELS_SHORT, hm, minutesToTime, sameDay, weekdayIndex } from '../../lib/datetime'

/** Rendez-vous en cours de glisser-déposer (une seule grille montée à la fois). */
let draggedAppointment: Appointment | null = null

type Props = {
  days: Date[]
  startMin: number
  endMin: number
  hours: BusinessHour[]
  closures: Closure[]
  appointments: Appointment[]
  barberId?: string
  onCreateSlot: (slot: Date) => void
  onSelectAppointment: (a: Appointment) => void
  onMoveAppointment: (a: Appointment, newStart: Date) => void
}

const ROW_H = 56

export function WeekDayGrid({
  days,
  startMin,
  endMin,
  hours,
  closures,
  appointments,
  barberId,
  onCreateSlot,
  onSelectAppointment,
  onMoveAppointment,
}: Props) {
  const hourCount = Math.max(1, Math.ceil((endMin - startMin) / 60))
  const rows = Array.from({ length: hourCount }, (_, i) => startMin + i * 60)
  const cols = `64px repeat(${days.length}, minmax(0, 1fr))`

  function isClosed(day: Date, min: number): boolean {
    const cfg = dayConfig(day, hours)
    if (cfg.closed) return true
    if (isClosedByClosure(day, closures, barberId)) return true
    return min < cfg.openMin || min >= cfg.closeMin
  }

  function slotDate(day: Date, min: number): Date {
    const d = new Date(day)
    d.setHours(Math.floor(min / 60), min % 60, 0, 0)
    return d
  }

  function durationMin(a: Appointment): number {
    if (a.service?.duration_min) return a.service.duration_min
    return Math.round((new Date(a.ends_at).getTime() - new Date(a.starts_at).getTime()) / 60000)
  }

  return (
    <div className="overflow-auto rounded-2xl border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-800">
      <div className="min-w-[680px]">
        {/* En-têtes de jours */}
        <div className="grid border-b border-stone-200 dark:border-stone-700" style={{ gridTemplateColumns: cols }}>
          <div />
          {days.map((d) => {
            const today = sameDay(d, new Date())
            return (
              <div key={d.toISOString()} className={`px-2 py-2 text-center text-sm ${today ? 'text-amber-800 dark:text-amber-500' : 'text-stone-600 dark:text-stone-300'}`}>
                <div className="font-medium">{DAY_LABELS_SHORT[weekdayIndex(d)]}</div>
                <div className={`text-xs ${today ? 'font-semibold' : 'text-stone-400'}`}>{d.getDate()}</div>
              </div>
            )
          })}
        </div>

        {/* Grille horaire */}
        <div className="relative grid" style={{ gridTemplateColumns: cols, gridTemplateRows: `repeat(${hourCount}, ${ROW_H}px)` }}>
          {/* Colonne des heures */}
          {rows.map((min, r) => (
            <div
              key={`t-${min}`}
              className="border-r border-stone-200 pr-2 pt-1 text-right text-xs text-stone-400 dark:border-stone-700"
              style={{ gridColumn: 1, gridRow: r + 1 }}
            >
              {minutesToTime(min)}
            </div>
          ))}

          {/* Cellules */}
          {days.map((d, c) =>
            rows.map((min, r) => {
              const closed = isClosed(d, min)
              return (
                <div
                  key={`c-${c}-${min}`}
                  style={{ gridColumn: c + 2, gridRow: r + 1 }}
                  className={`border-b border-r border-stone-100 dark:border-stone-700/70 ${closed ? 'bg-stone-100 dark:bg-stone-900/40' : 'cursor-pointer hover:bg-amber-50 dark:hover:bg-stone-700'}`}
                  onClick={closed ? undefined : () => onCreateSlot(slotDate(d, min))}
                  onDragOver={closed ? undefined : (e) => e.preventDefault()}
                  onDrop={
                    closed
                      ? undefined
                      : () => {
                          const a = draggedAppointment
                          draggedAppointment = null
                          if (a) onMoveAppointment(a, slotDate(d, min))
                        }
                  }
                />
              )
            }),
          )}

          {/* Rendez-vous */}
          {days.map((d, c) =>
            appointments
              .filter((a) => sameDay(new Date(a.starts_at), d))
              .map((a) => {
                const start = new Date(a.starts_at)
                const sMin = start.getHours() * 60 + start.getMinutes()
                const rowIndex = Math.floor((sMin - startMin) / 60)
                if (rowIndex < 0 || rowIndex >= hourCount) return null
                const span = Math.min(Math.max(1, Math.ceil(durationMin(a) / 60)), hourCount - rowIndex)
                const color = a.is_block ? '#57534e' : a.barber?.color ?? '#78716c'
                const cancelled = a.status === 'cancelled'
                return (
                  <button
                    key={a.id}
                    type="button"
                    draggable
                    onDragStart={() => {
                      draggedAppointment = a
                    }}
                    onClick={() => onSelectAppointment(a)}
                    style={{ gridColumn: c + 2, gridRow: `${rowIndex + 1} / span ${span}`, backgroundColor: color }}
                    className={`z-10 m-0.5 overflow-hidden rounded-md px-2 py-1 text-left text-xs text-white shadow-sm ${
                      cancelled ? 'opacity-50 line-through' : ''
                    } ${a.is_block ? 'opacity-80' : ''}`}
                  >
                    <div className="font-medium">
                      {hm(start)} {a.is_block ? '⛔ Bloqué' : a.service?.name ?? ''}
                    </div>
                    {!a.is_block && (
                      <div className="truncate opacity-90">
                        {a.client ? `${a.client.first_name} ${a.client.last_name ?? ''}`.trim() : 'Sans client'}
                      </div>
                    )}
                  </button>
                )
              }),
          )}
        </div>
      </div>
    </div>
  )
}
