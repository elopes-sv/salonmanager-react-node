import axios from 'axios'

const rawBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const baseUrl = rawBaseUrl.replace(/\/+$/, '')
const authSessionHintStorageKey = 'salonmanager.auth_session_hint'
const currentUserStorageKey = 'salonmanager.current_user'

export const apiClient = axios.create({
  baseURL: baseUrl,
  withCredentials: true,
})

function clearClientAuthState() {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(authSessionHintStorageKey)
  window.localStorage.removeItem(currentUserStorageKey)
}

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = Number(error?.response?.status || 0)
    const payload = error?.response?.data
    const code =
      payload && typeof payload === 'object' && typeof payload.code === 'string' ? payload.code : ''

    if (status === 401 || code === 'UNAUTHORIZED') {
      clearClientAuthState()
    }

    return Promise.reject(error)
  },
)

export function normalizeApiError(error, fallbackErrorMessage) {
  let message = fallbackErrorMessage
  let code = ''
  let status = 0

  if (axios.isAxiosError(error)) {
    status = Number(error.response?.status || 0)
    const payload = error.response?.data

    if (payload && typeof payload === 'object') {
      if (typeof payload.message === 'string' && payload.message.trim()) {
        message = payload.message
      }

      if (typeof payload.code === 'string') {
        code = payload.code
      }
    } else if (typeof payload === 'string' && payload.trim()) {
      message = payload
    } else if (typeof error.message === 'string' && error.message.trim()) {
      message = error.message
    }
  } else if (error instanceof Error && error.message.trim()) {
    message = error.message
  }

  const normalizedError = new Error(message)
  if (code) {
    normalizedError.code = code
  }
  if (status > 0) {
    normalizedError.status = status
  }

  return normalizedError
}

export async function requestData(requestFactory, fallbackErrorMessage) {
  try {
    const response = await requestFactory()
    return response.data
  } catch (error) {
    throw normalizeApiError(error, fallbackErrorMessage)
  }
}
