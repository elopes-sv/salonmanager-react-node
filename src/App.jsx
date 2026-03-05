import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './hooks/useAuth'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { AdminRoute } from './routes/AdminRoute'
import { PublicOnlyRoute } from './routes/PublicOnlyRoute'
import { PasswordChangeRoute } from './routes/PasswordChangeRoute'
import { LoginPage } from './pages/LoginPage/LoginPage'
import { DashboardPage } from './pages/DashboardPage/DashboardPage'
import { ServiceManagementPage } from './pages/ServiceManagementPage/ServiceManagementPage'
import { UserSettingsPage } from './pages/UserSettingsPage/UserSettingsPage'
import { UserManagementPage } from './pages/UserManagementPage/UserManagementPage'
import { RequiredPasswordChangePage } from './pages/RequiredPasswordChangePage/RequiredPasswordChangePage'

function AppRoutes() {
  const { isSessionReady, isAuthenticated, mustChangePassword } = useAuth()

  if (!isSessionReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background-light font-display text-slate-500">
        Carregando sessão...
      </div>
    )
  }

  const fallbackPath = isAuthenticated
    ? mustChangePassword ? '/change-password' : '/appointments'
    : '/login'

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
      <Route path="*" element={<Navigate to={fallbackPath} replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
