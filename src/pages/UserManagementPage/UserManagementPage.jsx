import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { getErrorCode, getErrorMessage } from '../../api/errors'
import { createUser, listUsers, removeUser, resetUserPassword, updateUser, updateUserStatus } from '../../api/users'
import { AppShell } from '../../components/AppShell'
import { UserFormModal } from './components/UserFormModal'
import { ResetPasswordModal } from './components/ResetPasswordModal'
import { UserTable } from './components/UserTable'
import './UserManagementPage.css'

function makeFormState(user = null) {
  if (user) {
    return { name: user.name, email: user.email, password: '', role: user.role }
  }
  return { name: '', email: '', password: '', role: 'staff' }
}

export function UserManagementPage() {
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const currentUserId = currentUser ? currentUser.id : ''
  const [users, setUsers] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [actionSuccess, setActionSuccess] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUserId, setEditingUserId] = useState('')
  const [formState, setFormState] = useState(makeFormState())
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [activeUserId, setActiveUserId] = useState('')
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [resetTargetUserId, setResetTargetUserId] = useState('')
  const [resetMode, setResetMode] = useState('generated')
  const [resetPasswordValue, setResetPasswordValue] = useState('')
  const [resetError, setResetError] = useState('')
  const [isResetting, setIsResetting] = useState(false)

  const orderedUsers = useMemo(() => [...users].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [users])

  const filteredUsers = useMemo(() => {
    return orderedUsers.filter((user) => {
      const matchesRole = roleFilter === 'all' || user.role === roleFilter
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' && user.isActive) || (statusFilter === 'inactive' && !user.isActive)
      return matchesRole && matchesStatus
    })
  }, [orderedUsers, roleFilter, statusFilter])

  const filteredCountLabel =
    filteredUsers.length === orderedUsers.length
      ? `${orderedUsers.length} ${orderedUsers.length === 1 ? 'usuário' : 'usuários'}`
      : `${filteredUsers.length} de ${orderedUsers.length} usuários`
  const editingUser = editingUserId ? users.find((item) => item.id === editingUserId) || null : null
  const resetTargetUser = resetTargetUserId ? users.find((item) => item.id === resetTargetUserId) || null : null

  const loadAllUsers = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')
    try {
      const records = await listUsers()
      setUsers(records)
    } catch (error) {
      if (getErrorCode(error) === 'UNAUTHORIZED') { navigate('/login', { replace: true }); return }
      if (getErrorCode(error) === 'FORBIDDEN') { navigate('/appointments', { replace: true }); return }
      setLoadError(getErrorMessage(error, 'Não foi possível carregar os usuários.'))
    } finally {
      setIsLoading(false)
    }
  }, [navigate])

  useEffect(() => { void loadAllUsers() }, [loadAllUsers])

  function handleFieldChange(field, value) {
    setFormState((current) => ({ ...current, [field]: value }))
  }

  function closeModal() {
    setModalOpen(false); setEditingUserId(''); setFormState(makeFormState()); setFormError(''); setIsSaving(false)
  }

  function closeResetModal() {
    setResetModalOpen(false); setResetTargetUserId(''); setResetMode('generated'); setResetPasswordValue(''); setResetError(''); setIsResetting(false)
  }

  function openCreateModal() {
    setActionError(''); setActionSuccess(''); setFormError(''); setEditingUserId(''); setFormState(makeFormState()); setModalOpen(true)
  }

  function openEditModal(userId) {
    const user = users.find((item) => item.id === userId)
    if (!user) return
    setActionError(''); setActionSuccess(''); setFormError(''); setEditingUserId(userId); setFormState(makeFormState(user)); setModalOpen(true)
  }

  async function handleToggleStatus(userId, nextActive) {
    const targetUser = users.find((item) => item.id === userId)
    if (!targetUser) return
    if (!window.confirm(`${nextActive ? 'Ativar' : 'Inativar'} o usuário "${targetUser.name}"?`)) return
    setActionError(''); setActionSuccess(''); setActiveUserId(userId)
    try {
      const updated = await updateUserStatus(userId, nextActive)
      setUsers((current) => current.map((item) => (item.id === userId ? updated : item)))
      setActionSuccess(`Usuário ${nextActive ? 'ativado' : 'inativado'} com sucesso.`)
    } catch (error) {
      if (getErrorCode(error) === 'UNAUTHORIZED') { navigate('/login', { replace: true }); return }
      if (getErrorCode(error) === 'FORBIDDEN') { navigate('/appointments', { replace: true }); return }
      if (getErrorCode(error) === 'LAST_ADMIN_REQUIRED') { setActionError('Deve existir ao menos um administrador ativo.'); return }
      if (getErrorCode(error) === 'SELF_DEACTIVATION_NOT_ALLOWED') { setActionError('Não é possível inativar o próprio usuário logado.'); return }
      setActionError(getErrorMessage(error, 'Não foi possível atualizar o status do usuário.'))
    } finally {
      setActiveUserId('')
    }
  }

  async function handleDeleteUser(userId) {
    const targetUser = users.find((item) => item.id === userId)
    if (!targetUser) return
    if (!window.confirm(`Excluir o usuário "${targetUser.name}"? Esta ação não pode ser desfeita.`)) return
    setActionError(''); setActionSuccess(''); setActiveUserId(userId)
    try {
      await removeUser(userId)
      setUsers((current) => current.filter((item) => item.id !== userId))
      setActionSuccess('Usuário excluído com sucesso.')
    } catch (error) {
      if (getErrorCode(error) === 'UNAUTHORIZED') { navigate('/login', { replace: true }); return }
      if (getErrorCode(error) === 'FORBIDDEN') { navigate('/appointments', { replace: true }); return }
      if (getErrorCode(error) === 'LAST_ADMIN_REQUIRED') { setActionError('Deve existir ao menos um administrador ativo.'); return }
      if (getErrorCode(error) === 'SELF_DELETION_NOT_ALLOWED') { setActionError('Não é possível excluir o próprio usuário logado.'); return }
      setActionError(getErrorMessage(error, 'Não foi possível excluir o usuário.'))
    } finally {
      setActiveUserId('')
    }
  }

  function openResetPasswordModal(userId) {
    const user = users.find((item) => item.id === userId)
    if (!user) return
    setActionError(''); setActionSuccess(''); setResetTargetUserId(userId); setResetMode('generated'); setResetPasswordValue(''); setResetError(''); setResetModalOpen(true)
  }

  async function handleResetPasswordSubmit(event) {
    event.preventDefault()
    setResetError('')
    if (!resetTargetUserId) { setResetError('Usuário inválido para redefinição de senha.'); return }
    const manualPassword = resetPasswordValue
    const shouldUseManualPassword = resetMode === 'manual'
    if (shouldUseManualPassword && manualPassword.length < 8) { setResetError('Informe uma senha com pelo menos 8 caracteres.'); return }
    setIsResetting(true)
    try {
      const result = await resetUserPassword(resetTargetUserId, shouldUseManualPassword ? manualPassword : '')
      setUsers((current) => current.map((item) => (item.id === result.user.id ? result.user : item)))
      if (result.temporaryPassword) { window.alert(`Senha temporária gerada para "${result.user.name}": ${result.temporaryPassword}`) }
      setActionSuccess('Senha redefinida com sucesso.')
      closeResetModal()
    } catch (error) {
      if (getErrorCode(error) === 'UNAUTHORIZED') { navigate('/login', { replace: true }); return }
      if (getErrorCode(error) === 'FORBIDDEN') { navigate('/appointments', { replace: true }); return }
      setResetError(getErrorMessage(error, 'Não foi possível redefinir a senha.'))
    } finally {
      setIsResetting(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')
    const name = formState.name.trim()
    const email = formState.email.trim().toLowerCase()
    const password = formState.password
    const role = formState.role
    const isEditing = Boolean(editingUserId)

    if (!name) { setFormError('Informe o nome do usuário.'); return }
    if (!email) { setFormError('Informe o e-mail do usuário.'); return }
    if (!isEditing && password.length < 8) { setFormError('A senha deve ter pelo menos 8 caracteres.'); return }
    if (isEditing && password && password.length < 8) { setFormError('Se informar nova senha, use ao menos 8 caracteres.'); return }
    if (role !== 'admin' && role !== 'staff') { setFormError('Perfil de usuário inválido.'); return }

    setIsSaving(true); setActionError(''); setActionSuccess('')
    try {
      if (isEditing) {
        const updated = await updateUser(editingUserId, { name, email, password, role })
        setUsers((current) => current.map((item) => (item.id === editingUserId ? updated : item)))
      } else {
        const created = await createUser({ name, email, password, role })
        setUsers((current) => [...current, created])
      }
      closeModal()
    } catch (error) {
      if (getErrorCode(error) === 'UNAUTHORIZED') { navigate('/login', { replace: true }); return }
      if (getErrorCode(error) === 'FORBIDDEN') { navigate('/appointments', { replace: true }); return }
      if (getErrorCode(error) === 'EMAIL_CONFLICT') { setFormError('Já existe uma conta com esse e-mail.'); return }
      if (getErrorCode(error) === 'LAST_ADMIN_REQUIRED') { setFormError('Deve existir ao menos um administrador ativo.'); return }
      setFormError(getErrorMessage(error, isEditing ? 'Não foi possível atualizar o usuário.' : 'Não foi possível criar o usuário.'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AppShell active="users">
      <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Usuários</h2>
          <p className="mt-1 text-base text-slate-500">Gerencie contas da equipe e perfis de acesso.</p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-bold text-white shadow-lg shadow-primary/25 transition-colors hover:bg-primary/90"
        >
          <span className="material-symbols-outlined text-lg">person_add</span>
          <span>Novo usuário</span>
        </button>
      </div>

      {actionError ? <p className="mb-4 text-sm font-medium text-red-600">{actionError}</p> : null}
      {actionSuccess ? <p className="mb-4 text-sm font-medium text-emerald-700">{actionSuccess}</p> : null}

      <div className="mb-6 grid grid-cols-1 gap-3 md:max-w-[560px] md:grid-cols-2">
        <select
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary"
        >
          <option value="all">Todos os perfis</option>
          <option value="admin">Somente administradores</option>
          <option value="staff">Somente equipe</option>
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary"
        >
          <option value="all">Todos os status</option>
          <option value="active">Somente ativos</option>
          <option value="inactive">Somente inativos</option>
        </select>
      </div>

      <UserTable
        isLoading={isLoading}
        loadError={loadError}
        filteredUsers={filteredUsers}
        totalCount={orderedUsers.length}
        countLabel={filteredCountLabel}
        currentUserId={currentUserId}
        activeUserId={activeUserId}
        onEdit={openEditModal}
        onToggleStatus={(id, active) => void handleToggleStatus(id, active)}
        onDelete={(id) => void handleDeleteUser(id)}
        onResetPassword={openResetPasswordModal}
      />

      <UserFormModal
        isOpen={modalOpen}
        isEditing={Boolean(editingUserId)}
        editingUser={editingUser}
        formState={formState}
        onFieldChange={handleFieldChange}
        formError={formError}
        isSaving={isSaving}
        onSubmit={handleSubmit}
        onClose={closeModal}
      />

      <ResetPasswordModal
        isOpen={resetModalOpen}
        targetUser={resetTargetUser}
        mode={resetMode}
        setMode={setResetMode}
        passwordValue={resetPasswordValue}
        setPasswordValue={setResetPasswordValue}
        error={resetError}
        isResetting={isResetting}
        onSubmit={handleResetPasswordSubmit}
        onClose={closeResetModal}
      />
    </AppShell>
  )
}
