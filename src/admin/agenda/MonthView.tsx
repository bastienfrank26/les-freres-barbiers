import type { Appointment } from '../../lib/appointments'
import { BLOCK_COLOR, STATUS_COLORS } from '../../lib/appointments'
import { DAY_LABELS_SHORT, addDays, hm, sameDay, startOfMonth, startOfWeek } from '../../lib/datetime'

type Props = {
  cursor: Date
  appointments: Appointment[]
  onSelectDay: (d: Date) => void
  onSelectAppointment: (a: Appointment) => void
}

export function MonthView({ cursor, appointments, onSelectDay, onSelectAppointment }: Props) {
  const first = startOfWeek(startOfMonth(cursor))
  const cells = Array.from({ length: 42 }, (_, i) => addDays(first, i))
  const month = cursor.getMonth()

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="grid grid-cols-7 border-b border-border bg-bg-subtle text-center text-xs font-medium uppercase tracking-wide text-muted">
        {DAY_LABELS_SHORT.map((l) => (
          <div key={l} className="py-2">
            {l}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d) => {
          const inMonth = d.getMonth() === month
          const today = sameDay(d, new Date())
          const dayAppts = appointments.filter((a) => sameDay(new Date(a.starts_at), d))
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => onSelectDay(d)}
              className={`min-h-[104px] border-b border-r border-border p-1.5 text-left align-top hover:bg-accent-soft ${
                inMonth ? '' : 'bg-bg-subtle text-muted'
              }`}
            >
              <div className={`mb-1 text-xs ${today ? 'font-semibold text-accent' : inMonth ? 'text-muted' : ''}`}>
                {d.getDate()}
              </div>
              <div className="space-y-0.5">
                {dayAppts.slice(0, 3).map((a) => {
                  const palette = a.is_block ? BLOCK_COLOR : STATUS_COLORS[a.status]
                  return (
                    <div
                      key={a.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectAppointment(a)
                      }}
                      style={{ backgroundColor: palette.bg, color: palette.text }}
                      className="truncate rounded px-1 py-0.5 text-[11px]"
                    >
                      {hm(new Date(a.starts_at))} {a.is_block ? '⛔' : a.client ? a.client.first_name : a.service?.name ?? 'RDV'}
                    </div>
                  )
                })}
                {dayAppts.length > 3 && <div className="text-[11px] text-muted">+{dayAppts.length - 3}</div>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
