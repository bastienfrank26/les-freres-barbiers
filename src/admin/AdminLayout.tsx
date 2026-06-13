import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'

const modules = [
  { to: '/admin/agenda', label: 'Agenda' },
  { to: '/admin/clients', label: 'Clients' },
  { to: '/admin/services', label: 'Services' },
  { to: '/admin/barbiers', label: 'Barbiers' },
  { to: '/admin/parametres', label: 'Paramètres' },
]

export function AdminLayout() {
  const { session, signOut } = useAuth()
  const navigate = useNavigate()

  async function onSignOut() {
    await signOut()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="flex min-h-screen bg-stone-100 text-stone-800 dark:bg-stone-900 dark:text-stone-100">
      <aside className="flex w-60 shrink-0 flex-col border-r border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-800">
        <div className="border-b border-stone-200 px-5 py-4 dark:border-stone-700">
          <div className="text-sm font-semibold">Les Frères Barbiers</div>
          <div className="text-xs text-stone-500 dark:text-stone-400">CRM Signa</div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {modules.map((m) => (
            <NavLink
              key={m.to}
              to={m.to}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm transition ${
                  isActive ? 'bg-amber-800 text-white' : 'text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-700'
                }`
              }
            >
              {m.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-stone-200 p-3 dark:border-stone-700">
          <div className="truncate px-3 pb-2 text-xs text-stone-500 dark:text-stone-400">{session?.user.email}</div>
          <button
            onClick={onSignOut}
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-stone-700 transition hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-700"
          >
            Se déconnecter
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8">
        <Outlet />
      </main>
    </div>
  )
}
