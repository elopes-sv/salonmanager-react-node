import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

function cleanupDatabase(dbFile) {
  rmSync(dbFile, { force: true })
  rmSync(`${dbFile}-wal`, { force: true })
  rmSync(`${dbFile}-shm`, { force: true })
}

async function loadFreshStore() {
  const dbFile = path.join(tmpdir(), `salon-rules-${randomUUID()}.db`)
  process.env.SQLITE_FILE = dbFile

  const moduleUrl = new URL(`../src/store.js?test=${randomUUID()}`, import.meta.url)
  const store = await import(moduleUrl.href)
  await store.initializeStore()

  return { dbFile, store }
}

test('aplica regras de serviços e agendamentos', { concurrency: false }, async (t) => {
  const { dbFile, store } = await loadFreshStore()
  t.after(() => cleanupDatabase(dbFile))
  const ownerA = 'owner-a'
  const ownerB = 'owner-b'

  const activeService = await store.createServiceRecord({
    name: 'Corte Premium',
    durationMinutes: 45,
    price: 90,
    description: 'Corte completo',
    isActive: true,
  })

  const inactiveService = await store.createServiceRecord({
    name: 'Coloração Inativa',
    durationMinutes: 60,
    price: 140,
    description: '',
    isActive: false,
  })

  await assert.rejects(
    store.createServiceRecord({
      name: 'corte premium',
      durationMinutes: 30,
      price: 70,
      description: '',
      isActive: true,
    }),
    (error) => error instanceof Error && error.message.startsWith('CONFLICT:'),
  )

  const firstAppointment = await store.createAppointmentRecord(ownerA, {
    client: 'Cliente A',
    serviceId: activeService.id,
    value: 90,
    notes: '',
    startAt: '2099-03-04T10:00:00.000Z',
    endAt: '2099-03-04T10:45:00.000Z',
  })

  assert.equal(firstAppointment.serviceId, activeService.id)

  const secondOwnerAppointment = await store.createAppointmentRecord(ownerB, {
    client: 'Cliente B',
    serviceId: activeService.id,
    value: 70,
    notes: '',
    startAt: '2099-03-04T10:15:00.000Z',
    endAt: '2099-03-04T10:45:00.000Z',
  })

  assert.equal(secondOwnerAppointment.serviceId, activeService.id)

  await assert.rejects(
    store.createAppointmentRecord(ownerA, {
      client: 'Cliente B',
      serviceId: 'service-id-inexistente',
      value: 90,
      notes: '',
      startAt: '2099-03-04T12:00:00.000Z',
      endAt: '2099-03-04T12:45:00.000Z',
    }),
    (error) => error instanceof Error && error.message === 'SERVICE_NOT_FOUND',
  )

  await assert.rejects(
    store.createAppointmentRecord(ownerA, {
      client: 'Cliente C',
      serviceId: inactiveService.id,
      value: 140,
      notes: '',
      startAt: '2099-03-04T13:00:00.000Z',
      endAt: '2099-03-04T14:00:00.000Z',
    }),
    (error) => error instanceof Error && error.message === 'SERVICE_INACTIVE',
  )

  await assert.rejects(
    store.createAppointmentRecord(ownerA, {
      client: 'Cliente D',
      serviceId: activeService.id,
      value: 95,
      notes: '',
      startAt: '2099-03-04T10:30:00.000Z',
      endAt: '2099-03-04T11:00:00.000Z',
    }),
    (error) => error instanceof Error && error.message.startsWith('CONFLICT:'),
  )

  await assert.rejects(
    store.deleteServiceRecord(activeService.id),
    (error) => error instanceof Error && error.message === 'IN_USE',
  )

  await assert.rejects(
    store.updateServiceRecord(activeService.id, {
      name: activeService.name,
      durationMinutes: activeService.durationMinutes,
      price: activeService.price,
      description: activeService.description,
      isActive: false,
    }),
    (error) => error instanceof Error && error.message === 'SERVICE_HAS_FUTURE_APPOINTMENTS',
  )
})
