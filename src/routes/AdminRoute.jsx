import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function AdminRoute({ children }) {
    const { isAuthenticated, mustChangePassword, isAdmin } = useAuth()

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />
    }

    if (mustChangePassword) {
        return <Navigate to="/change-password" replace />
    }

    if (!isAdmin) {
        return <Navigate to="/appointments" replace />
    }

    return children
}
