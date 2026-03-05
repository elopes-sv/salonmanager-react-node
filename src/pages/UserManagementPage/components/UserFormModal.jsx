export function UserFormModal({
    isOpen,
    isEditing,
    editingUser,
    formState,
    onFieldChange,
    formError,
    isSaving,
    onSubmit,
    onClose,
}) {
    if (!isOpen) {
        return null
    }

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
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
                        onClick={onClose}
                        className="rounded-lg p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <form className="space-y-4" onSubmit={onSubmit}>
                    <label className="block space-y-1">
                        <span className="text-sm font-semibold text-slate-700">Nome</span>
                        <input
                            type="text"
                            value={formState.name}
                            onChange={(event) => onFieldChange('name', event.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary"
                            placeholder="Nome completo"
                        />
                    </label>

                    <label className="block space-y-1">
                        <span className="text-sm font-semibold text-slate-700">E-mail</span>
                        <input
                            type="email"
                            value={formState.email}
                            onChange={(event) => onFieldChange('email', event.target.value)}
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
                            onChange={(event) => onFieldChange('password', event.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary"
                            placeholder={editingUser ? 'Deixe em branco para manter' : 'Mínimo 8 caracteres'}
                        />
                    </label>

                    <label className="block space-y-1">
                        <span className="text-sm font-semibold text-slate-700">Perfil</span>
                        <select
                            value={formState.role}
                            onChange={(event) => onFieldChange('role', event.target.value)}
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
                            onClick={onClose}
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
    )
}
