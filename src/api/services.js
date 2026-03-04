import { assertValidServiceRecord } from './contracts'
import { apiClient, requestData } from './http'

function serializeInput(input) {
  return {
    name: input.name,
    durationMinutes: input.durationMinutes,
    price: input.price,
    description: input.description ?? '',
    isActive: input.isActive,
  }
}

function assertRecordArray(records) {
  if (!Array.isArray(records)) {
    throw new Error('Resposta inválida da API de serviços.')
  }

  records.forEach((record, index) => {
    assertValidServiceRecord(record, `serviço[${index}]`)
  })
}

export async function listServices() {
  const data = await requestData(() => apiClient.get('/services'), 'Não foi possível carregar os serviços.')
  assertRecordArray(data)
  return data
}

export async function createService(input) {
  const data = await requestData(
    () => apiClient.post('/services', serializeInput(input)),
    'Não foi possível criar o serviço.',
  )

  assertValidServiceRecord(data, 'serviço criado')
  return data
}

export async function updateService(id, updates) {
  const data = await requestData(
    () => apiClient.put(`/services/${id}`, serializeInput(updates)),
    'Não foi possível atualizar o serviço.',
  )

  assertValidServiceRecord(data, 'serviço atualizado')
  return data
}

export async function removeService(id) {
  await requestData(() => apiClient.delete(`/services/${id}`), 'Não foi possível excluir o serviço.')
}
