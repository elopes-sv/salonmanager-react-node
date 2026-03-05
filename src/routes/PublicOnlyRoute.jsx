import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function PublicOnlyRoute({ children }) {
    const { isAuthenticated, mustChangePassword } = useAuth()

    if (isAuthenticated) {
        return <Navigate to={mustChangePassword ? '/change-password' : '/appointments'} replace />
    }

    return children
}
