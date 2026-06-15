import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export function Login() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('info@les-freres-barbiers.com')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!loading && session) {
    return <Navigate to="/admin" replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) {
      setError(error.message)
      return
    }
    navigate('/admin', { replace: true })
  }

  return (
    <div className="grid min-h-screen place-items-center bg-bg px-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm ui-card p-8 shadow-lg">
        <h1 className="text-xl font-semibold text-fg">Les Frères Barbiers</h1>
        <p className="mt-1 text-sm text-muted">Console d’administration</p>

        <label className="mt-6 block text-sm font-medium text-fg">Courriel</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
          className="mt-1 w-full ui-input"
        />

        <label className="mt-4 block text-sm font-medium text-fg">Mot de passe</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="mt-1 w-full ui-input"
        />

        {error && <p className="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full ui-btn-primary"
        >
          {busy ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </div>
  )
}
