import { apiClient, requestData } from './http'

const authSessionHintStorageKey = 'salonmanager.auth_session_hint'
const currentUserStorageKey = 'salonmanager.current_user'

function readSessionHint() {
  if (typeof window === 'undefined') {
    return ''
  }

  return window.localStorage.getItem(authSessionHintStorageKey) || ''
}

function writeSessionHint(value) {
  if (typeof window === 'undefined') {
    return
  }

  if (value) {
    window.localStorage.setItem(authSessionHintStorageKey, value)
  } else {
    window.localStorage.removeItem(authSessionHintStorageKey)
  }
}

function setAuthenticatedHint() {
  writeSessionHint('1')
}

function readCurrentUserRaw() {
  if (typeof window === 'undefined') {
    return ''
  }

  return window.localStorage.getItem(currentUserStorageKey) || ''
}

function writeCurrentUserRaw(value) {
  if (typeof window === 'undefined') {
    return
  }

  if (value) {
    window.localStorage.setItem(currentUserStorageKey, value)
  } else {
    window.localStorage.removeItem(currentUserStorageKey)
  }
}

export function hasAuthSessionHint() {
  return readSessionHint() === '1'
}

export function clearAuthSessionHint() {
  writeSessionHint('')
  writeCurrentUserRaw('')
}

function assertUser(user) {
  if (!user || typeof user !== 'object') {
    throw new Error('Contrato inválido para usuário.')
  }

  if (
    typeof user.id !== 'string' ||
    typeof user.name !== 'string' ||
    typeof user.email !== 'string' ||
    (user.role !== 'admin' && user.role !== 'staff') ||
    typeof user.isActive !== 'boolean' ||
    typeof user.mustChangePassword !== 'boolean'
  ) {
    throw new Error('Contrato inválido para usuário.')
  }
}

function assertAuthPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Contrato inválido para autenticação.')
  }

  assertUser(payload.user)
}

function setCurrentUserCache(user) {
  assertUser(user)
  writeCurrentUserRaw(JSON.stringify(user))
}

export function getCachedCurrentUser() {
  const raw = readCurrentUserRaw()
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw)
    assertUser(parsed)
    return parsed
  } catch (_error) {
    writeCurrentUserRaw('')
    return null
  }
}

export function hasAdminRole() {
  const user = getCachedCurrentUser()
  return Boolean(user && user.role === 'admin')
}

export function hasPasswordChangePending() {
  const user = getCachedCurrentUser()
  return Boolean(user && user.mustChangePassword)
}

export async function loginUser(input) {
  const payload = await requestData(
    () =>
      apiClient.post('/auth/login', {
        email: input.email,
        password: input.password,
      }),
    'Não foi possível entrar na sua conta.',
  )

  assertAuthPayload(payload)
  setAuthenticatedHint()
  setCurrentUserCache(payload.user)
  return payload.user
}

export async function changeCurrentPassword(input) {
  const payload = await requestData(
    () =>
      apiClient.post('/auth/change-password', {
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
      }),
    'Não foi possível atualizar a senha.',
  )

  assertAuthPayload(payload)
  setAuthenticatedHint()
  setCurrentUserCache(payload.user)
  return payload.user
}

export async function logoutUser() {
  try {
    await apiClient.post('/auth/logout')
  } finally {
    clearAuthSessionHint()
  }
}

export async function getCurrentUser() {
  const payload = await requestData(() => apiClient.get('/auth/me'), 'Não foi possível carregar seu usuário.')
  assertUser(payload)
  setAuthenticatedHint()
  setCurrentUserCache(payload)
  return payload
}
