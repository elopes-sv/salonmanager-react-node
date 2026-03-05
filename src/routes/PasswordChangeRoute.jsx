import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function PasswordChangeRoute({ children }) {
    const { isAuthenticated, mustChangePassword } = useAuth()

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />
    }

    if (!mustChangePassword) {
        return <Navigate to="/appointments" replace />
    }

    return children
}
