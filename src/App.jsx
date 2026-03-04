import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage/LoginPage'
import { DashboardPage } from './pages/DashboardPage/DashboardPage'
import { ServiceManagementPage } from './pages/ServiceManagementPage/ServiceManagementPage'
import { UserSettingsPage } from './pages/UserSettingsPage/UserSettingsPage'
import {
  clearAuthSessionHint,
  getCurrentUser,
  hasAdminRole,
  hasAuthSessionHint,
  hasPasswordChangePending,
} from './api/auth'
import { UserManagementPage } from './pages/UserManagementPage/UserManagementPage'
import { RequiredPasswordChangePage } from './pages/RequiredPasswordChangePage/RequiredPasswordChangePage'

function getAuthenticatedHomePath() {
  return hasPasswordChangePending() ? '/change-password' : '/appointments'
}

function ProtectedRoute({ children }) {
  if (!hasAuthSessionHint()) {
    return <Navigate to="/login" replace />
  }

  if (hasPasswordChangePending()) {
    return <Navigate to="/change-password" replace />
  }

  return children
}

function PublicOnlyRoute({ children }) {
  if (hasAuthSessionHint()) {
    return <Navigate to={getAuthenticatedHomePath()} replace />
  }

  return children
}

function PasswordChangeRoute({ children }) {
  if (!hasAuthSessionHint()) {
    return <Navigate to="/login" replace />
  }

  if (!hasPasswordChangePending()) {
    return <Navigate to="/appointments" replace />
  }

  return children
}

function AdminRoute({ children }) {
  if (!hasAuthSessionHint()) {
    return <Navigate to="/login" replace />
  }

  if (hasPasswordChangePending()) {
    return <Navigate to="/change-password" replace />
  }

  if (!hasAdminRole()) {
    return <Navigate to="/appointments" replace />
  }

  return children
}

export default function App() {
  const [isSessionReady, setIsSessionReady] = useState(() => !hasAuthSessionHint())

  useEffect(() => {
    async function hydrateUser() {
      if (!hasAuthSessionHint()) {
        setIsSessionReady(true)
        return
      }

      try {
        await getCurrentUser()
      } catch (_error) {
        clearAuthSessionHint()
      } finally {
        setIsSessionReady(true)
      }
    }

    void hydrateUser()
  }, [])

  if (!isSessionReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-light font-display text-slate-500">
        Carregando sessão...
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route path="/dashboard" element={<Navigate to="/appointments" replace />} />
      <Route
        path="/change-password"
        element={
          <PasswordChangeRoute>
            <RequiredPasswordChangePage />
          </PasswordChangeRoute>
        }
      />
      <Route
        path="/appointments"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route path="/dashboard/add-appointment" element={<Navigate to="/appointments" replace />} />
      <Route
        path="/services"
        element={
          <ProtectedRoute>
            <ServiceManagementPage />
          </ProtectedRoute>
        }
      />
      <Route path="/services/new" element={<Navigate to="/services" replace />} />
      <Route
        path="/settings/user"
        element={
          <ProtectedRoute>
            <UserSettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <AdminRoute>
            <UserManagementPage />
          </AdminRoute>
        }
      />
      <Route path="*" element={<Navigate to={hasAuthSessionHint() ? getAuthenticatedHomePath() : '/login'} replace />} />
    </Routes>
  )
}
