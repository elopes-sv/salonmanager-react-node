import { normalizeCurrencyInput } from '../../../utils/currency'

export function AppointmentFormModal({
    isOpen,
    isEditing,
    formState,
    setFormState,
    formError,
    isSaving,
    activeServiceOptions,
    onServiceChange,
    onSubmit,
    onClose,
}) {
    if (!isOpen) {
        return null
    }

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm">
            <div className="bg-white max-lg:h-dvh max-lg:overflow-auto max-w-[560px] overflow-hidden rounded-xl shadow-2xl w-full">
                <div className="flex items-center justify-between px-8 pb-4 pt-8">
                    <h2 className="text-2xl font-bold text-slate-900">
                        {isEditing ? 'Editar Agendamento' : 'Novo Agendamento'}
                    </h2>
                    <button
                        type="button"
                        disabled={isSaving}
                        className="text-slate-400 transition-colors hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-70"
                        onClick={onClose}
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <form className="space-y-6 px-8 py-4" onSubmit={(event) => void onSubmit(event)}>
                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-slate-700">Nome da Cliente</label>
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">person</span>
                            <input
                                className="w-full rounded-lg border border-slate-200 bg-white py-3 pl-11 pr-4 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20"
                                placeholder="Ex.: Sarah Johnson"
                                type="text"
                                disabled={isSaving}
                                value={formState.client}
                                onChange={(event) => setFormState((current) => ({ ...current, client: event.target.value }))}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-semibold text-slate-700">Data</label>
                            <input
                                className="w-full rounded-lg border border-slate-200 bg-white py-3 px-4 text-slate-900 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                                type="date"
                                disabled={isSaving}
                                value={formState.date}
                                onChange={(event) => setFormState((current) => ({ ...current, date: event.target.value }))}
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-semibold text-slate-700">Horário</label>
                            <input
                                className="w-full rounded-lg border border-slate-200 bg-white py-3 px-4 text-slate-900 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                                type="time"
                                disabled={isSaving}
                                value={formState.time}
                                onChange={(event) => setFormState((current) => ({ ...current, time: event.target.value }))}
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-slate-700">Serviço</label>
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">spa</span>
                            <select
                                className="w-full rounded-lg border border-slate-200 bg-white py-3 pl-11 pr-4 text-slate-900 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                                disabled={isSaving}
                                value={formState.serviceId}
                                onChange={(event) => onServiceChange(event.target.value)}
                            >
                                {activeServiceOptions.map((service) => (
                                    <option key={service.id} value={service.id}>
                                        {service.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-slate-700">Duração (min)</label>
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">schedule</span>
                            <input
                                className="w-full rounded-lg border border-slate-200 bg-white py-3 pl-11 pr-4 text-slate-900 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                                type="number"
                                min="1"
                                step="1"
                                disabled={isSaving}
                                value={formState.durationMinutes}
                                onChange={(event) =>
                                    setFormState((current) => ({
                                        ...current,
                                        durationMinutes: event.target.value.replace(/[^\d]/g, ''),
                                    }))
                                }
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-slate-700">Valor (R$)</label>
                        <div className="relative">
                            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">payments</span>
                            <input
                                className="w-full rounded-lg border border-slate-200 bg-white py-3 pl-11 pr-4 font-medium text-slate-900 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                                type="text"
                                inputMode="decimal"
                                disabled={isSaving}
                                value={formState.value}
                                onChange={(event) => setFormState((current) => ({ ...current, value: normalizeCurrencyInput(event.target.value) }))}
                            />
                        </div>
                        <p className="mt-1 text-[11px] italic text-slate-500">
                            Baseado no preço padrão do serviço selecionado. Você pode ajustar manualmente.
                        </p>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-sm font-semibold text-slate-700">Observações</label>
                        <textarea
                            className="w-full resize-none rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20"
                            placeholder="Adicione exigências especiais ou preferências da cliente..."
                            rows="3"
                            disabled={isSaving}
                            value={formState.notes}
                            onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))}
                        />
                    </div>

                    {formError && <p className="text-sm font-medium text-rose-600">{formError}</p>}

                    <div className="flex gap-3 pb-4 max-md:flex-col">
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex-1 rounded-lg bg-primary px-4 py-3 font-semibold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            {isSaving ? 'Salvando...' : isEditing ? 'Salvar Alterações' : 'Salvar Agendamento'}
                        </button>
                        <button
                            type="button"
                            disabled={isSaving}
                            onClick={onClose}
                            className="flex-1 rounded-lg bg-slate-100 px-4 py-3 font-semibold text-slate-700 transition-all hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-70"
                        >
                            Cancelar
                        </button>
                    </div>
                </form>

            </div>
        </div>
    )
}
