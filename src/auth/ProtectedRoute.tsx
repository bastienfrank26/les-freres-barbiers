import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'

export function ProtectedRoute() {
  const { session, loading } = useAuth()

  if (loading) {
    return <div className="grid min-h-screen place-items-center text-muted">Chargement…</div>
  }
  if (!session) {
    return <Navigate to="/admin/login" replace />
  }
  return <Outlet />
}
