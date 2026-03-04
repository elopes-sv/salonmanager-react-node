import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AppShell } from '../../components/AppShell'
import { changeCurrentPassword, clearAuthSessionHint, getCurrentUser, logoutUser } from '../../api/auth'
import './UserSettingsPage.css'

function getErrorCode(error) {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code
  }

  return ''
}

export function UserSettingsPage() {
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState('profile')
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
  })
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [profileMessage, setProfileMessage] = useState('')

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [securityError, setSecurityError] = useState('')
  const [securitySuccess, setSecuritySuccess] = useState('')
  const [isSecuritySubmitting, setIsSecuritySubmitting] = useState(false)

  useEffect(() => {
    async function loadUser() {
      setIsLoading(true)
      setLoadError('')
      try {
        const user = await getCurrentUser()
        setProfile((current) => ({
          ...current,
          name: user.name,
          email: user.email,
        }))
      } catch (error) {
        if (getErrorCode(error) === 'UNAUTHORIZED') {
          clearAuthSessionHint()
          navigate('/login', { replace: true })
          return
        }

        if (error instanceof Error && error.message) {
          setLoadError(error.message)
        } else {
          setLoadError('Não foi possível carregar seus dados.')
        }
      } finally {
        setIsLoading(false)
      }
    }

    void loadUser()
  }, [navigate])

  function handleFieldChange(field, value) {
    setProfile((current) => ({
      ...current,
      [field]: value,
    }))
  }

  function handleProfileSubmit(event) {
    event.preventDefault()
    setProfileMessage('A atualização de perfil será conectada no próximo passo do backend.')
  }

  async function handleSecuritySubmit(event) {
    event.preventDefault()
    setSecurityError('')
    setSecuritySuccess('')

    if (!currentPassword) {
      setSecurityError('Informe a senha atual.')
      return
    }

    if (!newPassword) {
      setSecurityError('Informe a nova senha.')
      return
    }

    if (newPassword.length < 8) {
      setSecurityError('A nova senha deve ter no mínimo 8 caracteres.')
      return
    }

    if (newPassword !== confirmPassword) {
      setSecurityError('A confirmação da senha não confere.')
      return
    }

    setIsSecuritySubmitting(true)
    try {
      await changeCurrentPassword({
        currentPassword,
        newPassword,
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setShowCurrentPassword(false)
      setShowNewPassword(false)
      setShowConfirmPassword(false)
      setSecuritySuccess('Senha atualizada com sucesso.')
    } catch (error) {
      if (getErrorCode(error) === 'UNAUTHORIZED') {
        clearAuthSessionHint()
        navigate('/login', { replace: true })
        return
      }

      if (error instanceof Error && error.message) {
        setSecurityError(error.message)
      } else {
        setSecurityError('Não foi possível atualizar a senha.')
      }
    } finally {
      setIsSecuritySubmitting(false)
    }
  }

  async function handleLogout() {
    await logoutUser()
    navigate('/login', { replace: true })
  }

  const profileSectionClasses =
    activeSection === 'profile'
      ? 'flex items-center gap-3 rounded-lg bg-primary/10 px-3 py-2.5 text-left text-primary'
      : 'flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-slate-600 transition-colors hover:bg-slate-100'

  const securitySectionClasses =
    activeSection === 'security'
      ? 'flex items-center gap-3 rounded-lg bg-primary/10 px-3 py-2.5 text-left text-primary'
      : 'flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-slate-600 transition-colors hover:bg-slate-100'

  return (
    <AppShell active="settings">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Configuração do Usuário</h1>
        <p className="mt-1 text-sm text-slate-500">Atualize seus dados de perfil e segurança.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-xl border border-slate-200 bg-white p-4">
          <nav className="flex flex-col gap-1">
            <button type="button" onClick={() => setActiveSection('profile')} className={profileSectionClasses}>
              <span className="material-symbols-outlined">person</span>
              <span className="text-sm font-semibold">Perfil</span>
            </button>
            <button type="button" onClick={() => setActiveSection('security')} className={securitySectionClasses}>
              <span className="material-symbols-outlined">lock</span>
              <span className="text-sm font-medium">Segurança</span>
            </button>
          </nav>
        </aside>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          {isLoading ? <p className="text-sm text-slate-500">Carregando dados do usuário...</p> : null}
          {loadError ? <p className="mb-4 text-sm font-medium text-red-600">{loadError}</p> : null}

          {!isLoading && !loadError && activeSection === 'profile' ? (
            <form className="space-y-6" onSubmit={handleProfileSubmit}>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700" htmlFor="full-name">
                    Nome completo
                  </label>
                  <input
                    id="full-name"
                    type="text"
                    value={profile.name}
                    onChange={(event) => handleFieldChange('name', event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700" htmlFor="phone">
                    Telefone
                  </label>
                  <input
                    id="phone"
                    type="text"
                    value={profile.phone}
                    onChange={(event) => handleFieldChange('phone', event.target.value)}
                    placeholder="(11) 99999-0000"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700" htmlFor="email">
                  E-mail
                </label>
                <input
                  id="email"
                  type="email"
                  value={profile.email}
                  onChange={(event) => handleFieldChange('email', event.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary"
                />
              </div>

              {profileMessage ? <p className="text-sm font-medium text-primary">{profileMessage}</p> : null}

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <Link
                  to="/appointments"
                  className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                >
                  Cancelar
                </Link>
                <button className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/20 transition-all hover:bg-primary/90">
                  Salvar alterações
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                >
                  Sair
                </button>
              </div>
            </form>
          ) : null}

          {!isLoading && !loadError && activeSection === 'security' ? (
            <form className="space-y-5" onSubmit={handleSecuritySubmit}>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700">Senha atual</span>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-slate-900 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary"
                    placeholder="Digite a senha atual"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                    aria-label={showCurrentPassword ? 'Ocultar senha atual' : 'Mostrar senha atual'}
                  >
                    <span className="material-symbols-outlined text-xl">
                      {showCurrentPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700">Nova senha</span>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-slate-900 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary"
                    placeholder="Mínimo de 8 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                    aria-label={showNewPassword ? 'Ocultar nova senha' : 'Mostrar nova senha'}
                  >
                    <span className="material-symbols-outlined text-xl">
                      {showNewPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700">Confirmar nova senha</span>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-slate-900 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary"
                    placeholder="Repita a nova senha"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((value) => !value)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                    aria-label={showConfirmPassword ? 'Ocultar confirmação da nova senha' : 'Mostrar confirmação da nova senha'}
                  >
                    <span className="material-symbols-outlined text-xl">
                      {showConfirmPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </label>

              {securityError ? <p className="text-sm font-medium text-red-600">{securityError}</p> : null}
              {securitySuccess ? <p className="text-sm font-medium text-emerald-700">{securitySuccess}</p> : null}

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                >
                  Sair
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/20 transition-all hover:bg-primary/90"
                  disabled={isSecuritySubmitting}
                >
                  {isSecuritySubmitting ? 'Salvando...' : 'Atualizar senha'}
                </button>
              </div>
            </form>
          ) : null}
        </section>
      </div>
    </AppShell>
  )
}
