import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  changeMyPassword,
  createAccountForBarber,
  createBarber,
  deleteBarber,
  getMyRole,
  listBarbers,
  setBarberPassword,
  setBarberRole,
  updateBarber,
} from '../../lib/barbers'
import type { Barber, BarberInput, BarberRole } from '../../lib/barbers'
import { useAuth } from '../../lib/auth'

const inputClass =
  'mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-700 focus:ring-2 focus:ring-amber-700/20 dark:border-stone-600 dark:bg-stone-700 dark:text-stone-100'
const modalCard = 'w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-stone-800'
const primaryBtn = 'rounded-lg bg-amber-800 px-4 py-2 text-sm font-medium text-white hover:bg-amber-900 disabled:opacity-60'
const ghostBtn = 'rounded-lg px-4 py-2 text-sm text-stone-600 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-700'

/* ---------- Modale : éditer nom/couleur/actif d'un barbier ---------- */
function BarberForm({ initial, onCancel, onSaved }: { initial?: Barber; onCancel: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState<BarberInput>({
    name: initial?.name ?? '',
    color: initial?.color ?? '#b87333',
    is_active: initial?.is_active ?? true,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (initial) await updateBarber(initial.id, draft)
      else await createBarber({ ...draft, name: draft.name.trim() })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onCancel}>
      <form onSubmit={onSubmit} onClick={(e) => e.stopPropagation()} className={modalCard}>
        <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-100">{initial ? 'Modifier le barbier' : 'Nouveau barbier'}</h2>
        <div className="mt-4">
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">Nom</label>
          <input className={inputClass} value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} required />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">Couleur</label>
            <input type="color" value={draft.color} onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))} className="mt-1 h-10 w-16 rounded border border-stone-300" />
          </div>
          <label className="mt-5 flex items-center gap-2 text-sm text-stone-700 dark:text-stone-300">
            <input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft((d) => ({ ...d, is_active: e.target.checked }))} />
            Actif
          </label>
        </div>
        {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className={ghostBtn}>Annuler</button>
          <button type="submit" disabled={busy} className={primaryBtn}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </form>
    </div>
  )
}

/* ---------- Modale : créer un compte de connexion pour un barbier ---------- */
function AccountForm({ barber, onCancel, onSaved }: { barber: Barber; onCancel: () => void; onSaved: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<BarberRole>('barber')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      setError('Le mot de passe doit faire au moins 6 caractères.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await createAccountForBarber(barber.id, email.trim(), password, role)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onCancel}>
      <form onSubmit={onSubmit} onClick={(e) => e.stopPropagation()} className={modalCard}>
        <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-100">Compte de connexion — {barber.name}</h2>
        <div className="mt-4">
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">Courriel</label>
          <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">Mot de passe</label>
          <input className={inputClass} type="text" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">Rôle</label>
          <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value as BarberRole)}>
            <option value="barber">Barbier</option>
            <option value="admin">Administrateur</option>
          </select>
        </div>
        {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className={ghostBtn}>Annuler</button>
          <button type="submit" disabled={busy} className={primaryBtn}>{busy ? 'Création…' : 'Créer le compte'}</button>
        </div>
      </form>
    </div>
  )
}

/* ---------- Modale : changer un mot de passe ---------- */
function PasswordForm({ title, onSubmit, onCancel }: { title: string; onSubmit: (pwd: string) => Promise<void>; onCancel: () => void }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      setError('Le mot de passe doit faire au moins 6 caractères.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSubmit(password)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onCancel}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className={modalCard}>
        <h2 className="text-lg font-semibold text-stone-800 dark:text-stone-100">{title}</h2>
        {done ? (
          <>
            <p className="mt-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">Mot de passe mis à jour.</p>
            <div className="mt-6 flex justify-end">
              <button type="button" onClick={onCancel} className={primaryBtn}>Fermer</button>
            </div>
          </>
        ) : (
          <>
            <div className="mt-4">
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">Nouveau mot de passe</label>
              <input className={inputClass} type="text" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={onCancel} className={ghostBtn}>Annuler</button>
              <button type="submit" disabled={busy} className={primaryBtn}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
            </div>
          </>
        )}
      </form>
    </div>
  )
}

export function Barbiers() {
  const { session } = useAuth()
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [myRole, setMyRole] = useState<BarberRole | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<Barber | 'new' | null>(null)
  const [accountFor, setAccountFor] = useState<Barber | null>(null)
  const [pwdFor, setPwdFor] = useState<Barber | null>(null)
  const [myPwdOpen, setMyPwdOpen] = useState(false)

  async function load() {
    try {
      setBarbers(await listBarbers())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    }
  }

  useEffect(() => {
    let active = true
    Promise.all([listBarbers(), getMyRole()])
      .then(([b, r]) => {
        if (!active) return
        setBarbers(b)
        setMyRole(r)
      })
      .catch((err) => active && setError(err instanceof Error ? err.message : 'Erreur de chargement'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const isAdmin = myRole === 'admin'

  async function toggleActive(b: Barber) {
    try {
      await updateBarber(b.id, { is_active: !b.is_active })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    }
  }

  async function changeRole(b: Barber, role: BarberRole) {
    try {
      await setBarberRole(b.id, role)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    }
  }

  async function onDelete(b: Barber) {
    if (!window.confirm(`Supprimer le barbier « ${b.name} » ?`)) return
    try {
      await deleteBarber(b.id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de suppression')
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-stone-800 dark:text-stone-100">Barbiers</h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            {barbers.length} barbier{barbers.length > 1 ? 's' : ''} · agendas, comptes et rôles.
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => setEditing('new')} className={primaryBtn}>
            + Ajouter
          </button>
        )}
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* Mon compte (tout utilisateur connecté) */}
      <div className="mt-6 rounded-2xl border border-stone-200 bg-white p-5 dark:border-stone-700 dark:bg-stone-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-stone-800 dark:text-stone-100">Mon compte</h2>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              {session?.user.email} · {myRole === 'admin' ? 'Administrateur' : myRole === 'barber' ? 'Barbier' : '—'}
            </p>
          </div>
          <button onClick={() => setMyPwdOpen(true)} className={ghostBtn}>
            Changer mon mot de passe
          </button>
        </div>
      </div>

      {!isAdmin && (
        <p className="mt-4 text-sm text-stone-500 dark:text-stone-400">
          Seul un administrateur peut gérer les barbiers et leurs comptes.
        </p>
      )}

      {isAdmin && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-800">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500 dark:bg-stone-900 dark:text-stone-400">
              <tr>
                <th className="px-4 py-3 font-medium">Barbier</th>
                <th className="px-4 py-3 font-medium">Compte</th>
                <th className="px-4 py-3 font-medium">Rôle</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-700">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-stone-400">Chargement…</td></tr>
              ) : (
                barbers.map((b) => (
                  <tr key={b.id} className={b.is_active ? '' : 'opacity-50'}>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2 font-medium text-stone-800 dark:text-stone-100">
                        <span className="inline-block h-4 w-4 rounded-full" style={{ backgroundColor: b.color }} />
                        {b.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-stone-500 dark:text-stone-400">{b.email ?? '—'}</td>
                    <td className="px-4 py-3">
                      {b.user_id ? (
                        <select
                          value={b.role}
                          onChange={(e) => changeRole(b, e.target.value as BarberRole)}
                          className="rounded-lg border border-stone-300 px-2 py-1 text-sm dark:border-stone-600 dark:bg-stone-700 dark:text-stone-100"
                        >
                          <option value="barber">Barbier</option>
                          <option value="admin">Administrateur</option>
                        </select>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(b)}
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${b.is_active ? 'bg-green-100 text-green-700' : 'bg-stone-200 text-stone-500'}`}
                      >
                        {b.is_active ? 'Actif' : 'Désactivé'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      {b.user_id ? (
                        <button onClick={() => setPwdFor(b)} className="text-amber-800 hover:underline dark:text-amber-500">Mot de passe</button>
                      ) : (
                        <button onClick={() => setAccountFor(b)} className="text-amber-800 hover:underline dark:text-amber-500">Créer un compte</button>
                      )}
                      <button onClick={() => setEditing(b)} className="ml-3 text-stone-600 hover:underline dark:text-stone-300">Modifier</button>
                      <button onClick={() => onDelete(b)} className="ml-3 text-red-600 hover:underline">Suppr.</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <BarberForm initial={editing === 'new' ? undefined : editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />
      )}
      {accountFor && (
        <AccountForm barber={accountFor} onCancel={() => setAccountFor(null)} onSaved={() => { setAccountFor(null); load() }} />
      )}
      {pwdFor && (
        <PasswordForm
          title={`Mot de passe — ${pwdFor.name}`}
          onSubmit={(pwd) => setBarberPassword(pwdFor.id, pwd)}
          onCancel={() => setPwdFor(null)}
        />
      )}
      {myPwdOpen && (
        <PasswordForm title="Changer mon mot de passe" onSubmit={(pwd) => changeMyPassword(pwd)} onCancel={() => setMyPwdOpen(false)} />
      )}
    </div>
  )
}
