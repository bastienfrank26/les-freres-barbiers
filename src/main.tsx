import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { applyTheme, getTheme } from './lib/theme'
import { AuthProvider } from './auth/AuthProvider'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { Login } from './admin/Login'
import { AdminLayout } from './admin/AdminLayout'
import { Agenda } from './admin/pages/Agenda'
import { Clients } from './admin/pages/Clients'
import { Services } from './admin/pages/Services'
import { Barbiers } from './admin/pages/Barbiers'
import { Parametres } from './admin/pages/Parametres'

applyTheme(getTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Landing publique */}
          <Route path="/" element={<App />} />

          {/* Console d'administration */}
          <Route path="/admin/login" element={<Login />} />
          <Route path="/admin" element={<ProtectedRoute />}>
            <Route element={<AdminLayout />}>
              <Route index element={<Navigate to="/admin/agenda" replace />} />
              <Route path="agenda" element={<Agenda />} />
              <Route path="clients" element={<Clients />} />
              <Route path="services" element={<Services />} />
              <Route path="barbiers" element={<Barbiers />} />
              <Route path="parametres" element={<Parametres />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
