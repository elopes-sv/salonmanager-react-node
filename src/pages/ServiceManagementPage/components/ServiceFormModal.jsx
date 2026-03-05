export function ServiceFormModal({
    isOpen,
    isEditing,
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
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl">
                <div className="flex items-center justify-between px-8 pb-4 pt-8">
                    <h2 className="text-2xl font-bold text-slate-900">{isEditing ? 'Editar Serviço' : 'Novo Serviço'}</h2>
                    <button type="button" className="text-slate-400 transition-colors hover:text-slate-600" onClick={onClose}>
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <form className="space-y-6 px-8 py-4" onSubmit={onSubmit}>
                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-slate-700" htmlFor="service-name">
                            Nome do serviço
                        </label>
                        <input
                            id="service-name"
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary"
                            placeholder="Ex.: Balayage Assinatura + Matização"
                            type="text"
                            disabled={isSaving}
                            value={formState.name}
                            onChange={(event) => onFieldChange('name', event.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-slate-700" htmlFor="service-duration">
                                Duração (min)
                            </label>
                            <input
                                id="service-duration"
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary"
                                placeholder="45"
                                type="number"
                                min="1"
                                disabled={isSaving}
                                value={formState.durationMinutes}
                                onChange={(event) => onFieldChange('durationMinutes', event.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="block text-sm font-semibold text-slate-700" htmlFor="service-price">
                                Preço base (R$)
                            </label>
                            <input
                                id="service-price"
                                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary"
                                placeholder="0,00"
                                type="text"
                                inputMode="decimal"
                                disabled={isSaving}
                                value={formState.price}
                                onChange={(event) => onFieldChange('price', event.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-sm font-semibold text-slate-700" htmlFor="service-description">
                            Descrição (opcional)
                        </label>
                        <textarea
                            id="service-description"
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-primary"
                            placeholder="Descreva brevemente o que está incluso neste serviço..."
                            rows={3}
                            disabled={isSaving}
                            value={formState.description}
                            onChange={(event) => onFieldChange('description', event.target.value)}
                        />
                    </div>

                    <div className="flex items-center justify-between rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold text-slate-900">Serviço ativo</span>
                            <span className="text-xs text-slate-500">Defina se este serviço está disponível para agendamento.</span>
                        </div>
                        <label className="relative inline-flex cursor-pointer items-center">
                            <input
                                type="checkbox"
                                className="peer sr-only"
                                disabled={isSaving}
                                checked={formState.active}
                                onChange={(event) => onFieldChange('active', event.target.checked)}
                            />
                            <div className="h-6 w-11 rounded-full bg-slate-300 after:absolute after:start-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white" />
                        </label>
                    </div>

                    {formError ? <p className="text-sm font-medium text-rose-700">{formError}</p> : null}

                    <div className="flex items-center justify-end gap-4 border-t border-slate-100 pb-8 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSaving}
                            className="rounded-lg border border-slate-300 px-6 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                        >
                            Cancelar
                        </button>
                        <button
                            disabled={isSaving}
                            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/20 transition-all hover:bg-primary/90"
                        >
                            <span className="material-symbols-outlined text-[18px]">save</span>
                            {isSaving ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Criar serviço'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
