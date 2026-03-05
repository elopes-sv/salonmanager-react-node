export function getErrorCode(error) {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code
  }

  return ''
}

export function getErrorMessage(error, fallbackMessage = 'Ocorreu um erro inesperado.') {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallbackMessage
}
