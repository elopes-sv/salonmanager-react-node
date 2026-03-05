import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import {
    clearAuthSessionHint,
    getCachedCurrentUser,
    getCurrentUser,
    hasAuthSessionHint,
    loginUser,
    logoutUser,
} from '../api/auth'

export const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => getCachedCurrentUser())
    const [isSessionReady, setIsSessionReady] = useState(() => !hasAuthSessionHint())

    useEffect(() => {
        if (!hasAuthSessionHint()) {
            setIsSessionReady(true)
            return
        }

        async function hydrateUser() {
            try {
                const currentUser = await getCurrentUser()
                setUser(currentUser)
            } catch (_error) {
                clearAuthSessionHint()
                setUser(null)
            } finally {
                setIsSessionReady(true)
            }
        }

        void hydrateUser()
    }, [])

    const login = useCallback(async (input) => {
        const loggedUser = await loginUser(input)
        setUser(loggedUser)
        return loggedUser
    }, [])

    const logout = useCallback(async () => {
        await logoutUser()
        setUser(null)
    }, [])

    const refreshUser = useCallback(async () => {
        try {
            const currentUser = await getCurrentUser()
            setUser(currentUser)
            return currentUser
        } catch (_error) {
            return null
        }
    }, [])

    const updateUser = useCallback((updatedUser) => {
        setUser(updatedUser)
    }, [])

    const value = useMemo(
        () => ({
            user,
            isSessionReady,
            isAuthenticated: Boolean(user),
            isAdmin: user?.role === 'admin',
            mustChangePassword: Boolean(user?.mustChangePassword),
            login,
            logout,
            refreshUser,
            updateUser,
        }),
        [user, isSessionReady, login, logout, refreshUser, updateUser],
    )

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
