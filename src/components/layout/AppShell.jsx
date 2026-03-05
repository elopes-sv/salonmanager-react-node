import { useEffect, useState } from 'react'
import { AppHeader } from './AppHeader'
import { MainMenuSidebar } from './MainMenuSidebar'

export function AppShell({ active, children }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  useEffect(() => {
    if (!mobileSidebarOpen) {
      return undefined
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setMobileSidebarOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [mobileSidebarOpen])

  return (
    <div className="relative flex min-h-screen w-full overflow-x-hidden bg-background-light font-display text-slate-900 antialiased">
      <MainMenuSidebar
        active={active}
        mobileOpen={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
        onNavigate={() => setMobileSidebarOpen(false)}
      />

      <button
        type="button"
        aria-label="Fechar menu lateral"
        onClick={() => setMobileSidebarOpen(false)}
        className={`fixed inset-0 z-[55] bg-slate-900/35 transition-opacity duration-200 lg:hidden ${mobileSidebarOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
          }`}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AppHeader
          onToggleSidebar={() => setMobileSidebarOpen((value) => !value)}
          isMobileSidebarOpen={mobileSidebarOpen}
        />

        <main className="flex flex-1 overflow-hidden">
          <div className="flex flex-1 overflow-y-auto">
            <div className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col px-6 py-8">{children}</div>
          </div>
        </main>
      </div>
    </div>
  )
}
