import { assertValidAppointmentRecord } from './contracts'
import { apiClient, requestData } from './http'

function serializeInput(input) {
  return {
    client: input.client,
    serviceId: input.serviceId,
    value: input.value,
    notes: input.notes ?? '',
    startAt: input.startAt,
    endAt: input.endAt,
  }
}

function assertRecordArray(records) {
  if (!Array.isArray(records)) {
    throw new Error('Resposta inválida da API de agendamentos.')
  }

  records.forEach((record, index) => {
    assertValidAppointmentRecord(record, `agendamento[${index}]`)
  })
}

export async function listAppointments() {
  const data = await requestData(() => apiClient.get('/appointments'), 'Não foi possível carregar os agendamentos.')
  assertRecordArray(data)
  return data
}

export async function createAppointment(input) {
  const data = await requestData(
    () => apiClient.post('/appointments', serializeInput(input)),
    'Não foi possível criar o agendamento.',
  )

  assertValidAppointmentRecord(data, 'agendamento criado')
  return data
}

export async function updateAppointment(id, updates) {
  const data = await requestData(
    () => apiClient.put(`/appointments/${id}`, serializeInput(updates)),
    'Não foi possível atualizar o agendamento.',
  )

  assertValidAppointmentRecord(data, 'agendamento atualizado')
  return data
}

export async function removeAppointment(id) {
  await requestData(() => apiClient.delete(`/appointments/${id}`), 'Não foi possível excluir o agendamento.')
}
