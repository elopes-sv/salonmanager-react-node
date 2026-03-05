import { apiClient, requestData } from './http'

function assertUserRecord(user, label = 'usuário') {
  if (
    !user ||
    typeof user !== 'object' ||
    typeof user.id !== 'string' ||
    typeof user.name !== 'string' ||
    typeof user.email !== 'string' ||
    (user.role !== 'admin' && user.role !== 'staff') ||
    typeof user.isActive !== 'boolean' ||
    typeof user.mustChangePassword !== 'boolean'
  ) {
    throw new Error(`Contrato inválido para ${label}.`)
  }
}

export async function listUsers() {
  const payload = await requestData(() => apiClient.get('/users'), 'Não foi possível carregar os usuários.')

  if (!Array.isArray(payload)) {
    throw new Error('Resposta inválida da API de usuários.')
  }

  payload.forEach((user, index) => {
    assertUserRecord(user, `usuário[${index}]`)
  })

  return payload
}

export async function createUser(input) {
  const payload = await requestData(
    () =>
      apiClient.post('/users', {
        name: input.name,
        email: input.email,
        password: input.password,
        role: input.role,
      }),
    'Não foi possível criar o usuário.',
  )

  assertUserRecord(payload, 'usuário criado')
  return payload
}

export async function updateUser(id, input) {
  const payload = await requestData(
    () =>
      apiClient.put(`/users/${id}`, {
        name: input.name,
        email: input.email,
        role: input.role,
        password: input.password ?? '',
      }),
    'Não foi possível atualizar o usuário.',
  )

  assertUserRecord(payload, 'usuário atualizado')
  return payload
}

export async function updateUserStatus(id, isActive) {
  const payload = await requestData(
    () =>
      apiClient.patch(`/users/${id}/status`, {
        isActive,
      }),
    'Não foi possível atualizar o status do usuário.',
  )

  assertUserRecord(payload, 'status de usuário')
  return payload
}

export async function removeUser(id) {
  await requestData(() => apiClient.delete(`/users/${id}`), 'Não foi possível excluir o usuário.')
}

export async function resetUserPassword(id, password = '') {
  const payload = await requestData(
    () =>
      apiClient.post(`/users/${id}/reset-password`, {
        password,
      }),
    'Não foi possível redefinir a senha do usuário.',
  )

  if (!payload || typeof payload !== 'object') {
    throw new Error('Resposta inválida da API de usuários.')
  }

  assertUserRecord(payload.user, 'usuário da redefinição')

  const temporaryPassword =
    typeof payload.temporaryPassword === 'string' ? payload.temporaryPassword : ''

  return {
    user: payload.user,
    temporaryPassword,
  }
}
