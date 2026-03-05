import { accessTokenTtlSeconds, parseAccessToken } from '../auth.js'
import { findActiveAuthSessionRecord, getUserPublicById } from '../store.js'

const maxLoginAttempts = Number.parseInt(process.env.AUTH_MAX_LOGIN_ATTEMPTS || '5', 10)
const loginWindowMs = Number.parseInt(process.env.AUTH_LOGIN_WINDOW_MS || `${15 * 60 * 1000}`, 10)
const lockoutMs = Number.parseInt(process.env.AUTH_LOGIN_LOCKOUT_MS || `${15 * 60 * 1000}`, 10)
const maxTrackedLoginKeysRaw = Number.parseInt(process.env.AUTH_MAX_TRACKED_LOGIN_KEYS || '5000', 10)
const maxTrackedLoginKeys =
    Number.isFinite(maxTrackedLoginKeysRaw) && maxTrackedLoginKeysRaw > 0 ? maxTrackedLoginKeysRaw : 5000
const authCookieName = process.env.AUTH_COOKIE_NAME || 'salonmanager_access'
const authCookieSecure = process.env.AUTH_COOKIE_SECURE === 'true'
const authCookieSameSiteRaw = (process.env.AUTH_COOKIE_SAMESITE || 'lax').toLowerCase()
const authCookieSameSite = ['lax', 'strict', 'none'].includes(authCookieSameSiteRaw) ? authCookieSameSiteRaw : 'lax'
const effectiveAuthCookieSecure = authCookieSameSite === 'none' ? true : authCookieSecure
const authCookieDomain = process.env.AUTH_COOKIE_DOMAIN ? process.env.AUTH_COOKIE_DOMAIN.trim() : ''
const loginAttemptMap = new Map()

// --- Email validation ---

export function isEmail(value) {
    return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

// --- Rate limiting ---

function getClientIp(req) {
    return req.ip || req.socket?.remoteAddress || 'unknown-ip'
}

export function getLoginKey(req, email) {
    return `${getClientIp(req)}::${email || 'unknown-email'}`
}

function pruneLoginAttempts() {
    const now = Date.now()

    for (const [key, state] of loginAttemptMap) {
        if (state.lockedUntil > now) {
            continue
        }

        if (now - state.firstAttemptAt > loginWindowMs) {
            loginAttemptMap.delete(key)
        }
    }
}

function getLoginState(key) {
    const now = Date.now()
    const current = loginAttemptMap.get(key)

    if (!current) {
        return null
    }

    if (current.lockedUntil > now) {
        return current
    }

    if (now - current.firstAttemptAt > loginWindowMs) {
        loginAttemptMap.delete(key)
        return null
    }

    return current
}

export function registerFailedLogin(key) {
    pruneLoginAttempts()
    const now = Date.now()
    const current = getLoginState(key)

    if (!current) {
        if (loginAttemptMap.size >= maxTrackedLoginKeys) {
            const oldestKey = loginAttemptMap.keys().next().value
            if (oldestKey !== undefined) {
                loginAttemptMap.delete(oldestKey)
            }
        }

        loginAttemptMap.set(key, {
            count: 1,
            firstAttemptAt: now,
            lockedUntil: 0,
        })
        return
    }

    const nextCount = current.count + 1
    const lockedUntil = nextCount >= maxLoginAttempts ? now + lockoutMs : current.lockedUntil

    loginAttemptMap.set(key, {
        count: nextCount,
        firstAttemptAt: current.firstAttemptAt,
        lockedUntil,
    })
}

export function clearFailedLogins(key) {
    loginAttemptMap.delete(key)
}

export function getLoginLockRemainingMs(key) {
    pruneLoginAttempts()
    const current = getLoginState(key)
    if (!current) {
        return 0
    }

    return Math.max(0, current.lockedUntil - Date.now())
}

export function formatRetryAfter(remainingMs) {
    const totalSeconds = Math.max(1, Math.ceil(remainingMs / 1000))
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60

    if (minutes <= 0) {
        return `${seconds} segundo${seconds === 1 ? '' : 's'}`
    }

    if (seconds === 0) {
        return `${minutes} minuto${minutes === 1 ? '' : 's'}`
    }

    return `${minutes} minuto${minutes === 1 ? '' : 's'} e ${seconds} segundo${seconds === 1 ? '' : 's'}`
}

// --- Cookie handling ---

function parseCookies(req) {
    const cookieHeader = req.header('cookie')
    if (!cookieHeader) {
        return {}
    }

    return cookieHeader
        .split(';')
        .map((item) => item.trim())
        .filter(Boolean)
        .reduce((acc, pair) => {
            const separatorIndex = pair.indexOf('=')
            if (separatorIndex <= 0) {
                return acc
            }

            const key = pair.slice(0, separatorIndex).trim()
            const value = pair.slice(separatorIndex + 1).trim()
            try {
                acc[key] = decodeURIComponent(value)
            } catch (_error) {
                acc[key] = value
            }
            return acc
        }, {})
}

export function getTokenFromRequest(req) {
    const authorizationHeader = req.header('authorization') || ''
    if (authorizationHeader.startsWith('Bearer ')) {
        const headerToken = authorizationHeader.slice('Bearer '.length).trim()
        if (headerToken) {
            return headerToken
        }
    }

    const cookies = parseCookies(req)
    return typeof cookies[authCookieName] === 'string' ? cookies[authCookieName] : ''
}

function getAuthCookieOptions({ persistent = true } = {}) {
    const options = {
        httpOnly: true,
        secure: effectiveAuthCookieSecure,
        sameSite: authCookieSameSite,
        path: '/',
    }

    if (persistent) {
        options.maxAge = accessTokenTtlSeconds * 1000
    }

    if (authCookieDomain) {
        options.domain = authCookieDomain
    }

    return options
}

export function setAuthCookie(res, token, options = {}) {
    res.cookie(authCookieName, token, getAuthCookieOptions(options))
}

export function clearAuthCookie(res) {
    res.clearCookie(authCookieName, {
        httpOnly: true,
        secure: effectiveAuthCookieSecure,
        sameSite: authCookieSameSite,
        path: '/',
        ...(authCookieDomain ? { domain: authCookieDomain } : {}),
    })
}

// --- Auth response helpers ---

export function unauthorized(res, message = 'Não autenticado.') {
    res.status(401).json({
        code: 'UNAUTHORIZED',
        message,
    })
}

export function forbidden(res, message = 'Acesso negado.') {
    res.status(403).json({
        code: 'FORBIDDEN',
        message,
    })
}

// --- Auth middleware ---

export async function requireAuth(req, res, next) {
    const token = getTokenFromRequest(req)
    if (!token) {
        unauthorized(res)
        return
    }

    let payload
    try {
        payload = parseAccessToken(token)
    } catch (error) {
        if (error instanceof Error && error.message === 'TOKEN_EXPIRED') {
            unauthorized(res, 'Sessão expirada. Faça login novamente.')
            return
        }

        unauthorized(res)
        return
    }

    try {
        const session = await findActiveAuthSessionRecord(payload.sessionId, payload.userId)
        if (!session) {
            unauthorized(res)
            return
        }

        const user = await getUserPublicById(payload.userId)
        if (!user) {
            unauthorized(res)
            return
        }

        if (!user.isActive) {
            unauthorized(res, 'Conta inativa. Entre em contato com o administrador.')
            return
        }

        req.authUser = user
        req.authSessionId = payload.sessionId
        next()
    } catch (error) {
        res.status(500).json({
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Erro interno ao autenticar requisição.',
        })
    }
}

export function requireAdmin(req, res, next) {
    if (!req.authUser || req.authUser.role !== 'admin') {
        forbidden(res, 'Apenas administradores podem acessar este recurso.')
        return
    }

    next()
}

export function requirePasswordChangeResolved(req, res, next) {
    if (req.authUser?.mustChangePassword) {
        res.status(403).json({
            code: 'PASSWORD_CHANGE_REQUIRED',
            message: 'Troque a senha para continuar.',
        })
        return
    }

    next()
}
