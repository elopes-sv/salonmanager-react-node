import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { changeCurrentPassword } from '../../api/auth'
import './RequiredPasswordChangePage.css'

export function RequiredPasswordChangePage() {
  const navigate = useNavigate()
  const { logout, updateUser } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')

    if (!currentPassword) {
      setFormError('Informe a senha atual.')
      return
    }

    if (!newPassword) {
      setFormError('Informe a nova senha.')
      return
    }

    if (newPassword.length < 8) {
      setFormError('A nova senha deve ter no mínimo 8 caracteres.')
      return
    }

    if (newPassword !== confirmPassword) {
      setFormError('A confirmação da senha não confere.')
      return
    }

    setIsSubmitting(true)
    try {
      const updatedUser = await changeCurrentPassword({
        currentPassword,
        newPassword,
      })
      updateUser(updatedUser)
      navigate('/appointments', { replace: true })
    } catch (error) {
      if (error instanceof Error && error.message) {
        setFormError(error.message)
      } else {
        setFormError('Não foi possível atualizar a senha.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="required-password-change-page flex min-h-screen items-center justify-center bg-background-light p-6 font-display text-slate-900">
      <div className="w-full max-w-[520px] rounded-xl border border-slate-200 bg-white p-8 shadow-xl md:p-10">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Troca de senha obrigatória</h1>
          <p className="mt-2 text-sm text-slate-500">
            Por segurança, atualize sua senha antes de acessar o sistema.
          </p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
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

          {formError ? <p className="text-sm font-medium text-red-600">{formError}</p> : null}

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
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Salvando...' : 'Atualizar senha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
