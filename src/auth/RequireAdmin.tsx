import { Navigate, Outlet } from 'react-router-dom'
import { useAdminContext } from '../lib/adminContext'

/**
 * Restreint l'accès aux modules réservés aux administrateurs (Barbiers, Services).
 * Doit être imbriqué sous <AdminLayout> pour hériter du contexte ; le contexte est
 * réinjecté dans l'Outlet enfant afin que les pages continuent d'y accéder.
 */
export function RequireAdmin() {
  const ctx = useAdminContext()
  if (ctx.myRole === null) return null // rôle en cours de chargement
  if (!ctx.isAdmin) return <Navigate to="/admin/agenda" replace />
  return <Outlet context={ctx} />
}
