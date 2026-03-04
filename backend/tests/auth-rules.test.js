import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createAccessToken, hashPassword, parseAccessToken, verifyPassword } from '../src/auth.js'

function cleanupDatabase(dbFile) {
  rmSync(dbFile, { force: true })
  rmSync(`${dbFile}-wal`, { force: true })
  rmSync(`${dbFile}-shm`, { force: true })
}

async function loadFreshStore() {
  const dbFile = path.join(tmpdir(), `salon-auth-${randomUUID()}.db`)
  process.env.SQLITE_FILE = dbFile

  const moduleUrl = new URL(`../src/store.js?test=${randomUUID()}`, import.meta.url)
  const store = await import(moduleUrl.href)
  await store.initializeStore()

  return { dbFile, store }
}

test('aplica regras de autenticação e usuário', { concurrency: false }, async (t) => {
  const { dbFile, store } = await loadFreshStore()
  t.after(() => cleanupDatabase(dbFile))

  const password = '12345678'
  const passwordHash = hashPassword(password)

  const createdUser = await store.createUserRecord({
    name: 'Maria Silva',
    email: 'MARIA@SALON.COM',
    passwordHash,
  })

  assert.equal(createdUser.name, 'Maria Silva')
  assert.equal(createdUser.email, 'maria@salon.com')
  assert.equal(createdUser.role, 'staff')
  assert.equal(createdUser.mustChangePassword, false)

  const credential = await store.getUserCredentialByEmail('maria@salon.com')
  assert.ok(credential)
  assert.equal(credential.id, createdUser.id)
  assert.equal(verifyPassword(password, credential.passwordHash), true)
  assert.equal(verifyPassword('senha-incorreta', credential.passwordHash), false)

  await assert.rejects(
    store.createUserRecord({
      name: 'Outro Usuário',
      email: 'maria@salon.com',
      passwordHash: hashPassword('87654321'),
    }),
    (error) => error instanceof Error && error.message.startsWith('CONFLICT:'),
  )

  const sessionId = randomUUID()
  const token = createAccessToken(createdUser.id, sessionId)
  const parsed = parseAccessToken(token)
  assert.equal(parsed.userId, createdUser.id)
  assert.equal(parsed.sessionId, sessionId)

  const publicUser = await store.getUserPublicById(createdUser.id)
  assert.deepEqual(publicUser, createdUser)

  const createdAdmin = await store.createUserRecord({
    name: 'Admin',
    email: 'admin@salon.com',
    passwordHash: hashPassword('12345678'),
    role: 'admin',
  })
  assert.equal(createdAdmin.role, 'admin')

  const users = await store.listUserRecords()
  assert.equal(users.length, 2)

  const updatedUser = await store.updateUserRecord(createdUser.id, {
    name: 'Maria Souza',
    email: 'maria.souza@salon.com',
    role: 'staff',
    passwordHash: '',
  })
  assert.equal(updatedUser.name, 'Maria Souza')
  assert.equal(updatedUser.email, 'maria.souza@salon.com')

  const statusUpdated = await store.updateUserStatusRecord(createdUser.id, false)
  assert.equal(statusUpdated.isActive, false)

  const passwordReset = await store.updateUserPasswordRecord(createdUser.id, hashPassword('novasenha123'))
  assert.equal(passwordReset.id, createdUser.id)
  assert.equal(passwordReset.mustChangePassword, false)

  const forcedPasswordReset = await store.updateUserPasswordRecord(createdUser.id, hashPassword('novasenha321'), {
    mustChangePassword: true,
  })
  assert.equal(forcedPasswordReset.id, createdUser.id)
  assert.equal(forcedPasswordReset.mustChangePassword, true)

  await store.revokeAuthSessionsByUser(createdUser.id)

  const expiresAt = new Date(Date.now() + 60_000).toISOString()
  await store.createAuthSessionRecord({
    id: sessionId,
    userId: createdUser.id,
    expiresAt,
  })

  const activeSession = await store.findActiveAuthSessionRecord(sessionId, createdUser.id)
  assert.ok(activeSession)
  assert.equal(activeSession.id, sessionId)

  await store.revokeAuthSessionRecord(sessionId)
  const revokedSession = await store.findActiveAuthSessionRecord(sessionId, createdUser.id)
  assert.equal(revokedSession, null)
})
