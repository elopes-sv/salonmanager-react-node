import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { loginUser } from '../../api/auth'
import './LoginPage.css'

export function LoginPage() {
  const navigate = useNavigate()
  const currentYear = new Date().getFullYear()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')

    const normalizedEmail = email.trim()
    if (!normalizedEmail) {
      setFormError('Informe seu e-mail.')
      return
    }

    if (!password) {
      setFormError('Informe sua senha.')
      return
    }

    setIsSubmitting(true)
    try {
      const user = await loginUser({
        email: normalizedEmail,
        password,
      })
      navigate(user.mustChangePassword ? '/change-password' : '/appointments', { replace: true })
    } catch (error) {
      if (error instanceof Error && error.message) {
        setFormError(error.message)
      } else {
        setFormError('Não foi possível entrar. Tente novamente.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background-light font-display text-slate-900">
      <main className="flex flex-1 items-center justify-center bg-gradient-to-br from-primary/5 to-transparent p-6">
        <div className="w-full max-w-[480px] rounded-xl border border-slate-200 bg-white p-8 shadow-xl md:p-12">
          <div className="mb-10 flex flex-col items-center text-center">
            <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
              <span className="material-symbols-outlined text-4xl text-primary">lock_open</span>
            </div>
            <h1 className="mb-2 text-3xl font-bold leading-tight text-slate-900">Bem-vinda de volta</h1>
            <p className="text-base font-normal text-slate-500">
              Gerencie os agendamentos e ganhos do seu salão com praticidade
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-semibold text-slate-700">E-mail</span>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-xl text-slate-400">
                    mail
                  </span>
                  <input
                    className="w-full rounded-lg border border-slate-200 bg-white py-3.5 pl-10 pr-4 text-slate-900 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                    placeholder="name@salon-name.com"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
              </label>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">Senha</span>
              </div>

              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-xl text-slate-400">
                  lock
                </span>
                <input
                  className="w-full rounded-lg border border-slate-200 bg-white py-3.5 pl-10 pr-12 text-slate-900 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="Digite sua senha"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  <span className="material-symbols-outlined text-xl">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="remember"
                className="h-4 w-4 cursor-pointer rounded border-slate-300 text-primary focus:ring-primary"
                type="checkbox"
              />
              <label htmlFor="remember" className="cursor-pointer select-none text-sm text-slate-600">
                Manter conectado
              </label>
            </div>

            <button
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-4 font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90"
              type="submit"
              disabled={isSubmitting}
            >
              <span>{isSubmitting ? 'Entrando...' : 'Entrar no painel'}</span>
              <span className="material-symbols-outlined text-lg">arrow_forward</span>
            </button>

            {formError ? <p className="text-sm font-medium text-red-600">{formError}</p> : null}
          </form>
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-slate-500">
        <p>© {currentYear} SalonPro Manager. Todos os direitos reservados.</p>
        <div className="mt-2 flex justify-center gap-4">
          <Link className="hover:text-primary" to="/login">
            Política de Privacidade
          </Link>
          <Link className="hover:text-primary" to="/login">
            Termos de Uso
          </Link>
        </div>
      </footer>
    </div>
  )
}
