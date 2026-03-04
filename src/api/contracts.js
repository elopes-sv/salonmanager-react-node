export const appointmentContract = Object.freeze({
  id: 'string',
  client: 'string',
  serviceId: 'string',
  value: 'number',
  notes: 'string',
  startAt: 'string (ISO 8601)',
  endAt: 'string (ISO 8601)',
})

function isIsoDateString(value) {
  if (typeof value !== 'string' || value.length < 20) {
    return false
  }

  return !Number.isNaN(new Date(value).getTime())
}

export function isValidAppointmentRecord(value) {
  if (!value || typeof value !== 'object') {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.client === 'string' &&
    typeof value.serviceId === 'string' &&
    typeof value.value === 'number' &&
    !Number.isNaN(value.value) &&
    typeof value.notes === 'string' &&
    isIsoDateString(value.startAt) &&
    isIsoDateString(value.endAt)
  )
}

export function assertValidAppointmentRecord(value, label = 'agendamento') {
  if (!isValidAppointmentRecord(value)) {
    throw new Error(`Contrato inválido para ${label}.`)
  }
}

export const serviceContract = Object.freeze({
  id: 'string',
  name: 'string',
  durationMinutes: 'number (integer > 0)',
  price: 'number (> 0)',
  description: 'string',
  isActive: 'boolean',
})

export function isValidServiceRecord(value) {
  if (!value || typeof value !== 'object') {
    return false
  }

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.durationMinutes === 'number' &&
    Number.isInteger(value.durationMinutes) &&
    value.durationMinutes > 0 &&
    typeof value.price === 'number' &&
    Number.isFinite(value.price) &&
    value.price > 0 &&
    typeof value.description === 'string' &&
    typeof value.isActive === 'boolean'
  )
}

export function assertValidServiceRecord(value, label = 'serviço') {
  if (!isValidServiceRecord(value)) {
    throw new Error(`Contrato inválido para ${label}.`)
  }
}
