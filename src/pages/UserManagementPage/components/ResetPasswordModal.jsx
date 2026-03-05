export function ResetPasswordModal({
    isOpen,
    targetUser,
    mode,
    setMode,
    passwordValue,
    setPasswordValue,
    error,
    isResetting,
    onSubmit,
    onClose,
}) {
    if (!isOpen) {
        return null
    }

    return (
        <div className="fixed inset-0 z-[85] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
            <div className="relative z-10 w-full max-w-[520px] rounded-xl border border-slate-200 bg-white p-6 shadow-2xl">
                <div className="mb-6 flex items-start justify-between gap-4">
                    <div>
                        <h3 className="text-xl font-bold text-slate-900">Redefinir senha</h3>
                        <p className="mt-1 text-sm text-slate-500">
                            {targetUser ? `Usuário: ${targetUser.name}` : 'Defina a forma de redefinição.'}
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
                    <label className="flex items-center gap-3">
                        <input
                            type="radio"
                            checked={mode === 'generated'}
                            onChange={() => setMode('generated')}
                        />
                        <span className="text-sm text-slate-700">Gerar senha temporária automaticamente</span>
                    </label>

                    <label className="flex items-center gap-3">
                        <input
                            type="radio"
                            checked={mode === 'manual'}
                            onChange={() => setMode('manual')}
                        />
                        <span className="text-sm text-slate-700">Definir senha manual</span>
                    </label>

                    {mode === 'manual' ? (
                        <label className="block space-y-1">
                            <span className="text-sm font-semibold text-slate-700">Nova senha</span>
                            <input
                                type="password"
                                value={passwordValue}
                                onChange={(event) => setPasswordValue(event.target.value)}
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary"
                                placeholder="Mínimo 8 caracteres"
                            />
                        </label>
                    ) : null}

                    {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

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
                            disabled={isResetting}
                            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {isResetting ? 'Salvando...' : 'Redefinir senha'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
