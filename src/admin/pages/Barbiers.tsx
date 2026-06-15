import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  barberEmail,
  changeMyPassword,
  createBarberWithAccount,
  deleteBarber,
  getMyRole,
  listBarbers,
  setBarberPassword,
  setBarberRole,
  updateBarber,
} from '../../lib/barbers'
import type { Barber, BarberInput, BarberRole } from '../../lib/barbers'
import { PASSWORD_RULES, TEMP_PASSWORD, validateStrongPassword } from '../../lib/password'
import { useAuth } from '../../lib/auth'

const inputClass = 'mt-1 w-full ui-input'
const modalCard = 'w-full max-w-sm ui-card p-6 shadow-xl'
const primaryBtn = 'ui-btn-primary'
const ghostBtn = 'ui-btn-ghost'

/* ---------- Modale : éditer nom / actif d'un barbier ---------- */
function BarberForm({ initial, onCancel, onSaved }: { initial: Barber; onCancel: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState<BarberInput>({ name: initial.name, is_active: initial.is_active })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await updateBarber(initial.id, { ...draft, name: draft.name.trim() })
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onCancel}>
      <form onSubmit={onSubmit} onClick={(e) => e.stopPropagation()} className={modalCard}>
        <h2 className="text-lg font-semibold text-fg">Modifier le barbier</h2>
        <div className="mt-4">
          <label className="block text-sm font-medium text-fg">Nom</label>
          <input className={inputClass} value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} required />
        </div>
        <label className="mt-4 flex items-center gap-2 text-sm text-fg">
          <input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft((d) => ({ ...d, is_active: e.target.checked }))} />
          Actif
        </label>
        {error && <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className={ghostBtn}>Annuler</button>
          <button type="submit" disabled={busy} className={primaryBtn}>{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </form>
    </div>
  )
}

/* ---------- Modale : créer un nouveau barbier (prénom + nom + rôle) ---------- */
function NewBarberForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (email: string) => void }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [role, setRole] = useState<BarberRole>('barber')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const preview = firstName.trim() && lastName.trim() ? barberEmail(firstName, lastName) : null

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim()) {
      setError('Le prénom et le nom sont requis.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const email = await createBarberWithAccount(firstName, lastName, TEMP_PASSWORD, role)
      onCreated(email)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onCancel}>
      <form onSubmit={onSubmit} onClick={(e) => e.stopPropagation()} className={modalCard}>
        <h2 className="text-lg font-semibold text-fg">Nouveau barbier</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-fg">Prénom</label>
            <input className={inputClass} value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-fg">Nom</label>
            <input className={inputClass} value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-sm font-medium text-fg">Rôle</label>
          <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value as BarberRole)}>
            <option value="barber">Barbier</option>
            <option value="admin">Administrateur</option>
          </select>
        </div>
        <p className="mt-4 rounded-lg bg-bg-subtle px-3 py-2 text-xs text-muted">
          Nom d’utilisateur : <span className="font-medium text-fg">{preview ?? 'prenom.nom@les-freres-barbiers.com'}</span>
          <br />
          Mot de passe temporaire : <span className="font-medium text-fg">{TEMP_PASSWORD}</span>
        </p>
        {error && <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className={ghostBtn}>Annuler</button>
          <button type="submit" disabled={busy} className={primaryBtn}>{busy ? 'Création…' : 'Créer le barbier'}</button>
        </div>
      </form>
    </div>
  )
}

/* ---------- Modale : compte créé / réinitialisé (affiche identifiants) ---------- */
function CredentialsDialog({ email, onClose }: { email: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className={modalCard}>
        <h2 className="text-lg font-semibold text-fg">Compte prêt ✓</h2>
        <p className="mt-3 text-sm text-fg">Nom d’utilisateur :</p>
        <p className="mt-1 rounded-lg bg-bg-subtle px-3 py-2 font-mono text-sm text-fg">{email}</p>
        <p className="mt-4 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
          Mot de passe temporaire : <strong>{TEMP_PASSWORD}</strong>
          <br />
          L’utilisateur devra choisir un nouveau mot de passe à sa première connexion.
        </p>
        <div className="mt-6 flex justify-end">
          <button type="button" onClick={onClose} className={primaryBtn}>Fermer</button>
        </div>
      </div>
    </div>
  )
}

/* ---------- Modale : changer son propre mot de passe (critères élevés) ---------- */
function PasswordForm({ onCancel }: { onCancel: () => void }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

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
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onCancel}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className={modalCard}>
        <h2 className="text-lg font-semibold text-fg">Changer mon mot de passe</h2>
        {done ? (
          <>
            <p className="mt-4 rounded-lg bg-success-soft px-3 py-2 text-sm text-success">Mot de passe mis à jour.</p>
            <div className="mt-6 flex justify-end">
              <button type="button" onClick={onCancel} className={primaryBtn}>Fermer</button>
            </div>
          </>
        ) : (
          <>
            <div className="mt-4">
              <label className="block text-sm font-medium text-fg">Nouveau mot de passe</label>
              <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <ul className="mt-3 space-y-1 text-xs">
              {PASSWORD_RULES.map((r) => (
                <li key={r.label} className={r.test(password) ? 'text-success' : 'text-muted'}>
                  {r.test(password) ? '✓' : '•'} {r.label}
                </li>
              ))}
            </ul>
            {error && <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
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
  const [editing, setEditing] = useState<Barber | null>(null)
  const [creating, setCreating] = useState(false)
  const [credentials, setCredentials] = useState<string | null>(null)
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

  async function resetPassword(b: Barber) {
    if (!window.confirm(`Réinitialiser le mot de passe de « ${b.name} » à « ${TEMP_PASSWORD} » ?`)) return
    try {
      await setBarberPassword(b.id, TEMP_PASSWORD)
      setCredentials(b.email ?? b.name)
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
          <h1 className="text-2xl font-semibold text-fg">Barbiers</h1>
          <p className="mt-1 text-sm text-muted">
            {barbers.length} barbier{barbers.length > 1 ? 's' : ''} · comptes et rôles.
          </p>
        </div>
        {isAdmin && (
          <button onClick={() => setCreating(true)} className={primaryBtn}>
            + Ajouter
          </button>
        )}
      </div>

      {error && <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

      {/* Mon compte */}
      <div className="mt-6 ui-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-fg">Mon compte</h2>
            <p className="text-sm text-muted">
              {session?.user.email} · {myRole === 'admin' ? 'Administrateur' : myRole === 'barber' ? 'Barbier' : '—'}
            </p>
          </div>
          <button onClick={() => setMyPwdOpen(true)} className={ghostBtn}>
            Changer mon mot de passe
          </button>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-bg-subtle text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Barbier</th>
              <th className="px-4 py-3 font-medium">Compte</th>
              <th className="px-4 py-3 font-medium">Rôle</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">Chargement…</td></tr>
            ) : (
              barbers.map((b) => (
                <tr key={b.id} className={b.is_active ? '' : 'opacity-50'}>
                  <td className="px-4 py-3 font-medium text-fg">{b.name}</td>
                  <td className="px-4 py-3 text-muted">{b.email ?? '—'}</td>
                  <td className="px-4 py-3">
                    {b.user_id ? (
                      <select
                        value={b.role}
                        onChange={(e) => changeRole(b, e.target.value as BarberRole)}
                        className="ui-input px-2 py-1"
                      >
                        <option value="barber">Barbier</option>
                        <option value="admin">Administrateur</option>
                      </select>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleActive(b)}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${b.is_active ? 'bg-success-soft text-success' : 'bg-bg-subtle text-muted'}`}
                    >
                      {b.is_active ? 'Actif' : 'Désactivé'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    {b.user_id && (
                      <button onClick={() => resetPassword(b)} className="text-accent hover:underline">Réinitialiser MdP</button>
                    )}
                    <button onClick={() => setEditing(b)} className="ml-3 text-muted hover:underline">Modifier</button>
                    <button onClick={() => onDelete(b)} className="ml-3 text-danger hover:underline">Suppr.</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {creating && (
        <NewBarberForm
          onCancel={() => setCreating(false)}
          onCreated={(email) => {
            setCreating(false)
            setCredentials(email)
            load()
          }}
        />
      )}
      {editing && (
        <BarberForm initial={editing} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />
      )}
      {credentials && <CredentialsDialog email={credentials} onClose={() => setCredentials(null)} />}
      {myPwdOpen && <PasswordForm onCancel={() => setMyPwdOpen(false)} />}
    </div>
  )
}
