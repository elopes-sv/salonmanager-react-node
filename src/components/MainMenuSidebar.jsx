import { Link } from 'react-router-dom'
import { hasAdminRole } from '../api/auth'

const baseMenuItems = [
  { key: 'appointments', label: 'Agendamentos', icon: 'calendar_month', to: '/appointments' },
  { key: 'services', label: 'Serviços', icon: 'inventory_2', to: '/services' },
  { key: 'settings', label: 'Configurações', icon: 'settings', to: '/settings/user' },
]

export function MainMenuSidebar({ active, mobileOpen = false, onClose, onNavigate }) {
  const isAdmin = hasAdminRole()
  const menuItems = isAdmin
    ? [
        ...baseMenuItems,
        { key: 'users', label: 'Usuários', icon: 'group', to: '/users' },
      ]
    : baseMenuItems

  return (
    <aside
      id="main-menu-sidebar"
      className={`fixed inset-y-0 left-0 z-[60] flex w-72 shrink-0 flex-col border-r border-slate-200 bg-white p-4 shadow-xl transition-transform duration-200 lg:static lg:z-auto lg:w-64 lg:translate-x-0 lg:shadow-none ${
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between px-3">
          <h1 className="text-base font-bold text-slate-900">Dashboard</h1>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 lg:hidden"
            aria-label="Fechar menu lateral"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <nav className="flex flex-col gap-1">
          {menuItems.map((item) => {
            const isActive = active === item.key

            return (
              <Link
                key={item.key}
                to={item.to}
                onClick={onNavigate}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span
                  className={`material-symbols-outlined ${
                    isActive ? 'text-primary' : 'text-slate-500 group-hover:text-primary'
                  }`}
                >
                  {item.icon}
                </span>
                <span className={`text-sm ${isActive ? 'font-semibold' : 'font-medium'}`}>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
