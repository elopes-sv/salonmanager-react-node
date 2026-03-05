export function UserTable({
    isLoading,
    loadError,
    filteredUsers,
    totalCount,
    countLabel,
    currentUserId,
    activeUserId,
    onEdit,
    onToggleStatus,
    onDelete,
    onResetPassword,
}) {
    return (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
            <header className="border-b border-slate-100 px-6 py-4">
                <p className="text-sm font-semibold text-slate-700">{countLabel}</p>
            </header>

            {isLoading ? (
                <p className="px-6 py-6 text-sm text-slate-500">Carregando usuários...</p>
            ) : loadError ? (
                <p className="px-6 py-6 text-sm font-medium text-red-600">{loadError}</p>
            ) : filteredUsers.length === 0 ? (
                <p className="px-6 py-6 text-sm text-slate-500">
                    {totalCount === 0 ? 'Nenhum usuário cadastrado.' : 'Nenhum usuário para os filtros selecionados.'}
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
                                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${user.role === 'admin'
                                                ? 'bg-primary/10 text-primary'
                                                : 'bg-slate-100 text-slate-600'
                                            }`}
                                    >
                                        {user.role === 'admin' ? 'Administrador' : 'Equipe'}
                                    </span>
                                    <span
                                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${user.isActive
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-slate-100 text-slate-500'
                                            }`}
                                    >
                                        {user.isActive ? 'Ativo' : 'Inativo'}
                                    </span>
                                    <button
                                        type="button"
                                        disabled={isRowBusy}
                                        onClick={() => onEdit(user.id)}
                                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                                    >
                                        Editar
                                    </button>
                                    <button
                                        type="button"
                                        disabled={isRowBusy}
                                        onClick={() => onToggleStatus(user.id, !user.isActive)}
                                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
                                    >
                                        {user.isActive ? 'Inativar' : 'Ativar'}
                                    </button>
                                    <button
                                        type="button"
                                        disabled={isRowBusy || isCurrentUser}
                                        title={isCurrentUser ? 'Não é possível excluir o próprio usuário logado.' : undefined}
                                        onClick={() => onDelete(user.id)}
                                        className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-70"
                                    >
                                        Excluir
                                    </button>
                                    <button
                                        type="button"
                                        disabled={isRowBusy}
                                        onClick={() => onResetPassword(user.id)}
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
    )
}
