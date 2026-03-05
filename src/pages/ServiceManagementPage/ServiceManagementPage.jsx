import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { getErrorCode, getErrorMessage } from '../../api/errors'
import { createService, listServices, removeService, updateService } from '../../api/services'
import { AppShell } from '../../components/AppShell'
import { ServiceTable } from './components/ServiceTable'
import { ServiceFormModal } from './components/ServiceFormModal'
import './ServiceManagementPage.css'

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
  return { name: '', durationMinutes: '45', price: '', description: '', active: true }
}

export function ServiceManagementPage() {
  const navigate = useNavigate()
  const { isAdmin: canManageServices } = useAuth()
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

  const orderedServices = useMemo(() => [...services].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [services])
  const serviceCountLabel = `${orderedServices.length} ${orderedServices.length === 1 ? 'serviço' : 'serviços'}`

  const loadAllServices = useCallback(async () => {
    setIsLoading(true); setLoadError('')
    try {
      setServices(await listServices())
    } catch (error) {
      if (getErrorCode(error) === 'UNAUTHORIZED') { navigate('/login', { replace: true }); return }
      setLoadError(getErrorMessage(error, 'Não foi possível carregar os serviços.'))
    } finally {
      setIsLoading(false)
    }
  }, [navigate])

  useEffect(() => { void loadAllServices() }, [loadAllServices])

  function closeModal() {
    setModalOpen(false); setEditingServiceId(null); setFormState(makeFormState()); setFormError(''); setIsSaving(false)
  }

  function openCreateModal() {
    if (!canManageServices) { setActionError('Apenas administradores podem cadastrar serviços.'); return }
    setEditingServiceId(null); setFormState(makeFormState()); setFormError(''); setActionError(''); setModalOpen(true)
  }

  function openEditModal(serviceId) {
    if (!canManageServices) { setActionError('Apenas administradores podem editar serviços.'); return }
    const service = services.find((item) => item.id === serviceId)
    if (!service) return
    setEditingServiceId(serviceId); setFormState(makeFormState(service)); setFormError(''); setActionError(''); setModalOpen(true)
  }

  async function handleDeleteService(serviceId) {
    if (!canManageServices) { setActionError('Apenas administradores podem excluir serviços.'); return }
    const service = services.find((item) => item.id === serviceId)
    if (!service || !window.confirm(`Excluir o serviço "${service.name}"?`)) return
    setActionError(''); setActiveServiceId(serviceId)
    try {
      await removeService(serviceId)
      setServices((current) => current.filter((item) => item.id !== serviceId))
    } catch (error) {
      if (getErrorCode(error) === 'UNAUTHORIZED') { navigate('/login', { replace: true }); return }
      if (getErrorCode(error) === 'FORBIDDEN') { setActionError('Apenas administradores podem excluir serviços.'); return }
      if (getErrorCode(error) === 'SERVICE_IN_USE') { setActionError('Não é possível excluir um serviço que já possui agendamentos.'); return }
      setActionError(getErrorMessage(error, 'Não foi possível excluir o serviço.'))
    } finally {
      setActiveServiceId('')
    }
  }

  async function handleToggleActive(serviceId, nextActive) {
    if (!canManageServices) { setActionError('Apenas administradores podem alterar o status de serviços.'); return }
    const target = services.find((item) => item.id === serviceId)
    if (!target) return
    setActionError(''); setActiveServiceId(serviceId)
    try {
      const updated = await updateService(serviceId, {
        name: target.name, durationMinutes: target.durationMinutes, price: target.price,
        description: target.description || '', isActive: nextActive,
      })
      setServices((current) => current.map((item) => (item.id === serviceId ? updated : item)))
    } catch (error) {
      if (getErrorCode(error) === 'UNAUTHORIZED') { navigate('/login', { replace: true }); return }
      if (getErrorCode(error) === 'FORBIDDEN') { setActionError('Apenas administradores podem alterar o status de serviços.'); return }
      if (getErrorCode(error) === 'SERVICE_HAS_FUTURE_APPOINTMENTS') { setActionError('Não é possível inativar um serviço com agendamentos futuros.'); return }
      setActionError(getErrorMessage(error, 'Não foi possível atualizar o status do serviço.'))
    } finally {
      setActiveServiceId('')
    }
  }

  function handleFieldChange(field, value) {
    setFormState((current) => ({ ...current, [field]: value }))
  }

  async function handleSubmit(event) {
    event.preventDefault(); setFormError('')
    const name = formState.name.trim()
    const durationMinutes = Number.parseInt(formState.durationMinutes, 10)
    const price = Number.parseFloat(String(formState.price).replace(',', '.'))

    if (!name) { setFormError('Informe o nome do serviço.'); return }
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) { setFormError('Informe uma duração válida em minutos.'); return }
    if (!Number.isFinite(price) || price <= 0) { setFormError('Informe um preço válido maior que zero.'); return }
    if (services.some((s) => s.id !== editingServiceId && s.name.trim().toLowerCase() === name.toLowerCase())) {
      setFormError('Já existe um serviço com esse nome.'); return
    }

    const payload = { name, durationMinutes, price, description: formState.description.trim(), isActive: formState.active }
    setIsSaving(true); setActionError('')
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
      if (getErrorCode(error) === 'UNAUTHORIZED') { navigate('/login', { replace: true }); return }
      if (getErrorCode(error) === 'FORBIDDEN') { setFormError('Apenas administradores podem cadastrar ou editar serviços.'); return }
      if (getErrorCode(error) === 'SERVICE_NAME_CONFLICT') { setFormError('Já existe um serviço com esse nome.'); return }
      if (getErrorCode(error) === 'SERVICE_HAS_FUTURE_APPOINTMENTS') { setFormError('Não é possível inativar um serviço com agendamentos futuros.'); return }
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
          <p className="mt-1 text-base text-slate-500">Gerencie os serviços do salão, duração e valores padrão.</p>
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

      <ServiceTable
        isLoading={isLoading}
        loadError={loadError}
        services={orderedServices}
        countLabel={serviceCountLabel}
        canManage={canManageServices}
        activeServiceId={activeServiceId}
        onEdit={openEditModal}
        onDelete={(id) => void handleDeleteService(id)}
        onToggleActive={(id, active) => void handleToggleActive(id, active)}
        onRetry={() => void loadAllServices()}
      />

      <ServiceFormModal
        isOpen={modalOpen}
        isEditing={Boolean(editingServiceId)}
        formState={formState}
        onFieldChange={handleFieldChange}
        formError={formError}
        isSaving={isSaving}
        onSubmit={handleSubmit}
        onClose={closeModal}
      />
    </AppShell>
  )
}
