import cors from 'cors'
import express from 'express'
import { randomUUID } from 'node:crypto'
import {
  accessTokenTtlSeconds,
  authRuntimeFlags,
  createAccessToken,
  hashPassword,
  parseAccessToken,
  verifyPassword,
} from './auth.js'
import {
  cleanupExpiredAuthSessions,
  countActiveAdminUsers,
  createAppointmentRecord,
  createAuthSessionRecord,
  createServiceRecord,
  createUserRecord,
  deleteAppointmentRecord,
  deleteServiceRecord,
  findActiveAuthSessionRecord,
  getUserCredentialByEmail,
  getUserPublicById,
  initializeStore,
  listAppointmentRecords,
  listUserRecords,
  updateUserRecord,
  updateUserPasswordRecord,
  updateUserStatusRecord,
  revokeAuthSessionsByUser,
  revokeAuthSessionRecord,
  listServiceRecords,
  updateAppointmentRecord,
  updateServiceRecord,
} from './store.js'

const app = express()
const port = Number(process.env.PORT || 4000)
const host = (process.env.HOST || '127.0.0.1').trim() || '127.0.0.1'
const corsOrigin = process.env.CORS_ORIGIN
const maxLoginAttempts = Number.parseInt(process.env.AUTH_MAX_LOGIN_ATTEMPTS || '5', 10)
const loginWindowMs = Number.parseInt(process.env.AUTH_LOGIN_WINDOW_MS || `${15 * 60 * 1000}`, 10)
const lockoutMs = Number.parseInt(process.env.AUTH_LOGIN_LOCKOUT_MS || `${15 * 60 * 1000}`, 10)
const authCookieName = process.env.AUTH_COOKIE_NAME || 'salonmanager_access'
const authCookieSecure = process.env.AUTH_COOKIE_SECURE === 'true'
const authCookieSameSiteRaw = (process.env.AUTH_COOKIE_SAMESITE || 'lax').toLowerCase()
const authCookieSameSite = ['lax', 'strict', 'none'].includes(authCookieSameSiteRaw) ? authCookieSameSiteRaw : 'lax'
const effectiveAuthCookieSecure = authCookieSameSite === 'none' ? true : authCookieSecure
const authCookieDomain = process.env.AUTH_COOKIE_DOMAIN ? process.env.AUTH_COOKIE_DOMAIN.trim() : ''
const loginAttemptMap = new Map()
const allowedOrigins = corsOrigin
  ? corsOrigin
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  : ['http://localhost:5173', 'http://127.0.0.1:5173']

app.disable('x-powered-by')

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true)
        return
      }

      callback(null, allowedOrigins.includes(origin))
    },
    credentials: true,
  }),
)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Cache-Control', 'no-store')
  next()
})
app.use(express.json({ limit: '16kb' }))

function isEmail(value) {
  return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function getClientIp(req) {
  const xForwardedFor = req.header('x-forwarded-for')
  if (typeof xForwardedFor === 'string' && xForwardedFor.trim()) {
    return xForwardedFor.split(',')[0].trim()
  }

  return req.ip || 'unknown-ip'
}

function getLoginKey(req, email) {
  return `${getClientIp(req)}::${email || 'unknown-email'}`
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

function registerFailedLogin(key) {
  const now = Date.now()
  const current = getLoginState(key)

  if (!current) {
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

function clearFailedLogins(key) {
  loginAttemptMap.delete(key)
}

function hasLoginLock(key) {
  const current = getLoginState(key)
  if (!current) {
    return false
  }

  return current.lockedUntil > Date.now()
}

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

function getTokenFromRequest(req) {
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

function getAuthCookieOptions() {
  const options = {
    httpOnly: true,
    secure: effectiveAuthCookieSecure,
    sameSite: authCookieSameSite,
    path: '/',
    maxAge: accessTokenTtlSeconds * 1000,
  }

  if (authCookieDomain) {
    options.domain = authCookieDomain
  }

  return options
}

function setAuthCookie(res, token) {
  res.cookie(authCookieName, token, getAuthCookieOptions())
}

function clearAuthCookie(res) {
  res.clearCookie(authCookieName, {
    httpOnly: true,
    secure: effectiveAuthCookieSecure,
    sameSite: authCookieSameSite,
    path: '/',
    ...(authCookieDomain ? { domain: authCookieDomain } : {}),
  })
}

function unauthorized(res, message = 'Não autenticado.') {
  res.status(401).json({
    code: 'UNAUTHORIZED',
    message,
  })
}

function forbidden(res, message = 'Acesso negado.') {
  res.status(403).json({
    code: 'FORBIDDEN',
    message,
  })
}

async function requireAuth(req, res, next) {
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

function requireAdmin(req, res, next) {
  if (!req.authUser || req.authUser.role !== 'admin') {
    forbidden(res, 'Apenas administradores podem acessar este recurso.')
    return
  }

  next()
}

function requirePasswordChangeResolved(req, res, next) {
  if (req.authUser?.mustChangePassword) {
    res.status(403).json({
      code: 'PASSWORD_CHANGE_REQUIRED',
      message: 'Troque a senha para continuar.',
    })
    return
  }

  next()
}

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'salonmanager-api',
    now: new Date().toISOString(),
  })
})

app.get('/', (_req, res) => {
  res.json({
    service: 'salonmanager-api',
    status: 'ok',
    message: 'API online.',
    endpoints: {
      health: '/health',
      authLogin: '/auth/login',
    },
    now: new Date().toISOString(),
  })
})

app.post('/auth/login', async (req, res) => {
  try {
    await cleanupExpiredAuthSessions()

    const payload = req.body ?? {}
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
    const password = typeof payload.password === 'string' ? payload.password : ''
    const loginKey = getLoginKey(req, email)

    if (hasLoginLock(loginKey)) {
      res.status(429).json({
        code: 'TOO_MANY_ATTEMPTS',
        message: 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.',
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
    setAuthCookie(res, token)

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

app.get('/auth/me', requireAuth, async (req, res) => {
  res.json(req.authUser)
})

app.post('/auth/logout', async (req, res) => {
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

app.post('/auth/change-password', requireAuth, async (req, res) => {
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

app.use(['/appointments', '/services', '/users'], requireAuth, requirePasswordChangeResolved)

app.get('/users', requireAdmin, async (_req, res) => {
  try {
    const records = await listUserRecords()
    res.json(records)
  } catch (error) {
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Erro interno ao listar usuários.',
    })
  }
})

app.post('/users', requireAdmin, async (req, res) => {
  try {
    const payload = req.body ?? {}
    const name = typeof payload.name === 'string' ? payload.name.trim() : ''
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
    const password = typeof payload.password === 'string' ? payload.password : ''
    const role = typeof payload.role === 'string' ? payload.role.trim().toLowerCase() : 'staff'

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

    if (password.length < 8 || password.length > 1024) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'A senha deve ter entre 8 e 1024 caracteres.',
      })
      return
    }

    if (role !== 'admin' && role !== 'staff') {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Perfil de usuário inválido.',
      })
      return
    }

    const createdUser = await createUserRecord({
      name,
      email,
      passwordHash: hashPassword(password),
      role,
      mustChangePassword: true,
    })

    res.status(201).json(createdUser)
  } catch (error) {
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
      message: error instanceof Error ? error.message : 'Erro interno ao criar usuário.',
    })
  }
})

app.put('/users/:id', requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id
    const payload = req.body ?? {}
    const name = typeof payload.name === 'string' ? payload.name.trim() : ''
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
    const role = typeof payload.role === 'string' ? payload.role.trim().toLowerCase() : ''
    const password = typeof payload.password === 'string' ? payload.password : ''

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

    if (role !== 'admin' && role !== 'staff') {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Perfil de usuário inválido.',
      })
      return
    }

    if (password && (password.length < 8 || password.length > 1024)) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'A senha deve ter entre 8 e 1024 caracteres.',
      })
      return
    }

    const currentTarget = await getUserPublicById(userId)
    if (!currentTarget) {
      res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Usuário não encontrado.',
      })
      return
    }

    if (currentTarget.role === 'admin' && currentTarget.isActive && role !== 'admin') {
      const activeAdmins = await countActiveAdminUsers()
      if (activeAdmins <= 1) {
        res.status(409).json({
          code: 'LAST_ADMIN_REQUIRED',
          message: 'Deve existir ao menos um administrador ativo.',
        })
        return
      }
    }

    const updated = await updateUserRecord(userId, {
      name,
      email,
      role,
      passwordHash: password ? hashPassword(password) : '',
    })

    res.json(updated)
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Usuário não encontrado.',
      })
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
      message: error instanceof Error ? error.message : 'Erro interno ao atualizar usuário.',
    })
  }
})

app.patch('/users/:id/status', requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id
    const isActive = req.body?.isActive

    if (typeof isActive !== 'boolean') {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Status de usuário inválido.',
      })
      return
    }

    const currentTarget = await getUserPublicById(userId)
    if (!currentTarget) {
      res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Usuário não encontrado.',
      })
      return
    }

    if (req.authUser.id === userId && !isActive) {
      res.status(409).json({
        code: 'SELF_DEACTIVATION_NOT_ALLOWED',
        message: 'Não é possível inativar o próprio usuário logado.',
      })
      return
    }

    if (currentTarget.role === 'admin' && currentTarget.isActive && !isActive) {
      const activeAdmins = await countActiveAdminUsers()
      if (activeAdmins <= 1) {
        res.status(409).json({
          code: 'LAST_ADMIN_REQUIRED',
          message: 'Deve existir ao menos um administrador ativo.',
        })
        return
      }
    }

    const updated = await updateUserStatusRecord(userId, isActive)
    if (!isActive) {
      await revokeAuthSessionsByUser(userId)
    }
    res.json(updated)
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Usuário não encontrado.',
      })
      return
    }

    if (error instanceof Error && error.message.startsWith('VALIDATION:')) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: error.message.replace('VALIDATION:', '').trim(),
      })
      return
    }

    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Erro interno ao atualizar status do usuário.',
    })
  }
})

app.post('/users/:id/reset-password', requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id
    const providedPassword = typeof req.body?.password === 'string' ? req.body.password : ''
    const generatedPassword = randomUUID().replace(/-/g, '')
    const password = providedPassword || generatedPassword

    if (password.length < 8 || password.length > 1024) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'A senha deve ter entre 8 e 1024 caracteres.',
      })
      return
    }

    const updated = await updateUserPasswordRecord(userId, hashPassword(password), {
      mustChangePassword: true,
    })
    await revokeAuthSessionsByUser(userId)

    res.json({
      user: updated,
      temporaryPassword: providedPassword ? '' : password,
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Usuário não encontrado.',
      })
      return
    }

    if (error instanceof Error && error.message.startsWith('VALIDATION:')) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: error.message.replace('VALIDATION:', '').trim(),
      })
      return
    }

    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Erro interno ao redefinir senha.',
    })
  }
})

app.get('/appointments', async (req, res) => {
  try {
    const records = await listAppointmentRecords(req.authUser.id)
    res.json(records)
  } catch (error) {
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Erro interno ao listar agendamentos.',
    })
  }
})

app.post('/appointments', async (req, res) => {
  try {
    const created = await createAppointmentRecord(req.authUser.id, req.body ?? {})
    res.status(201).json(created)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('VALIDATION:')) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: error.message.replace('VALIDATION:', '').trim(),
      })
      return
    }

    if (error instanceof Error && error.message.startsWith('CONFLICT:')) {
      res.status(409).json({
        code: 'TIME_CONFLICT',
        message: error.message.replace('CONFLICT:', '').trim(),
      })
      return
    }

    if (error instanceof Error && error.message === 'SERVICE_NOT_FOUND') {
      res.status(400).json({
        code: 'SERVICE_NOT_FOUND',
        message: 'Serviço informado não existe.',
      })
      return
    }

    if (error instanceof Error && error.message === 'SERVICE_INACTIVE') {
      res.status(409).json({
        code: 'SERVICE_INACTIVE',
        message: 'Não é possível criar agendamento com serviço inativo.',
      })
      return
    }

    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Erro interno ao criar agendamento.',
    })
  }
})

app.put('/appointments/:id', async (req, res) => {
  try {
    const updated = await updateAppointmentRecord(req.authUser.id, req.params.id, req.body ?? {})
    res.json(updated)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('VALIDATION:')) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: error.message.replace('VALIDATION:', '').trim(),
      })
      return
    }

    if (error instanceof Error && error.message === 'NOT_FOUND') {
      res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Agendamento não encontrado.',
      })
      return
    }

    if (error instanceof Error && error.message.startsWith('CONFLICT:')) {
      res.status(409).json({
        code: 'TIME_CONFLICT',
        message: error.message.replace('CONFLICT:', '').trim(),
      })
      return
    }

    if (error instanceof Error && error.message === 'SERVICE_NOT_FOUND') {
      res.status(400).json({
        code: 'SERVICE_NOT_FOUND',
        message: 'Serviço informado não existe.',
      })
      return
    }

    if (error instanceof Error && error.message === 'SERVICE_INACTIVE') {
      res.status(409).json({
        code: 'SERVICE_INACTIVE',
        message: 'Não é possível trocar para um serviço inativo.',
      })
      return
    }

    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Erro interno ao atualizar agendamento.',
    })
  }
})

app.delete('/appointments/:id', async (req, res) => {
  try {
    await deleteAppointmentRecord(req.authUser.id, req.params.id)
    res.status(204).send()
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Agendamento não encontrado.',
      })
      return
    }

    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Erro interno ao excluir agendamento.',
    })
  }
})

app.get('/services', async (req, res) => {
  try {
    const records = await listServiceRecords()
    res.json(records)
  } catch (error) {
    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Erro interno ao listar serviços.',
    })
  }
})

app.post('/services', requireAdmin, async (req, res) => {
  try {
    const created = await createServiceRecord(req.body ?? {})
    res.status(201).json(created)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('VALIDATION:')) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: error.message.replace('VALIDATION:', '').trim(),
      })
      return
    }

    if (error instanceof Error && error.message.startsWith('CONFLICT:')) {
      res.status(409).json({
        code: 'SERVICE_NAME_CONFLICT',
        message: error.message.replace('CONFLICT:', '').trim(),
      })
      return
    }

    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Erro interno ao criar serviço.',
    })
  }
})

app.put('/services/:id', requireAdmin, async (req, res) => {
  try {
    const updated = await updateServiceRecord(req.params.id, req.body ?? {})
    res.json(updated)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('VALIDATION:')) {
      res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: error.message.replace('VALIDATION:', '').trim(),
      })
      return
    }

    if (error instanceof Error && error.message === 'NOT_FOUND') {
      res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Serviço não encontrado.',
      })
      return
    }

    if (error instanceof Error && error.message.startsWith('CONFLICT:')) {
      res.status(409).json({
        code: 'SERVICE_NAME_CONFLICT',
        message: error.message.replace('CONFLICT:', '').trim(),
      })
      return
    }

    if (error instanceof Error && error.message === 'SERVICE_HAS_FUTURE_APPOINTMENTS') {
      res.status(409).json({
        code: 'SERVICE_HAS_FUTURE_APPOINTMENTS',
        message: 'Não é possível inativar um serviço com agendamentos futuros.',
      })
      return
    }

    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Erro interno ao atualizar serviço.',
    })
  }
})

app.delete('/services/:id', requireAdmin, async (req, res) => {
  try {
    await deleteServiceRecord(req.params.id)
    res.status(204).send()
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      res.status(404).json({
        code: 'NOT_FOUND',
        message: 'Serviço não encontrado.',
      })
      return
    }

    if (error instanceof Error && error.message === 'IN_USE') {
      res.status(409).json({
        code: 'SERVICE_IN_USE',
        message: 'Não é possível excluir um serviço que já possui agendamentos.',
      })
      return
    }

    res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: error instanceof Error ? error.message : 'Erro interno ao excluir serviço.',
    })
  }
})

initializeStore()
  .then(async () => {
    await cleanupExpiredAuthSessions()
    const activeAdmins = await countActiveAdminUsers()
    if (activeAdmins === 0) {
      console.warn('[api] nenhum administrador ativo encontrado. Execute `npm run admin:create`.')
    }

    if (authRuntimeFlags.usesEphemeralTokenSecret) {
      console.warn('[api] AUTH_TOKEN_SECRET não definido. Usando segredo efêmero para esta execução.')
    }

    app.listen(port, host, () => {
      console.log(`[api] running at http://${host}:${port}`)
    })
  })
  .catch((error) => {
    console.error('[api] failed to initialize store:', error)
    process.exit(1)
  })
