import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { clearMyPasswordChangeFlag, changeMyPassword, getMyBarber } from '../lib/barbers'
import type { Barber, BarberRole } from '../lib/barbers'
import type { AdminContext } from '../lib/adminContext'
import { PASSWORD_RULES, validateStrongPassword } from '../lib/password'
import logoLight from '../assets/signa-light.png'
import logoDark from '../assets/signa-dark.png'

type Module = { to: string; label: string; icon: string; adminOnly?: boolean }

/** Suit l'état du thème (classe .dark sur <html>) de façon réactive. */
function useIsDark() {
  const [isDark, setIsDark] = useState(
    () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  )
  useEffect(() => {
    const el = document.documentElement
    const obs = new MutationObserver(() => setIsDark(el.classList.contains('dark')))
    obs.observe(el, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return isDark
}

/** Emblème Signa (sans tuile) : un SEUL logo, « S » crème en sombre, near-black en clair. */
function SignaLogo() {
  const isDark = useIsDark()
  return <img src={isDark ? logoDark : logoLight} alt="Signa" className="h-9 w-auto shrink-0" />
}

const modules: Module[] = [
  { to: '/admin/agenda', label: 'Agenda', icon: '📅' },
  { to: '/admin/clients', label: 'Clients', icon: '👤' },
  { to: '/admin/services', label: 'Services', icon: '✂', adminOnly: true },
  { to: '/admin/barbiers', label: 'Barbiers', icon: '💈', adminOnly: true },
  { to: '/admin/parametres', label: 'Paramètres', icon: '⚙' },
]

/* ---------- Changement de mot de passe forcé à la première connexion ---------- */
function ForcePasswordChange({ onDone }: { onDone: () => void }) {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const invalid = validateStrongPassword(password)
    if (invalid) {
      setError(invalid)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await changeMyPassword(password)
      await clearMyPasswordChangeFlag()
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
      setBusy(false)
    }
  }

  async function cancel() {
    await signOut()
    navigate('/admin/login', { replace: true })
  }

  return (
    <div className="grid min-h-screen place-items-center bg-bg px-4">
      <form onSubmit={submit} className="w-full max-w-sm ui-card p-8 shadow-lg">
        <h1 className="text-xl font-semibold text-fg">Choisissez votre mot de passe</h1>
        <p className="mt-1 text-sm text-muted">
          Pour votre sécurité, vous devez remplacer le mot de passe temporaire avant de continuer.
        </p>
        <label className="mt-6 block text-sm font-medium text-fg">Nouveau mot de passe</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
          required
          className="mt-1 w-full ui-input"
        />
        <ul className="mt-3 space-y-1 text-xs">
          {PASSWORD_RULES.map((r) => (
            <li key={r.label} className={r.test(password) ? 'text-success' : 'text-muted'}>
              {r.test(password) ? '✓' : '•'} {r.label}
            </li>
          ))}
        </ul>
        {error && <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <button type="submit" disabled={busy} className="mt-6 w-full ui-btn-primary">
          {busy ? 'Enregistrement…' : 'Valider et continuer'}
        </button>
        <button type="button" onClick={cancel} className="mt-3 w-full text-sm text-muted hover:underline">
          Se déconnecter
        </button>
      </form>
    </div>
  )
}

export function AdminLayout() {
  const { session, signOut } = useAuth()
  const navigate = useNavigate()
  const [myBarber, setMyBarber] = useState<Barber | null>(null)
  const [myRole, setMyRole] = useState<BarberRole | null>(null)
  const [mustChange, setMustChange] = useState(false)
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches,
  )

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)')
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    let active = true
    getMyBarber()
      .then((b) => {
        if (!active) return
        setMyBarber(b)
        setMyRole(b?.role ?? null)
        setMustChange(b?.must_change_password ?? false)
      })
      .catch(() => {
        /* le rôle reste null : accès barbier par défaut */
      })
    return () => {
      active = false
    }
  }, [])

  async function onSignOut() {
    await signOut()
    navigate('/admin/login', { replace: true })
  }

  if (mustChange) {
    return <ForcePasswordChange onDone={() => setMustChange(false)} />
  }

  const isAdmin = myRole === 'admin'
  const visibleModules = modules.filter((m) => !m.adminOnly || isAdmin)
  const ctx: AdminContext = { myBarber, myRole, isAdmin }
  const displayName = myBarber?.name ?? null

  /* ============================ MISE EN PAGE MOBILE ============================ */
  if (isMobile) {
    return (
      <div className="flex min-h-screen flex-col bg-bg text-fg">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border bg-sidebar px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <SignaLogo />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">Les Frères Barbiers</div>
              <div className="truncate text-xs text-muted">CRM Signa - Barber Shop</div>
            </div>
          </div>
          <button
            onClick={onSignOut}
            className="shrink-0 rounded-lg px-2 py-1 text-xs text-muted hover:bg-bg-subtle"
            aria-label="Se déconnecter"
          >
            Quitter
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 pb-28">
          <Outlet context={ctx} />
        </main>

        {/* Barre de navigation en bas, façon application mobile */}
        <nav
          className="fixed inset-x-0 bottom-0 z-40 grid border-t border-border bg-sidebar pb-[env(safe-area-inset-bottom)]"
          style={{ gridTemplateColumns: `repeat(${visibleModules.length}, minmax(0, 1fr))` }}
        >
          {visibleModules.map((m) => (
            <NavLink
              key={m.to}
              to={m.to}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition ${
                  isActive ? 'text-accent' : 'text-muted'
                }`
              }
            >
              <span className="text-xl leading-none">{m.icon}</span>
              {m.label}
            </NavLink>
          ))}
        </nav>
      </div>
    )
  }

  /* ============================ MISE EN PAGE BUREAU ============================ */
  return (
    <div className="flex min-h-screen bg-bg text-fg">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-sidebar">
        <div className="flex items-center gap-2 border-b border-border px-5 py-4">
          <SignaLogo />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">Les Frères Barbiers</div>
            <div className="truncate text-xs text-muted">CRM Signa - Barber Shop</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 p-3">
          {visibleModules.map((m) => (
            <NavLink
              key={m.to}
              to={m.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg border-l-2 px-3 py-2 text-sm font-medium transition ${
                  isActive
                    ? 'border-accent bg-bg-subtle text-fg'
                    : 'border-transparent text-muted hover:bg-bg-subtle hover:text-fg'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`text-base leading-none ${isActive ? 'text-accent' : ''}`}>{m.icon}</span>
                  {m.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-border p-3">
          {displayName && <div className="truncate px-3 text-sm font-medium text-fg">{displayName}</div>}
          <div className="truncate px-3 pb-2 text-xs text-muted">{session?.user.email}</div>
          <button
            onClick={onSignOut}
            className="w-full rounded-lg px-3 py-2 text-left text-sm text-muted transition hover:bg-bg-subtle hover:text-fg"
          >
            Se déconnecter
          </button>
        </div>
      </aside>
      <main className="flex-1 p-8">
        <Outlet context={ctx} />
      </main>
    </div>
  )
}
