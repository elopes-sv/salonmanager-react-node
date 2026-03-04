import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { hasAdminRole } from '../../api/auth'
import { createService, listServices, removeService, updateService } from '../../api/services'
import { AppShell } from '../../components/AppShell'
import './ServiceManagementPage.css'

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function makeFormState(service = null) {
  if (service) {
    return {
      name: service.name,
      durationMinutes: String(service.durationMinutes),
      price: service.price.toFixed(2).replace('.', ','),
      description: service.description || '',
      active: service.isActive,
    }
  }

  return {
    name: '',
    durationMinutes: '45',
    price: '',
    description: '',
    active: true,
  }
}

function getErrorMessage(error, fallbackMessage = 'Ocorreu um erro inesperado.') {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallbackMessage
}

function getErrorCode(error) {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code
  }

  return ''
}

export function ServiceManagementPage() {
  const navigate = useNavigate()
  const canManageServices = hasAdminRole()
  const [services, setServices] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingServiceId, setEditingServiceId] = useState(null)
  const [formState, setFormState] = useState(makeFormState())
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [activeServiceId, setActiveServiceId] = useState('')

  const orderedServices = useMemo(() => {
    return [...services].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))
  }, [services])

  const serviceCountLabel = `${orderedServices.length} ${orderedServices.length === 1 ? 'serviço' : 'serviços'}`

  const loadAllServices = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')

    try {
      const records = await listServices()
      setServices(records)
    } catch (error) {
      if (getErrorCode(error) === 'UNAUTHORIZED') {
        navigate('/login', { replace: true })
        return
      }

      setLoadError(getErrorMessage(error, 'Não foi possível carregar os serviços.'))
    } finally {
      setIsLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    void loadAllServices()
  }, [loadAllServices])

  function closeModal() {
    setModalOpen(false)
    setEditingServiceId(null)
    setFormState(makeFormState())
    setFormError('')
    setIsSaving(false)
  }

  function openCreateModal() {
    if (!canManageServices) {
      setActionError('Apenas administradores podem cadastrar serviços.')
      return
    }

    setEditingServiceId(null)
    setFormState(makeFormState())
    setFormError('')
    setActionError('')
    setModalOpen(true)
  }

  function openEditModal(serviceId) {
    if (!canManageServices) {
      setActionError('Apenas administradores podem editar serviços.')
      return
    }

    const service = services.find((item) => item.id === serviceId)
    if (!service) {
      return
    }

    setEditingServiceId(serviceId)
    setFormState(makeFormState(service))
    setFormError('')
    setActionError('')
    setModalOpen(true)
  }

  async function handleDeleteService(serviceId) {
    if (!canManageServices) {
      setActionError('Apenas administradores podem excluir serviços.')
      return
    }

    const service = services.find((item) => item.id === serviceId)
    if (!service) {
      return
    }

    const confirmed = window.confirm(`Excluir o serviço "${service.name}"?`)
    if (!confirmed) {
      return
    }

    setActionError('')
    setActiveServiceId(serviceId)

    try {
      await removeService(serviceId)
      setServices((current) => current.filter((item) => item.id !== serviceId))
    } catch (error) {
      if (getErrorCode(error) === 'UNAUTHORIZED') {
        navigate('/login', { replace: true })
        return
      }

      if (getErrorCode(error) === 'FORBIDDEN') {
        setActionError('Apenas administradores podem excluir serviços.')
        return
      }

      if (getErrorCode(error) === 'SERVICE_IN_USE') {
        setActionError('Não é possível excluir um serviço que já possui agendamentos.')
        return
      }

      setActionError(getErrorMessage(error, 'Não foi possível excluir o serviço.'))
    } finally {
      setActiveServiceId('')
    }
  }

  async function handleToggleActive(serviceId, nextActive) {
    if (!canManageServices) {
      setActionError('Apenas administradores podem alterar o status de serviços.')
      return
    }

    const targetService = services.find((item) => item.id === serviceId)
    if (!targetService) {
      return
    }

    setActionError('')
    setActiveServiceId(serviceId)

    try {
      const updated = await updateService(serviceId, {
        name: targetService.name,
        durationMinutes: targetService.durationMinutes,
        price: targetService.price,
        description: targetService.description || '',
        isActive: nextActive,
      })

      setServices((current) => current.map((item) => (item.id === serviceId ? updated : item)))
    } catch (error) {
      if (getErrorCode(error) === 'UNAUTHORIZED') {
        navigate('/login', { replace: true })
        return
      }

      if (getErrorCode(error) === 'FORBIDDEN') {
        setActionError('Apenas administradores podem alterar o status de serviços.')
        return
      }

      if (getErrorCode(error) === 'SERVICE_HAS_FUTURE_APPOINTMENTS') {
        setActionError('Não é possível inativar um serviço com agendamentos futuros.')
        return
      }

      setActionError(getErrorMessage(error, 'Não foi possível atualizar o status do serviço.'))
    } finally {
      setActiveServiceId('')
    }
  }

  function handleFieldChange(field, value) {
    setFormState((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')

    const name = formState.name.trim()
    const durationMinutes = Number.parseInt(formState.durationMinutes, 10)
    const price = Number.parseFloat(String(formState.price).replace(',', '.'))
    const normalizedName = name.toLowerCase()

    if (!name) {
      setFormError('Informe o nome do serviço.')
      return
    }

    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      setFormError('Informe uma duração válida em minutos.')
      return
    }

    if (!Number.isFinite(price) || price <= 0) {
      setFormError('Informe um preço válido maior que zero.')
      return
    }

    const duplicatedName = services.some((service) => {
      return service.id !== editingServiceId && service.name.trim().toLowerCase() === normalizedName
    })

    if (duplicatedName) {
      setFormError('Já existe um serviço com esse nome.')
      return
    }

    const payload = {
      name,
      durationMinutes,
      price,
      description: formState.description.trim(),
      isActive: formState.active,
    }

    setIsSaving(true)
    setActionError('')

    try {
      if (editingServiceId) {
        const updated = await updateService(editingServiceId, payload)
        setServices((current) => current.map((item) => (item.id === editingServiceId ? updated : item)))
      } else {
        const created = await createService(payload)
        setServices((current) => [...current, created])
      }

      closeModal()
    } catch (error) {
      if (getErrorCode(error) === 'UNAUTHORIZED') {
        navigate('/login', { replace: true })
        return
      }

      if (getErrorCode(error) === 'FORBIDDEN') {
        setFormError('Apenas administradores podem cadastrar ou editar serviços.')
        return
      }

      if (getErrorCode(error) === 'SERVICE_NAME_CONFLICT') {
        setFormError('Já existe um serviço com esse nome.')
        return
      }

      if (getErrorCode(error) === 'SERVICE_HAS_FUTURE_APPOINTMENTS') {
        setFormError('Não é possível inativar um serviço com agendamentos futuros.')
        return
      }

      setFormError(getErrorMessage(error, 'Não foi possível salvar o serviço.'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AppShell active="services">
            <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Serviços</h2>
                <p className="mt-1 text-base text-slate-500">
                  Gerencie os serviços do salão, duração e valores padrão.
                </p>
              </div>

              {canManageServices ? (
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined text-xl">add</span>
                  <span>Novo serviço</span>
                </button>
              ) : (
                <span className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Somente admin cadastra serviços
                </span>
              )}
            </div>

            {actionError ? (
              <div className="mb-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                {actionError}
              </div>
            ) : null}

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Nome do serviço</th>
                      <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Valor padrão</th>
                      <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Situação</th>
                      <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Ações</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {isLoading ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-10 text-center text-sm text-slate-500">
                          Carregando serviços...
                        </td>
                      </tr>
                    ) : null}

                    {!isLoading && loadError ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-10 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <p className="text-sm font-medium text-rose-700">{loadError}</p>
                            <button
                              type="button"
                              onClick={() => void loadAllServices()}
                              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                            >
                              Tentar novamente
                            </button>
                          </div>
                        </td>
                      </tr>
                    ) : null}

                    {!isLoading && !loadError && orderedServices.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-10 text-center text-sm text-slate-500">
                          Nenhum serviço cadastrado.
                        </td>
                      </tr>
                    ) : null}

                    {!isLoading && !loadError
                      ? orderedServices.map((service) => {
                          const isRowBusy = activeServiceId === service.id

                          return (
                            <tr key={service.id} className="transition-colors hover:bg-slate-50/50">
                              <td className="px-6 py-5">
                                <div className="flex flex-col">
                                  <span className="text-sm font-semibold text-slate-900">{service.name}</span>
                                  <span className="text-xs text-slate-500">Duração: {service.durationMinutes} min</span>
                                </div>
                              </td>

                              <td className="px-6 py-5 text-right font-medium text-slate-900">
                                {currencyFormatter.format(service.price)}
                              </td>

                              <td className="px-6 py-5">
                                <div className="flex items-center justify-center">
                                  {canManageServices ? (
                                    <label className="relative inline-flex cursor-pointer items-center">
                                      <input
                                        type="checkbox"
                                        className="peer sr-only"
                                        checked={service.isActive}
                                        disabled={isRowBusy}
                                        onChange={(event) => void handleToggleActive(service.id, event.target.checked)}
                                      />
                                      <div className="h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white" />
                                    </label>
                                  ) : (
                                    <span
                                      className={`text-xs font-semibold ${service.isActive ? 'text-emerald-600' : 'text-slate-400'}`}
                                    >
                                      {service.isActive ? 'Ativo' : 'Inativo'}
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="px-6 py-5 text-right">
                                {canManageServices ? (
                                  <div className="flex justify-end gap-2">
                                    <button
                                      type="button"
                                      className="p-2 text-slate-400 transition-colors hover:text-primary"
                                      disabled={isRowBusy}
                                      onClick={() => openEditModal(service.id)}
                                    >
                                      <span className="material-symbols-outlined text-lg">edit</span>
                                    </button>
                                    <button
                                      type="button"
                                      className="p-2 text-slate-400 transition-colors hover:text-red-500"
                                      disabled={isRowBusy}
                                      onClick={() => void handleDeleteService(service.id)}
                                    >
                                      <span className="material-symbols-outlined text-lg">delete</span>
                                    </button>
                                  </div>
                                ) : (
                                  <span className="text-xs text-slate-400">-</span>
                                )}
                              </td>
                            </tr>
                          )
                        })
                      : null}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
                <span className="text-xs font-medium text-slate-500">Total: {serviceCountLabel}</span>
              </div>
            </div>

      {modalOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between px-8 pb-4 pt-8">
              <h2 className="text-2xl font-bold text-slate-900">{editingServiceId ? 'Editar Serviço' : 'Novo Serviço'}</h2>
              <button type="button" className="text-slate-400 transition-colors hover:text-slate-600" onClick={closeModal}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form className="space-y-6 px-8 py-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700" htmlFor="service-name">
                  Nome do serviço
                </label>
                <input
                  id="service-name"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary"
                  placeholder="Ex.: Balayage Assinatura + Matização"
                  type="text"
                  disabled={isSaving}
                  value={formState.name}
                  onChange={(event) => handleFieldChange('name', event.target.value)}
                />
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700" htmlFor="service-duration">
                    Duração (min)
                  </label>
                  <input
                    id="service-duration"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary"
                    placeholder="45"
                    type="number"
                    min="1"
                    disabled={isSaving}
                    value={formState.durationMinutes}
                    onChange={(event) => handleFieldChange('durationMinutes', event.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700" htmlFor="service-price">
                    Preço base (R$)
                  </label>
                  <input
                    id="service-price"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary"
                    placeholder="0,00"
                    type="text"
                    inputMode="decimal"
                    disabled={isSaving}
                    value={formState.price}
                    onChange={(event) => handleFieldChange('price', event.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700" htmlFor="service-description">
                  Descrição (opcional)
                </label>
                <textarea
                  id="service-description"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary"
                  placeholder="Descreva brevemente o que está incluso neste serviço..."
                  rows={3}
                  disabled={isSaving}
                  value={formState.description}
                  onChange={(event) => handleFieldChange('description', event.target.value)}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-900">Serviço ativo</span>
                  <span className="text-xs text-slate-500">Defina se este serviço está disponível para agendamento.</span>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    disabled={isSaving}
                    checked={formState.active}
                    onChange={(event) => handleFieldChange('active', event.target.checked)}
                  />
                  <div className="h-6 w-11 rounded-full bg-slate-300 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white" />
                </label>
              </div>

              {formError ? <p className="text-sm font-medium text-rose-700">{formError}</p> : null}

              <div className="flex items-center justify-end gap-4 border-t border-slate-100 pb-8 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isSaving}
                  className="rounded-lg border border-slate-300 px-6 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  disabled={isSaving}
                  className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/20 transition-all hover:bg-primary/90"
                >
                  <span className="material-symbols-outlined text-[18px]">save</span>
                  {isSaving ? 'Salvando...' : editingServiceId ? 'Salvar alterações' : 'Criar serviço'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </AppShell>
  )
}
