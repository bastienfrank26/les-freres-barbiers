import type { Appointment } from '../../lib/appointments'
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
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-800">
      <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50 text-center text-xs font-medium uppercase tracking-wide text-stone-500 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-400">
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
              className={`min-h-[104px] border-b border-r border-stone-100 p-1.5 text-left align-top hover:bg-amber-50 dark:border-stone-700/70 dark:hover:bg-stone-700 ${
                inMonth ? '' : 'bg-stone-50/60 text-stone-400 dark:bg-stone-900/40'
              }`}
            >
              <div className={`mb-1 text-xs ${today ? 'font-semibold text-amber-800 dark:text-amber-500' : inMonth ? 'text-stone-600 dark:text-stone-300' : ''}`}>
                {d.getDate()}
              </div>
              <div className="space-y-0.5">
                {dayAppts.slice(0, 3).map((a) => (
                  <div
                    key={a.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectAppointment(a)
                    }}
                    style={{ backgroundColor: a.barber?.color ?? '#78716c' }}
                    className={`truncate rounded px-1 py-0.5 text-[11px] text-white ${a.status === 'cancelled' ? 'opacity-50 line-through' : ''}`}
                  >
                    {hm(new Date(a.starts_at))} {a.client ? a.client.first_name : a.service?.name ?? 'RDV'}
                  </div>
                ))}
                {dayAppts.length > 3 && <div className="text-[11px] text-stone-400">+{dayAppts.length - 3}</div>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
