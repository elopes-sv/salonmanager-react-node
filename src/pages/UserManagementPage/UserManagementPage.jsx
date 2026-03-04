import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCachedCurrentUser } from '../../api/auth'
import { createUser, listUsers, resetUserPassword, updateUser, updateUserStatus } from '../../api/users'
import { AppShell } from '../../components/AppShell'
import './UserManagementPage.css'

function getErrorCode(error) {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code
  }

  return ''
}

function getErrorMessage(error, fallbackMessage = 'Ocorreu um erro inesperado.') {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallbackMessage
}

function makeFormState(user = null) {
  if (user) {
    return {
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
    }
  }

  return {
    name: '',
    email: '',
    password: '',
    role: 'staff',
  }
}

export function UserManagementPage() {
  const navigate = useNavigate()
  const currentUser = getCachedCurrentUser()
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

  const orderedUsers = useMemo(() => {
    return [...users].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))
  }, [users])

  const filteredUsers = useMemo(() => {
    return orderedUsers.filter((user) => {
      const matchesRole = roleFilter === 'all' || user.role === roleFilter
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && user.isActive) ||
        (statusFilter === 'inactive' && !user.isActive)

      return matchesRole && matchesStatus
    })
  }, [orderedUsers, roleFilter, statusFilter])

  const userCountLabel = `${orderedUsers.length} ${orderedUsers.length === 1 ? 'usuário' : 'usuários'}`
  const filteredCountLabel =
    filteredUsers.length === orderedUsers.length
      ? userCountLabel
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
      if (getErrorCode(error) === 'UNAUTHORIZED') {
        navigate('/login', { replace: true })
        return
      }

      if (getErrorCode(error) === 'FORBIDDEN') {
        navigate('/appointments', { replace: true })
        return
      }

      setLoadError(getErrorMessage(error, 'Não foi possível carregar os usuários.'))
    } finally {
      setIsLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    void loadAllUsers()
  }, [loadAllUsers])

  function handleFieldChange(field, value) {
    setFormState((current) => ({ ...current, [field]: value }))
  }

  function closeModal() {
    setModalOpen(false)
    setEditingUserId('')
    setFormState(makeFormState())
    setFormError('')
    setIsSaving(false)
  }

  function closeResetModal() {
    setResetModalOpen(false)
    setResetTargetUserId('')
    setResetMode('generated')
    setResetPasswordValue('')
    setResetError('')
    setIsResetting(false)
  }

  function openCreateModal() {
    setActionError('')
    setActionSuccess('')
    setFormError('')
    setEditingUserId('')
    setFormState(makeFormState())
    setModalOpen(true)
  }

  function openEditModal(userId) {
    const user = users.find((item) => item.id === userId)
    if (!user) {
      return
    }

    setActionError('')
    setActionSuccess('')
    setFormError('')
    setEditingUserId(userId)
    setFormState(makeFormState(user))
    setModalOpen(true)
  }

  async function handleToggleStatus(userId, nextActive) {
    const targetUser = users.find((item) => item.id === userId)
    if (!targetUser) {
      return
    }

    const confirmed = window.confirm(
      `${nextActive ? 'Ativar' : 'Inativar'} o usuário "${targetUser.name}"?`,
    )
    if (!confirmed) {
      return
    }

    setActionError('')
    setActionSuccess('')
    setActiveUserId(userId)

    try {
      const updated = await updateUserStatus(userId, nextActive)
      setUsers((current) => current.map((item) => (item.id === userId ? updated : item)))
      setActionSuccess(`Usuário ${nextActive ? 'ativado' : 'inativado'} com sucesso.`)
    } catch (error) {
      if (getErrorCode(error) === 'UNAUTHORIZED') {
        navigate('/login', { replace: true })
        return
      }

      if (getErrorCode(error) === 'FORBIDDEN') {
        navigate('/appointments', { replace: true })
        return
      }

      if (getErrorCode(error) === 'LAST_ADMIN_REQUIRED') {
        setActionError('Deve existir ao menos um administrador ativo.')
        return
      }

      if (getErrorCode(error) === 'SELF_DEACTIVATION_NOT_ALLOWED') {
        setActionError('Não é possível inativar o próprio usuário logado.')
        return
      }

      setActionError(getErrorMessage(error, 'Não foi possível atualizar o status do usuário.'))
    } finally {
      setActiveUserId('')
    }
  }

  function openResetPasswordModal(userId) {
    const user = users.find((item) => item.id === userId)
    if (!user) {
      return
    }

    setActionError('')
    setActionSuccess('')
    setResetTargetUserId(userId)
    setResetMode('generated')
    setResetPasswordValue('')
    setResetError('')
    setResetModalOpen(true)
  }

  async function handleResetPasswordSubmit(event) {
    event.preventDefault()
    setResetError('')

    if (!resetTargetUserId) {
      setResetError('Usuário inválido para redefinição de senha.')
      return
    }

    const manualPassword = resetPasswordValue
    const shouldUseManualPassword = resetMode === 'manual'

    if (shouldUseManualPassword && manualPassword.length < 8) {
      setResetError('Informe uma senha com pelo menos 8 caracteres.')
      return
    }

    setIsResetting(true)
    try {
      const result = await resetUserPassword(resetTargetUserId, shouldUseManualPassword ? manualPassword : '')
      setUsers((current) => current.map((item) => (item.id === result.user.id ? result.user : item)))

      if (result.temporaryPassword) {
        window.alert(`Senha temporária gerada para "${result.user.name}": ${result.temporaryPassword}`)
      }

      setActionSuccess('Senha redefinida com sucesso.')
      closeResetModal()
    } catch (error) {
      if (getErrorCode(error) === 'UNAUTHORIZED') {
        navigate('/login', { replace: true })
        return
      }

      if (getErrorCode(error) === 'FORBIDDEN') {
        navigate('/appointments', { replace: true })
        return
      }

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

    if (!name) {
      setFormError('Informe o nome do usuário.')
      return
    }

    if (!email) {
      setFormError('Informe o e-mail do usuário.')
      return
    }

    if (!isEditing && password.length < 8) {
      setFormError('A senha deve ter pelo menos 8 caracteres.')
      return
    }

    if (isEditing && password && password.length < 8) {
      setFormError('Se informar nova senha, use ao menos 8 caracteres.')
      return
    }

    if (role !== 'admin' && role !== 'staff') {
      setFormError('Perfil de usuário inválido.')
      return
    }

    setIsSaving(true)
    setActionError('')
    setActionSuccess('')

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
      if (getErrorCode(error) === 'UNAUTHORIZED') {
        navigate('/login', { replace: true })
        return
      }

      if (getErrorCode(error) === 'FORBIDDEN') {
        navigate('/appointments', { replace: true })
        return
      }

      if (getErrorCode(error) === 'EMAIL_CONFLICT') {
        setFormError('Já existe uma conta com esse e-mail.')
        return
      }

      if (getErrorCode(error) === 'LAST_ADMIN_REQUIRED') {
        setFormError('Deve existir ao menos um administrador ativo.')
        return
      }

      setFormError(
        getErrorMessage(
          error,
          isEditing ? 'Não foi possível atualizar o usuário.' : 'Não foi possível criar o usuário.',
        ),
      )
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

            <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <header className="border-b border-slate-100 px-6 py-4">
                <p className="text-sm font-semibold text-slate-700">{filteredCountLabel}</p>
              </header>

              {isLoading ? (
                <p className="px-6 py-6 text-sm text-slate-500">Carregando usuários...</p>
              ) : loadError ? (
                <p className="px-6 py-6 text-sm font-medium text-red-600">{loadError}</p>
              ) : filteredUsers.length === 0 ? (
                <p className="px-6 py-6 text-sm text-slate-500">
                  {orderedUsers.length === 0 ? 'Nenhum usuário cadastrado.' : 'Nenhum usuário para os filtros selecionados.'}
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {filteredUsers.map((user) => {
                    const isRowBusy = activeUserId === user.id
                    const isCurrentUser = user.id === currentUserId

                    return (
                      <li key={user.id} className="flex items-center justify-between gap-4 px-6 py-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {user.name}
                            {isCurrentUser ? ' (você)' : ''}
                          </p>
                          <p className="truncate text-sm text-slate-500">{user.email}</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                              user.role === 'admin'
                                ? 'bg-primary/10 text-primary'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {user.role === 'admin' ? 'Administrador' : 'Equipe'}
                          </span>
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                              user.isActive
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {user.isActive ? 'Ativo' : 'Inativo'}
                          </span>
                          <button
                            type="button"
                            disabled={isRowBusy}
                            onClick={() => openEditModal(user.id)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            disabled={isRowBusy}
                            onClick={() => void handleToggleStatus(user.id, !user.isActive)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            {user.isActive ? 'Inativar' : 'Ativar'}
                          </button>
                          <button
                            type="button"
                            disabled={isRowBusy}
                            onClick={() => openResetPasswordModal(user.id)}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                          >
                            Reset senha
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

      {modalOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={closeModal} />
          <div className="relative z-10 w-full max-w-[520px] rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{editingUser ? 'Editar usuário' : 'Criar usuário'}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {editingUser
                    ? 'Atualize os dados de acesso da conta.'
                    : 'Defina os dados de acesso da nova conta.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="block space-y-1">
                <span className="text-sm font-semibold text-slate-700">Nome</span>
                <input
                  type="text"
                  value={formState.name}
                  onChange={(event) => handleFieldChange('name', event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary"
                  placeholder="Nome completo"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-semibold text-slate-700">E-mail</span>
                <input
                  type="email"
                  value={formState.email}
                  onChange={(event) => handleFieldChange('email', event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary"
                  placeholder="usuario@salon.com"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-semibold text-slate-700">
                  {editingUser ? 'Nova senha (opcional)' : 'Senha inicial'}
                </span>
                <input
                  type="password"
                  value={formState.password}
                  onChange={(event) => handleFieldChange('password', event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary"
                  placeholder={editingUser ? 'Deixe em branco para manter' : 'Mínimo 8 caracteres'}
                />
              </label>

              <label className="block space-y-1">
                <span className="text-sm font-semibold text-slate-700">Perfil</span>
                <select
                  value={formState.role}
                  onChange={(event) => handleFieldChange('role', event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary"
                >
                  <option value="staff">Equipe</option>
                  <option value="admin">Administrador</option>
                </select>
              </label>

              {formError ? <p className="text-sm font-medium text-red-600">{formError}</p> : null}

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSaving ? 'Salvando...' : editingUser ? 'Salvar alterações' : 'Criar usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {resetModalOpen ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40" onClick={closeResetModal} />
          <div className="relative z-10 w-full max-w-[520px] rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Redefinir senha</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {resetTargetUser ? `Usuário: ${resetTargetUser.name}` : 'Defina a forma de redefinição.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeResetModal}
                className="rounded-lg p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form className="space-y-4" onSubmit={handleResetPasswordSubmit}>
              <label className="flex items-center gap-3">
                <input
                  type="radio"
                  checked={resetMode === 'generated'}
                  onChange={() => setResetMode('generated')}
                />
                <span className="text-sm text-slate-700">Gerar senha temporária automaticamente</span>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="radio"
                  checked={resetMode === 'manual'}
                  onChange={() => setResetMode('manual')}
                />
                <span className="text-sm text-slate-700">Definir senha manual</span>
              </label>

              {resetMode === 'manual' ? (
                <label className="block space-y-1">
                  <span className="text-sm font-semibold text-slate-700">Nova senha</span>
                  <input
                    type="password"
                    value={resetPasswordValue}
                    onChange={(event) => setResetPasswordValue(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary"
                    placeholder="Mínimo 8 caracteres"
                  />
                </label>
              ) : null}

              {resetError ? <p className="text-sm font-medium text-red-600">{resetError}</p> : null}

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={closeResetModal}
                  className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isResetting ? 'Salvando...' : 'Redefinir senha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </AppShell>
  )
}
