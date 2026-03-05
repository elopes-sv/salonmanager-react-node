import { currencyFormatter } from '../../../utils/currency'
import { dateTimeFormatter, getDurationMinutes } from '../../../utils/date'

export function AppointmentTable({
    isLoading,
    loadError,
    filteredAppointments,
    serviceIndex,
    onEdit,
    onDelete,
    onRetry,
}) {
    return (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                    <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Data e horário</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Cliente</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Serviço</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Duração</th>
                            <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">Valor</th>
                            <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500">Ações</th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-200">
                        {isLoading && (
                            <tr>
                                <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">
                                    Carregando agendamentos...
                                </td>
                            </tr>
                        )}

                        {!isLoading && loadError && (
                            <tr>
                                <td colSpan={6} className="px-6 py-10 text-center">
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
                        )}

                        {!isLoading && !loadError && filteredAppointments.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-6 py-10 text-center text-sm text-slate-500">
                                    Nenhum agendamento para a data selecionada.
                                </td>
                            </tr>
                        )}

                        {!isLoading &&
                            !loadError &&
                            filteredAppointments.map((appointment) => {
                                const service = serviceIndex[appointment.serviceId]
                                const durationMinutes = getDurationMinutes(appointment.startAt, appointment.endAt)

                                return (
                                    <tr key={appointment.id} className="transition-colors hover:bg-slate-50">
                                        <td className="whitespace-nowrap px-6 py-5 text-sm font-medium text-slate-900">
                                            {dateTimeFormatter.format(new Date(appointment.startAt))}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-5 text-sm font-medium text-slate-900">{appointment.client}</td>
                                        <td className="whitespace-nowrap px-6 py-5">
                                            <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                                                {service?.label || 'Serviço'}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-5 text-sm font-semibold text-slate-700">
                                            {durationMinutes} min
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-5 text-sm font-bold text-slate-900">
                                            {currencyFormatter.format(appointment.value)}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-5 text-right text-sm">
                                            <div className="flex justify-end gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => onEdit(appointment.id)}
                                                    className="text-slate-400 transition-colors hover:text-primary"
                                                >
                                                    <span className="material-symbols-outlined text-lg">edit</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => onDelete(appointment.id)}
                                                    className="text-slate-400 transition-colors hover:text-rose-500"
                                                >
                                                    <span className="material-symbols-outlined text-lg">delete</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4">
                <p className="text-sm text-slate-500">Mostrando {filteredAppointments.length} agendamentos</p>
                <div className="flex gap-2">
                    <button type="button" className="flex items-center rounded-lg border border-slate-200 p-2 text-slate-400 opacity-50" disabled>
                        <span className="material-symbols-outlined">chevron_left</span>
                    </button>
                    <button
                        type="button"
                        className="flex items-center rounded-lg border border-slate-200 p-2 text-slate-400 transition-colors hover:text-slate-900"
                    >
                        <span className="material-symbols-outlined">chevron_right</span>
                    </button>
                </div>
            </div>
        </div>
    )
}
