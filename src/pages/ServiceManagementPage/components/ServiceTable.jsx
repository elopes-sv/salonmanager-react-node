import { currencyFormatter } from '../../../utils/currency'

export function ServiceTable({
    isLoading,
    loadError,
    services,
    countLabel,
    canManage,
    activeServiceId,
    onEdit,
    onDelete,
    onToggleActive,
    onRetry,
}) {
    return (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                    <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Nome do serviço</th>
                            <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Valor padrão</th>
                            <th className="px-6 py-4 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Situação</th>
                            <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Ações</th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                        {isLoading ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-10 text-center text-sm text-slate-500">
                                    Carregando serviços...
                                </td>
                            </tr>
                        ) : null}

                        {!isLoading && loadError ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-10 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <p className="text-sm font-medium text-rose-700">{loadError}</p>
                                        <button
                                            type="button"
                                            onClick={onRetry}
                                            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                                        >
                                            Tentar novamente
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ) : null}

                        {!isLoading && !loadError && services.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-10 text-center text-sm text-slate-500">
                                    Nenhum serviço cadastrado.
                                </td>
                            </tr>
                        ) : null}

                        {!isLoading && !loadError
                            ? services.map((service) => {
                                const isRowBusy = activeServiceId === service.id

                                return (
                                    <tr key={service.id} className="transition-colors hover:bg-slate-50/50">
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-semibold text-slate-900">{service.name}</span>
                                                <span className="text-xs text-slate-500">Duração: {service.durationMinutes} min</span>
                                            </div>
                                        </td>

                                        <td className="px-6 py-5 text-right font-medium text-slate-900">
                                            {currencyFormatter.format(service.price)}
                                        </td>

                                        <td className="px-6 py-5">
                                            <div className="flex items-center justify-center">
                                                {canManage ? (
                                                    <label className="relative inline-flex cursor-pointer items-center">
                                                        <input
                                                            type="checkbox"
                                                            className="peer sr-only"
                                                            checked={service.isActive}
                                                            disabled={isRowBusy}
                                                            onChange={(event) => onToggleActive(service.id, event.target.checked)}
                                                        />
                                                        <div className="h-6 w-11 rounded-full bg-slate-200 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-primary peer-checked:after:translate-x-full peer-checked:after:border-white" />
                                                    </label>
                                                ) : (
                                                    <span
                                                        className={`text-xs font-semibold ${service.isActive ? 'text-emerald-600' : 'text-slate-400'}`}
                                                    >
                                                        {service.isActive ? 'Ativo' : 'Inativo'}
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        <td className="px-6 py-5 text-right">
                                            {canManage ? (
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        className="p-2 text-slate-400 transition-colors hover:text-primary"
                                                        disabled={isRowBusy}
                                                        onClick={() => onEdit(service.id)}
                                                    >
                                                        <span className="material-symbols-outlined text-lg">edit</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="p-2 text-slate-400 transition-colors hover:text-red-500"
                                                        disabled={isRowBusy}
                                                        onClick={() => onDelete(service.id)}
                                                    >
                                                        <span className="material-symbols-outlined text-lg">delete</span>
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400">-</span>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })
                            : null}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
                <span className="text-xs font-medium text-slate-500">Total: {countLabel}</span>
            </div>
        </div>
    )
}
