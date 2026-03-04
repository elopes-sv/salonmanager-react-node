import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getCachedCurrentUser, logoutUser } from '../api/auth'

function getUserInitials(user) {
  const source = typeof user?.name === 'string' && user.name.trim() ? user.name.trim() : user?.email || 'U'
  const parts = source.split(/\s+/).filter(Boolean)

  if (parts.length === 0) {
    return 'U'
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase()
  }

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
}

export function AppHeader({ onToggleSidebar, isMobileSidebarOpen = false }) {
  const navigate = useNavigate()
  const menuRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const user = getCachedCurrentUser()
  const userName = user?.name || 'Usuário'
  const userEmail = user?.email || ''
  const userInitials = getUserInitials(user)

  useEffect(() => {
    if (!menuOpen) {
      return
    }

    function handleOutsideClick(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [menuOpen])

  async function handleLogout() {
    await logoutUser()
    setMenuOpen(false)
    navigate('/login', { replace: true })
  }

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white">
      <div className="flex w-full items-center justify-between px-6 py-3">
        <div className="flex items-center gap-3 text-primary">
          <button
            type="button"
            onClick={onToggleSidebar}
            className="flex size-9 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100 lg:hidden"
            aria-label={isMobileSidebarOpen ? 'Fechar menu lateral' : 'Abrir menu lateral'}
            aria-expanded={isMobileSidebarOpen}
            aria-controls="main-menu-sidebar"
          >
            <span className="material-symbols-outlined text-xl">{isMobileSidebarOpen ? 'close' : 'menu'}</span>
          </button>

          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
            <span className="material-symbols-outlined text-primary">content_cut</span>
          </div>
          <h2 className="text-lg font-bold leading-tight tracking-[-0.015em] text-slate-900">SalonManager</h2>
        </div>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((value) => !value)}
            className="flex size-10 items-center justify-center rounded-full border border-slate-200 bg-primary/15 text-sm font-bold text-primary transition-colors hover:bg-primary/25"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Abrir menu do usuário"
          >
            {userInitials}
          </button>

          {menuOpen ? (
            <div className="absolute right-0 top-12 z-[60] w-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
              <div className="border-b border-slate-100 px-4 py-3">
                <p className="truncate text-sm font-semibold text-slate-900">{userName}</p>
                {userEmail ? <p className="truncate text-xs text-slate-500">{userEmail}</p> : null}
              </div>

              <div className="p-2">
                <Link
                  to="/settings/user"
                  onClick={() => setMenuOpen(false)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                >
                  <span className="material-symbols-outlined text-lg">person</span>
                  Meu perfil
                </Link>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50"
                >
                  <span className="material-symbols-outlined text-lg">logout</span>
                  Sair
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
