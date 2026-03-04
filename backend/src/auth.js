import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'

const configuredTokenSecret = process.env.AUTH_TOKEN_SECRET ? process.env.AUTH_TOKEN_SECRET.trim() : ''
const tokenSecret = configuredTokenSecret || randomBytes(32).toString('hex')
const tokenTtlSecondsRaw = Number.parseInt(process.env.AUTH_TOKEN_TTL_SECONDS || '604800', 10)
const tokenTtlSeconds = Number.isFinite(tokenTtlSecondsRaw) && tokenTtlSecondsRaw > 0 ? tokenTtlSecondsRaw : 604800

export const authRuntimeFlags = Object.freeze({
  usesEphemeralTokenSecret: !configuredTokenSecret,
})
export const accessTokenTtlSeconds = tokenTtlSeconds

function toBase64Url(value) {
  return Buffer.from(value).toString('base64url')
}

function fromBase64Url(value) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function createSignature(payloadEncoded) {
  return createHmac('sha256', tokenSecret).update(payloadEncoded).digest('base64url')
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  const derivedKey = scryptSync(password, salt, 64).toString('hex')
  return `scrypt$${salt}$${derivedKey}`
}

export function verifyPassword(password, passwordHash) {
  if (typeof passwordHash !== 'string') {
    return false
  }

  const [algorithm, salt, hashHex] = passwordHash.split('$')
  if (algorithm !== 'scrypt' || !salt || !hashHex) {
    return false
  }

  const expected = Buffer.from(hashHex, 'hex')
  const current = scryptSync(password, salt, expected.length)

  if (expected.length !== current.length) {
    return false
  }

  return timingSafeEqual(expected, current)
}

export function createAccessToken(userId, sessionId = randomUUID()) {
  if (typeof userId !== 'string' || !userId.trim()) {
    throw new Error('INVALID_USER_ID')
  }

  if (typeof sessionId !== 'string' || !sessionId.trim()) {
    throw new Error('INVALID_SESSION_ID')
  }

  const nowSeconds = Math.floor(Date.now() / 1000)
  const payload = {
    sub: userId,
    sid: sessionId,
    iat: nowSeconds,
    exp: nowSeconds + tokenTtlSeconds,
  }

  const encodedPayload = toBase64Url(JSON.stringify(payload))
  const signature = createSignature(encodedPayload)

  return `${encodedPayload}.${signature}`
}

export function parseAccessToken(token) {
  if (typeof token !== 'string') {
    throw new Error('INVALID_TOKEN')
  }

  const [encodedPayload, signature] = token.split('.')
  if (!encodedPayload || !signature) {
    throw new Error('INVALID_TOKEN')
  }

  const expectedSignature = createSignature(encodedPayload)
  const expectedBuffer = Buffer.from(expectedSignature)
  const signatureBuffer = Buffer.from(signature)

  if (expectedBuffer.length !== signatureBuffer.length) {
    throw new Error('INVALID_TOKEN')
  }

  if (!timingSafeEqual(expectedBuffer, signatureBuffer)) {
    throw new Error('INVALID_TOKEN')
  }

  let payload
  try {
    payload = JSON.parse(fromBase64Url(encodedPayload))
  } catch (_error) {
    throw new Error('INVALID_TOKEN')
  }

  if (
    !payload ||
    typeof payload !== 'object' ||
    typeof payload.sub !== 'string' ||
    typeof payload.sid !== 'string' ||
    typeof payload.exp !== 'number'
  ) {
    throw new Error('INVALID_TOKEN')
  }

  const nowSeconds = Math.floor(Date.now() / 1000)
  if (payload.exp <= nowSeconds) {
    throw new Error('TOKEN_EXPIRED')
  }

  return {
    userId: payload.sub,
    sessionId: payload.sid,
    issuedAt: payload.iat,
    expiresAt: payload.exp,
  }
}
