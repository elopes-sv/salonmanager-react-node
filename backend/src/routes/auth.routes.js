import { randomUUID } from 'node:crypto'
import express from 'express'
import {
    accessTokenTtlSeconds,
    createAccessToken,
    hashPassword,
    parseAccessToken,
    verifyPassword,
} from '../auth.js'
import {
    cleanupExpiredAuthSessions,
    createAuthSessionRecord,
    getUserCredentialByEmail,
    getUserPublicById,
    revokeAuthSessionRecord,
    revokeAuthSessionsByUser,
    updateUserPasswordRecord,
    updateUserRecord,
} from '../store.js'
import {
    isEmail,
    getLoginKey,
    getLoginLockRemainingMs,
    formatRetryAfter,
    registerFailedLogin,
    clearFailedLogins,
    getTokenFromRequest,
    setAuthCookie,
    clearAuthCookie,
    unauthorized,
    requireAuth,
} from '../middleware/auth.middleware.js'

const router = express.Router()

router.post('/login', async (req, res) => {
    try {
        await cleanupExpiredAuthSessions()

        const payload = req.body ?? {}
        const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
        const password = typeof payload.password === 'string' ? payload.password : ''
        const rememberMe = payload.rememberMe !== false
        const loginKey = getLoginKey(req, email)

        const lockRemainingMs = getLoginLockRemainingMs(loginKey)
        if (lockRemainingMs > 0) {
            const retryAfterSeconds = Math.ceil(lockRemainingMs / 1000)
            res.setHeader('Retry-After', String(retryAfterSeconds))
            res.status(429).json({
                code: 'TOO_MANY_ATTEMPTS',
                message: `Muitas tentativas de login. Tente novamente em ${formatRetryAfter(lockRemainingMs)}.`,
                retryAfterSeconds,
            })
            return
        }

        if (!isEmail(email)) {
            res.status(400).json({
                code: 'VALIDATION_ERROR',
                message: 'Informe um e-mail válido.',
            })
            return
        }

        if (!password) {
            res.status(400).json({
                code: 'VALIDATION_ERROR',
                message: 'Senha é obrigatória.',
            })
            return
        }

        const credential = await getUserCredentialByEmail(email)
        if (!credential || !verifyPassword(password, credential.passwordHash)) {
            registerFailedLogin(loginKey)
            res.status(401).json({
                code: 'INVALID_CREDENTIALS',
                message: 'E-mail ou senha inválidos.',
            })
            return
        }

        if (!credential.isActive) {
            registerFailedLogin(loginKey)
            res.status(403).json({
                code: 'ACCOUNT_INACTIVE',
                message: 'Conta inativa. Entre em contato com o administrador.',
            })
            return
        }

        const user = await getUserPublicById(credential.id)
        if (!user) {
            registerFailedLogin(loginKey)
            res.status(401).json({
                code: 'INVALID_CREDENTIALS',
                message: 'E-mail ou senha inválidos.',
            })
            return
        }

        clearFailedLogins(loginKey)
        const sessionId = randomUUID()
        const token = createAccessToken(user.id, sessionId)
        const expiresAt = new Date(Date.now() + accessTokenTtlSeconds * 1000).toISOString()
        await createAuthSessionRecord({
            id: sessionId,
            userId: user.id,
            expiresAt,
        })
        setAuthCookie(res, token, { persistent: rememberMe })

        res.json({
            user,
        })
    } catch (error) {
        res.status(500).json({
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Erro interno ao autenticar.',
        })
    }
})

router.get('/me', requireAuth, async (req, res) => {
    res.json(req.authUser)
})

router.put('/me', requireAuth, async (req, res) => {
    try {
        const payload = req.body ?? {}
        const name = typeof payload.name === 'string' ? payload.name.trim() : ''
        const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''

        if (!name) {
            res.status(400).json({
                code: 'VALIDATION_ERROR',
                message: 'Nome é obrigatório.',
            })
            return
        }

        if (name.length > 120) {
            res.status(400).json({
                code: 'VALIDATION_ERROR',
                message: 'Nome deve ter no máximo 120 caracteres.',
            })
            return
        }

        if (!isEmail(email) || email.length > 254) {
            res.status(400).json({
                code: 'VALIDATION_ERROR',
                message: 'Informe um e-mail válido.',
            })
            return
        }

        const updated = await updateUserRecord(req.authUser.id, {
            name,
            email,
            role: req.authUser.role,
            passwordHash: '',
        })

        res.json(updated)
    } catch (error) {
        if (error instanceof Error && error.message === 'NOT_FOUND') {
            unauthorized(res)
            return
        }

        if (error instanceof Error && error.message.startsWith('VALIDATION:')) {
            res.status(400).json({
                code: 'VALIDATION_ERROR',
                message: error.message.replace('VALIDATION:', '').trim(),
            })
            return
        }

        if (error instanceof Error && error.message.startsWith('CONFLICT:')) {
            res.status(409).json({
                code: 'EMAIL_CONFLICT',
                message: error.message.replace('CONFLICT:', '').trim(),
            })
            return
        }

        res.status(500).json({
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Erro interno ao atualizar perfil.',
        })
    }
})

router.post('/logout', async (req, res) => {
    try {
        const token = getTokenFromRequest(req)
        if (token) {
            try {
                const payload = parseAccessToken(token)
                await revokeAuthSessionRecord(payload.sessionId)
            } catch (_error) {
                // token inválido/expirado: limpa cookie mesmo assim
            }
        }

        clearAuthCookie(res)
        res.status(204).send()
    } catch (error) {
        res.status(500).json({
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Erro interno ao sair da sessão.',
        })
    }
})

router.post('/change-password', requireAuth, async (req, res) => {
    try {
        const payload = req.body ?? {}
        const currentPassword = typeof payload.currentPassword === 'string' ? payload.currentPassword : ''
        const newPassword = typeof payload.newPassword === 'string' ? payload.newPassword : ''

        if (!currentPassword) {
            res.status(400).json({
                code: 'VALIDATION_ERROR',
                message: 'Senha atual é obrigatória.',
            })
            return
        }

        if (newPassword.length < 8 || newPassword.length > 1024) {
            res.status(400).json({
                code: 'VALIDATION_ERROR',
                message: 'A nova senha deve ter entre 8 e 1024 caracteres.',
            })
            return
        }

        if (newPassword === currentPassword) {
            res.status(400).json({
                code: 'VALIDATION_ERROR',
                message: 'A nova senha precisa ser diferente da senha atual.',
            })
            return
        }

        const credential = await getUserCredentialByEmail(req.authUser.email)
        if (!credential || !verifyPassword(currentPassword, credential.passwordHash)) {
            res.status(401).json({
                code: 'INVALID_CREDENTIALS',
                message: 'Senha atual inválida.',
            })
            return
        }

        await updateUserPasswordRecord(req.authUser.id, hashPassword(newPassword), {
            mustChangePassword: false,
        })
        await revokeAuthSessionsByUser(req.authUser.id)

        const refreshedUser = await getUserPublicById(req.authUser.id)
        if (!refreshedUser) {
            unauthorized(res)
            return
        }

        const sessionId = randomUUID()
        const token = createAccessToken(refreshedUser.id, sessionId)
        const expiresAt = new Date(Date.now() + accessTokenTtlSeconds * 1000).toISOString()

        await createAuthSessionRecord({
            id: sessionId,
            userId: refreshedUser.id,
            expiresAt,
        })
        setAuthCookie(res, token)

        res.json({
            user: refreshedUser,
        })
    } catch (error) {
        if (error instanceof Error && error.message.startsWith('VALIDATION:')) {
            res.status(400).json({
                code: 'VALIDATION_ERROR',
                message: error.message.replace('VALIDATION:', '').trim(),
            })
            return
        }

        if (error instanceof Error && error.message === 'NOT_FOUND') {
            unauthorized(res)
            return
        }

        res.status(500).json({
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Erro interno ao alterar senha.',
        })
    }
})

export default router
