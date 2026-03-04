import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

const defaultSqliteFile = path.resolve(process.cwd(), 'data', 'app.db')
const sqliteFile = process.env.SQLITE_FILE ? path.resolve(process.cwd(), process.env.SQLITE_FILE) : defaultSqliteFile

let db = null

function hasColumn(database, tableName, columnName) {
  const columns = database.prepare(`PRAGMA table_info(${tableName})`).all()
  return columns.some((column) => column.name === columnName)
}

function ensureColumn(database, tableName, columnName, columnDefinition) {
  if (hasColumn(database, tableName, columnName)) {
    return
  }

  database.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition};`)
}

function migrateLegacyOwnerData(database) {
  const totalUsers = database.prepare(`SELECT COUNT(*) AS total FROM users`).get()
  if ((totalUsers?.total || 0) !== 1) {
    return
  }

  const onlyUser = database.prepare(`SELECT id FROM users LIMIT 1`).get()
  if (!onlyUser?.id) {
    return
  }

  database.prepare(`UPDATE services SET owner_id = ? WHERE owner_id IS NULL OR owner_id = ''`).run(onlyUser.id)
  database.prepare(`UPDATE appointments SET owner_id = ? WHERE owner_id IS NULL OR owner_id = ''`).run(onlyUser.id)
}

function ensureUserRoles(database) {
  ensureColumn(database, 'users', 'role', "TEXT NOT NULL DEFAULT 'staff'")
  ensureColumn(database, 'users', 'is_active', 'INTEGER NOT NULL DEFAULT 1')
  ensureColumn(database, 'users', 'must_change_password', 'INTEGER NOT NULL DEFAULT 0')

  const adminCount = database
    .prepare(`SELECT COUNT(*) AS total FROM users WHERE role = 'admin' AND is_active = 1`)
    .get()
  if ((adminCount?.total || 0) > 0) {
    return
  }

  const firstUser = database.prepare(`SELECT id FROM users ORDER BY created_at ASC, id ASC LIMIT 1`).get()
  if (!firstUser?.id) {
    return
  }

  database.prepare(`UPDATE users SET role = 'admin', is_active = 1 WHERE id = ?`).run(firstUser.id)
}

function ensureSchemaCompatibility(database) {
  ensureColumn(database, 'appointments', 'owner_id', 'TEXT')
  ensureColumn(database, 'services', 'owner_id', 'TEXT')
  ensureUserRoles(database)

  database.exec(`
    DROP INDEX IF EXISTS idx_services_name_unique;
    CREATE INDEX IF NOT EXISTS idx_appointments_owner_id ON appointments(owner_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_services_owner_name_unique ON services(owner_id, name COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_services_owner_active ON services(owner_id, is_active);
  `)

  migrateLegacyOwnerData(database)
}

function requireOwnerId(ownerId) {
  if (typeof ownerId !== 'string' || !ownerId.trim()) {
    throw new Error('UNAUTHORIZED_CONTEXT')
  }

  return ownerId.trim()
}

function getDb() {
  if (db) {
    return db
  }

  mkdirSync(path.dirname(sqliteFile), { recursive: true })
  db = new Database(sqliteFile)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY,
      owner_id TEXT,
      client TEXT NOT NULL,
      service_id TEXT NOT NULL,
      value REAL NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      start_at TEXT NOT NULL,
      end_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_appointments_start_at ON appointments(start_at);
    CREATE INDEX IF NOT EXISTS idx_appointments_end_at ON appointments(end_at);
    CREATE INDEX IF NOT EXISTS idx_appointments_owner_id ON appointments(owner_id);

    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      owner_id TEXT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      price REAL NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_services_owner_name_unique ON services(owner_id, name COLLATE NOCASE);
    CREATE INDEX IF NOT EXISTS idx_services_owner_active ON services(owner_id, is_active);

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff',
      is_active INTEGER NOT NULL DEFAULT 1,
      must_change_password INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users(email COLLATE NOCASE);

    CREATE TABLE IF NOT EXISTS auth_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);
  `)

  ensureSchemaCompatibility(db)

  return db
}

function isIsoDateString(value) {
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime())
}

function sanitizeAppointmentPayload(payload) {
  const client = typeof payload.client === 'string' ? payload.client.trim() : ''
  const serviceId = typeof payload.serviceId === 'string' ? payload.serviceId.trim() : ''
  const notes = typeof payload.notes === 'string' ? payload.notes : ''
  const value = Number(payload.value)
  const startAt = typeof payload.startAt === 'string' ? payload.startAt : ''
  const endAt = typeof payload.endAt === 'string' ? payload.endAt : ''

  return {
    client,
    serviceId,
    notes,
    value,
    startAt,
    endAt,
  }
}

function validatePayload(payload) {
  if (!payload.client) {
    return 'Nome da cliente é obrigatório.'
  }

  if (!payload.serviceId) {
    return 'Serviço é obrigatório.'
  }

  if (!Number.isFinite(payload.value) || payload.value <= 0) {
    return 'Valor precisa ser maior que zero.'
  }

  if (!isIsoDateString(payload.startAt) || !isIsoDateString(payload.endAt)) {
    return 'Datas precisam estar em formato ISO válido.'
  }

  if (new Date(payload.endAt).getTime() <= new Date(payload.startAt).getTime()) {
    return 'Data final precisa ser maior que data inicial.'
  }

  return null
}

function mapRowToRecord(row) {
  return {
    id: row.id,
    client: row.client,
    serviceId: row.serviceId,
    value: Number(row.value),
    notes: row.notes || '',
    startAt: row.startAt,
    endAt: row.endAt,
  }
}

function sanitizeServicePayload(payload) {
  const name = typeof payload.name === 'string' ? payload.name.trim() : ''
  const durationMinutes = Number(payload.durationMinutes)
  const price = Number(payload.price)
  const description = typeof payload.description === 'string' ? payload.description.trim() : ''
  const isActive = typeof payload.isActive === 'boolean' ? payload.isActive : true

  return {
    name,
    durationMinutes,
    price,
    description,
    isActive,
  }
}

function validateServicePayload(payload) {
  if (!payload.name) {
    return 'Nome do serviço é obrigatório.'
  }

  if (!Number.isInteger(payload.durationMinutes) || payload.durationMinutes <= 0) {
    return 'Duração precisa ser um número inteiro maior que zero.'
  }

  if (!Number.isFinite(payload.price) || payload.price <= 0) {
    return 'Preço precisa ser maior que zero.'
  }

  return null
}

function mapServiceRowToRecord(row) {
  return {
    id: row.id,
    name: row.name,
    durationMinutes: Number(row.durationMinutes),
    price: Number(row.price),
    description: row.description || '',
    isActive: Boolean(row.isActive),
  }
}

function normalizeEmail(value) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim().toLowerCase()
}

function normalizeRole(value) {
  if (typeof value !== 'string') {
    return 'staff'
  }

  const normalized = value.trim().toLowerCase()
  if (normalized === 'admin') {
    return 'admin'
  }

  return 'staff'
}

function sanitizeUserPayload(payload) {
  return {
    name: typeof payload.name === 'string' ? payload.name.trim() : '',
    email: normalizeEmail(payload.email),
    passwordHash: typeof payload.passwordHash === 'string' ? payload.passwordHash : '',
    role: normalizeRole(payload.role),
    mustChangePassword: typeof payload.mustChangePassword === 'boolean' ? payload.mustChangePassword : false,
  }
}

function validateUserPayload(payload) {
  if (!payload.name) {
    return 'Nome é obrigatório.'
  }

  if (!payload.email) {
    return 'E-mail é obrigatório.'
  }

  if (!payload.passwordHash) {
    return 'Senha inválida.'
  }

  if (payload.role !== 'admin' && payload.role !== 'staff') {
    return 'Perfil de usuário inválido.'
  }

  if (typeof payload.mustChangePassword !== 'boolean') {
    return 'Flag de troca obrigatória de senha inválida.'
  }

  return null
}

function sanitizeSessionPayload(payload) {
  return {
    id: typeof payload.id === 'string' ? payload.id.trim() : '',
    userId: typeof payload.userId === 'string' ? payload.userId.trim() : '',
    expiresAt: typeof payload.expiresAt === 'string' ? payload.expiresAt : '',
  }
}

function validateSessionPayload(payload) {
  if (!payload.id) {
    return 'ID de sessão inválido.'
  }

  if (!payload.userId) {
    return 'Usuário da sessão é obrigatório.'
  }

  if (!isIsoDateString(payload.expiresAt)) {
    return 'Expiração da sessão inválida.'
  }

  return null
}

function mapUserRowToPublicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role === 'admin' ? 'admin' : 'staff',
    isActive: Boolean(row.isActive),
    mustChangePassword: Boolean(row.mustChangePassword),
  }
}

function isSqliteConstraintError(error) {
  if (!error || typeof error !== 'object') {
    return false
  }

  if (!('code' in error) || typeof error.code !== 'string') {
    return false
  }

  return error.code.startsWith('SQLITE_CONSTRAINT')
}

function assertNoTimeConflict(database, ownerId, startAt, endAt, excludeId = null) {
  const conflict = database
    .prepare(
      `
      SELECT id
      FROM appointments
      WHERE owner_id = ?
        AND (? IS NULL OR id != ?)
        AND NOT (end_at <= ? OR start_at >= ?)
      LIMIT 1
    `,
    )
    .get(ownerId, excludeId, excludeId, startAt, endAt)

  if (conflict) {
    throw new Error('CONFLICT: Já existe um agendamento nesse intervalo de horário.')
  }
}

function assertServiceNameAvailable(database, name, excludeId = null) {
  const conflict = database
    .prepare(
      `
      SELECT id
      FROM services
      WHERE lower(trim(name)) = lower(trim(?))
        AND (? IS NULL OR id != ?)
      LIMIT 1
    `,
    )
    .get(name, excludeId, excludeId)

  if (conflict) {
    throw new Error('CONFLICT: Já existe um serviço com esse nome.')
  }
}

function getServiceSnapshot(database, serviceId) {
  return database
    .prepare(
      `
      SELECT id, is_active AS isActive
      FROM services
      WHERE id = ?
    `,
    )
    .get(serviceId)
}

function assertServiceExists(database, serviceId) {
  const service = getServiceSnapshot(database, serviceId)
  if (!service) {
    throw new Error('SERVICE_NOT_FOUND')
  }

  return {
    id: service.id,
    isActive: Boolean(service.isActive),
  }
}

function assertServiceAllowedForCreate(database, serviceId) {
  const service = assertServiceExists(database, serviceId)
  if (!service.isActive) {
    throw new Error('SERVICE_INACTIVE')
  }
}

function assertServiceAllowedForUpdate(database, nextServiceId, currentServiceId) {
  const service = assertServiceExists(database, nextServiceId)
  if (nextServiceId !== currentServiceId && !service.isActive) {
    throw new Error('SERVICE_INACTIVE')
  }
}

export async function initializeStore() {
  getDb()
}

export async function listAppointmentRecords(ownerId) {
  const database = getDb()
  const safeOwnerId = requireOwnerId(ownerId)
  const rows = database
    .prepare(
      `
      SELECT
        id,
        client,
        service_id AS serviceId,
        value,
        notes,
        start_at AS startAt,
        end_at AS endAt
      FROM appointments
      WHERE owner_id = ?
      ORDER BY start_at ASC
    `,
    )
    .all(safeOwnerId)

  return rows.map(mapRowToRecord)
}

export async function listServiceRecords() {
  const database = getDb()
  const rows = database
    .prepare(
      `
      SELECT
        id,
        name,
        duration_minutes AS durationMinutes,
        price,
        description,
        is_active AS isActive
      FROM services
      ORDER BY name COLLATE NOCASE ASC
    `,
    )
    .all()

  return rows.map(mapServiceRowToRecord)
}

export async function createUserRecord(inputPayload) {
  const database = getDb()
  const payload = sanitizeUserPayload(inputPayload)
  const validationError = validateUserPayload(payload)

  if (validationError) {
    throw new Error(`VALIDATION: ${validationError}`)
  }

  const record = {
    id: randomUUID(),
    ...payload,
  }

  try {
    database
      .prepare(
        `
      INSERT INTO users (id, name, email, password_hash, role, is_active, must_change_password, updated_at)
      VALUES (@id, @name, @email, @passwordHash, @role, @isActive, @mustChangePassword, datetime('now'))
    `,
      )
      .run({
        ...record,
        isActive: 1,
        mustChangePassword: record.mustChangePassword ? 1 : 0,
      })
  } catch (error) {
    if (isSqliteConstraintError(error)) {
      throw new Error('CONFLICT: Já existe uma conta com esse e-mail.')
    }

    throw error
  }

  return {
    id: record.id,
    name: record.name,
    email: record.email,
    role: record.role,
    isActive: true,
    mustChangePassword: record.mustChangePassword,
  }
}

export async function getUserCredentialByEmail(email) {
  const database = getDb()
  const normalizedEmail = normalizeEmail(email)

  const row = database
    .prepare(
      `
      SELECT
        id,
        name,
        email,
        password_hash AS passwordHash,
        role,
        is_active AS isActive,
        must_change_password AS mustChangePassword
      FROM users
      WHERE email = ?
      LIMIT 1
    `,
    )
    .get(normalizedEmail)

  if (!row) {
    return null
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.passwordHash,
    role: row.role === 'admin' ? 'admin' : 'staff',
    isActive: Boolean(row.isActive),
    mustChangePassword: Boolean(row.mustChangePassword),
  }
}

export async function getUserPublicById(id) {
  const database = getDb()
  const row = database
    .prepare(
      `
      SELECT id, name, email, role, is_active AS isActive
           , must_change_password AS mustChangePassword
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    )
    .get(id)

  if (!row) {
    return null
  }

  return mapUserRowToPublicUser(row)
}

export async function listUserRecords() {
  const database = getDb()
  const rows = database
    .prepare(
      `
      SELECT id, name, email, role, is_active AS isActive
           , must_change_password AS mustChangePassword
      FROM users
      ORDER BY created_at ASC, name COLLATE NOCASE ASC
    `,
    )
    .all()

  return rows.map(mapUserRowToPublicUser)
}

export async function countUserRecords() {
  const database = getDb()
  const result = database.prepare(`SELECT COUNT(*) AS total FROM users`).get()
  return Number(result?.total || 0)
}

export async function updateUserRecord(id, inputPayload) {
  const database = getDb()
  const safeId = typeof id === 'string' ? id.trim() : ''
  if (!safeId) {
    throw new Error('NOT_FOUND')
  }

  const payload = {
    name: typeof inputPayload.name === 'string' ? inputPayload.name.trim() : '',
    email: normalizeEmail(inputPayload.email),
    role: normalizeRole(inputPayload.role),
    passwordHash: typeof inputPayload.passwordHash === 'string' ? inputPayload.passwordHash : '',
  }

  if (!payload.name) {
    throw new Error('VALIDATION: Nome é obrigatório.')
  }

  if (!payload.email) {
    throw new Error('VALIDATION: E-mail é obrigatório.')
  }

  if (payload.role !== 'admin' && payload.role !== 'staff') {
    throw new Error('VALIDATION: Perfil de usuário inválido.')
  }

  const existing = database.prepare(`SELECT id FROM users WHERE id = ?`).get(safeId)
  if (!existing) {
    throw new Error('NOT_FOUND')
  }

  try {
    if (payload.passwordHash) {
      database
        .prepare(
          `
        UPDATE users
        SET name = @name,
            email = @email,
            role = @role,
            password_hash = @passwordHash,
            updated_at = datetime('now')
        WHERE id = @id
      `,
        )
        .run({
          id: safeId,
          ...payload,
        })
    } else {
      database
        .prepare(
          `
        UPDATE users
        SET name = @name,
            email = @email,
            role = @role,
            updated_at = datetime('now')
        WHERE id = @id
      `,
        )
        .run({
          id: safeId,
          ...payload,
        })
    }
  } catch (error) {
    if (isSqliteConstraintError(error)) {
      throw new Error('CONFLICT: Já existe uma conta com esse e-mail.')
    }

    throw error
  }

  const updated = await getUserPublicById(safeId)
  if (!updated) {
    throw new Error('NOT_FOUND')
  }

  return updated
}

export async function updateUserStatusRecord(id, isActive) {
  const database = getDb()
  const safeId = typeof id === 'string' ? id.trim() : ''
  if (!safeId) {
    throw new Error('NOT_FOUND')
  }

  if (typeof isActive !== 'boolean') {
    throw new Error('VALIDATION: Status de usuário inválido.')
  }

  const existing = database.prepare(`SELECT id FROM users WHERE id = ?`).get(safeId)
  if (!existing) {
    throw new Error('NOT_FOUND')
  }

  database
    .prepare(
      `
      UPDATE users
      SET is_active = @isActive,
          updated_at = datetime('now')
      WHERE id = @id
    `,
    )
    .run({
      id: safeId,
      isActive: isActive ? 1 : 0,
    })

  const updated = await getUserPublicById(safeId)
  if (!updated) {
    throw new Error('NOT_FOUND')
  }

  return updated
}

export async function countActiveAdminUsers() {
  const database = getDb()
  const result = database
    .prepare(`SELECT COUNT(*) AS total FROM users WHERE role = 'admin' AND is_active = 1`)
    .get()

  return Number(result?.total || 0)
}

export async function updateUserPasswordRecord(id, passwordHash, options = {}) {
  const database = getDb()
  const safeId = typeof id === 'string' ? id.trim() : ''
  const safePasswordHash = typeof passwordHash === 'string' ? passwordHash : ''
  const hasMustChangePasswordOption = typeof options.mustChangePassword === 'boolean'
  const mustChangePassword = hasMustChangePasswordOption ? options.mustChangePassword : false

  if (!safeId) {
    throw new Error('NOT_FOUND')
  }

  if (!safePasswordHash) {
    throw new Error('VALIDATION: Senha inválida.')
  }

  const existing = database.prepare(`SELECT id FROM users WHERE id = ?`).get(safeId)
  if (!existing) {
    throw new Error('NOT_FOUND')
  }

  if (hasMustChangePasswordOption) {
    database
      .prepare(
        `
        UPDATE users
        SET password_hash = @passwordHash,
            must_change_password = @mustChangePassword,
            updated_at = datetime('now')
        WHERE id = @id
      `,
      )
      .run({
        id: safeId,
        passwordHash: safePasswordHash,
        mustChangePassword: mustChangePassword ? 1 : 0,
      })
  } else {
    database
      .prepare(
        `
        UPDATE users
        SET password_hash = @passwordHash,
            updated_at = datetime('now')
        WHERE id = @id
      `,
      )
      .run({
        id: safeId,
        passwordHash: safePasswordHash,
      })
  }

  const updated = await getUserPublicById(safeId)
  if (!updated) {
    throw new Error('NOT_FOUND')
  }

  return updated
}

export async function revokeAuthSessionsByUser(userId) {
  const database = getDb()
  const safeUserId = typeof userId === 'string' ? userId.trim() : ''

  if (!safeUserId) {
    return
  }

  database
    .prepare(
      `
      UPDATE auth_sessions
      SET revoked_at = datetime('now')
      WHERE user_id = ?
        AND revoked_at IS NULL
    `,
    )
    .run(safeUserId)
}

export async function createAuthSessionRecord(inputPayload) {
  const database = getDb()
  const payload = sanitizeSessionPayload(inputPayload)
  const validationError = validateSessionPayload(payload)

  if (validationError) {
    throw new Error(`VALIDATION: ${validationError}`)
  }

  database
    .prepare(
      `
      INSERT INTO auth_sessions (id, user_id, expires_at)
      VALUES (@id, @userId, @expiresAt)
    `,
    )
    .run(payload)

  return payload
}

export async function findActiveAuthSessionRecord(id, userId) {
  const database = getDb()
  const safeSessionId = typeof id === 'string' ? id.trim() : ''
  const safeUserId = typeof userId === 'string' ? userId.trim() : ''

  if (!safeSessionId || !safeUserId) {
    return null
  }

  const nowIso = new Date().toISOString()
  const row = database
    .prepare(
      `
      SELECT id, user_id AS userId, expires_at AS expiresAt, revoked_at AS revokedAt
      FROM auth_sessions
      WHERE id = ?
        AND user_id = ?
        AND revoked_at IS NULL
        AND expires_at > ?
      LIMIT 1
    `,
    )
    .get(safeSessionId, safeUserId, nowIso)

  if (!row) {
    return null
  }

  return row
}

export async function revokeAuthSessionRecord(id) {
  const database = getDb()
  const safeSessionId = typeof id === 'string' ? id.trim() : ''

  if (!safeSessionId) {
    return
  }

  database
    .prepare(
      `
      UPDATE auth_sessions
      SET revoked_at = datetime('now')
      WHERE id = ?
        AND revoked_at IS NULL
    `,
    )
    .run(safeSessionId)
}

export async function cleanupExpiredAuthSessions() {
  const database = getDb()
  const nowIso = new Date().toISOString()

  database.prepare(`DELETE FROM auth_sessions WHERE expires_at <= ?`).run(nowIso)
}

export async function createServiceRecord(inputPayload) {
  const database = getDb()
  const payload = sanitizeServicePayload(inputPayload)
  const validationError = validateServicePayload(payload)

  if (validationError) {
    throw new Error(`VALIDATION: ${validationError}`)
  }

  assertServiceNameAvailable(database, payload.name)

  const record = {
    id: randomUUID(),
    ...payload,
  }

  try {
    database
      .prepare(
        `
      INSERT INTO services (id, owner_id, name, category, duration_minutes, price, description, is_active, updated_at)
      VALUES (@id, @ownerId, @name, @category, @durationMinutes, @price, @description, @isActive, datetime('now'))
    `,
      )
      .run({
        ...record,
        ownerId: 'global',
        category: '',
        isActive: record.isActive ? 1 : 0,
      })
  } catch (error) {
    if (isSqliteConstraintError(error)) {
      throw new Error('CONFLICT: Já existe um serviço com esse nome.')
    }

    throw error
  }

  return {
    id: record.id,
    name: record.name,
    durationMinutes: record.durationMinutes,
    price: record.price,
    description: record.description,
    isActive: record.isActive,
  }
}

export async function updateServiceRecord(id, inputPayload) {
  const serviceId = id
  const payloadInput = inputPayload
  const database = getDb()
  const payload = sanitizeServicePayload(payloadInput)
  const validationError = validateServicePayload(payload)

  if (validationError) {
    throw new Error(`VALIDATION: ${validationError}`)
  }

  const existing = database.prepare(`SELECT id, is_active AS isActive FROM services WHERE id = ?`).get(serviceId)
  if (!existing) {
    throw new Error('NOT_FOUND')
  }

  assertServiceNameAvailable(database, payload.name, serviceId)

  const isDeactivating = Boolean(existing.isActive) && !payload.isActive
  if (isDeactivating) {
    const nowIso = new Date().toISOString()
    const futureUsage = database
      .prepare(`SELECT COUNT(*) AS total FROM appointments WHERE service_id = ? AND start_at >= ?`)
      .get(serviceId, nowIso)

    if ((futureUsage?.total || 0) > 0) {
      throw new Error('SERVICE_HAS_FUTURE_APPOINTMENTS')
    }
  }

  try {
    database
      .prepare(
        `
      UPDATE services
      SET name = @name,
          duration_minutes = @durationMinutes,
          price = @price,
          description = @description,
          is_active = @isActive,
          updated_at = datetime('now')
      WHERE id = @id
    `,
      )
      .run({
        id: serviceId,
        ...payload,
        isActive: payload.isActive ? 1 : 0,
      })
  } catch (error) {
    if (isSqliteConstraintError(error)) {
      throw new Error('CONFLICT: Já existe um serviço com esse nome.')
    }

    throw error
  }

  return {
    id: serviceId,
    ...payload,
  }
}

export async function deleteServiceRecord(id) {
  const database = getDb()
  const existing = database.prepare(`SELECT id FROM services WHERE id = ?`).get(id)

  if (!existing) {
    throw new Error('NOT_FOUND')
  }

  const usage = database.prepare(`SELECT COUNT(*) AS total FROM appointments WHERE service_id = ?`).get(id)
  if ((usage?.total || 0) > 0) {
    throw new Error('IN_USE')
  }

  database.prepare(`DELETE FROM services WHERE id = ?`).run(id)
}

export async function createAppointmentRecord(ownerId, inputPayload) {
  const database = getDb()
  const safeOwnerId = requireOwnerId(ownerId)
  const payload = sanitizeAppointmentPayload(inputPayload)
  const validationError = validatePayload(payload)

  if (validationError) {
    throw new Error(`VALIDATION: ${validationError}`)
  }

  assertServiceAllowedForCreate(database, payload.serviceId)
  assertNoTimeConflict(database, safeOwnerId, payload.startAt, payload.endAt)

  const record = {
    id: randomUUID(),
    ownerId: safeOwnerId,
    ...payload,
  }

  database
    .prepare(
      `
      INSERT INTO appointments (id, owner_id, client, service_id, value, notes, start_at, end_at, updated_at)
      VALUES (@id, @ownerId, @client, @serviceId, @value, @notes, @startAt, @endAt, datetime('now'))
    `,
    )
    .run(record)

  return {
    id: record.id,
    client: record.client,
    serviceId: record.serviceId,
    value: record.value,
    notes: record.notes,
    startAt: record.startAt,
    endAt: record.endAt,
  }
}

export async function updateAppointmentRecord(ownerId, id, inputPayload) {
  const database = getDb()
  const safeOwnerId = requireOwnerId(ownerId)
  const payload = sanitizeAppointmentPayload(inputPayload)
  const validationError = validatePayload(payload)

  if (validationError) {
    throw new Error(`VALIDATION: ${validationError}`)
  }

  const existing = database
    .prepare(`SELECT id, service_id AS serviceId FROM appointments WHERE id = ? AND owner_id = ?`)
    .get(id, safeOwnerId)

  if (!existing) {
    throw new Error('NOT_FOUND')
  }

  assertServiceAllowedForUpdate(database, payload.serviceId, existing.serviceId)
  assertNoTimeConflict(database, safeOwnerId, payload.startAt, payload.endAt, id)

  database
    .prepare(
      `
      UPDATE appointments
      SET client = @client,
          service_id = @serviceId,
          value = @value,
          notes = @notes,
          start_at = @startAt,
          end_at = @endAt,
          updated_at = datetime('now')
      WHERE id = @id AND owner_id = @ownerId
    `,
    )
    .run({
      id,
      ownerId: safeOwnerId,
      ...payload,
    })

  return {
    id,
    ...payload,
  }
}

export async function deleteAppointmentRecord(ownerId, id) {
  const database = getDb()
  const safeOwnerId = requireOwnerId(ownerId)
  const appointmentId = id
  const result = database.prepare(`DELETE FROM appointments WHERE id = ? AND owner_id = ?`).run(appointmentId, safeOwnerId)

  if (result.changes === 0) {
    throw new Error('NOT_FOUND')
  }
}
