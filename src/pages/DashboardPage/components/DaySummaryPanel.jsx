import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import ptBrLocale from '@fullcalendar/core/locales/pt-br'
import { currencyFormatter } from '../../../utils/currency'
import { calendarMonthTitleFormatter, isPastDay, isSameDay } from '../../../utils/date'

export function DaySummaryPanel({
    referenceDate,
    selectedDate,
    eventData,
    totalGross,
    salonFee,
    totalNet,
    onDateClick,
}) {
    return (
        <div className="flex flex-col gap-6 lg:col-span-4">
            <div className="appointments-calendar rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <FullCalendar
                    plugins={[dayGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    initialDate={referenceDate}
                    locale={ptBrLocale}
                    events={eventData}
                    eventDisplay="none"
                    editable={false}
                    selectable={false}
                    height="auto"
                    fixedWeekCount={false}
                    headerToolbar={{
                        left: 'prev',
                        center: 'title',
                        right: 'next',
                    }}
                    titleFormat={(arg) => {
                        const anchor = arg.start || arg.date
                        const rawMonth = Number(anchor?.month ?? 0)
                        const monthIndex = rawMonth >= 1 && rawMonth <= 12 ? rawMonth - 1 : rawMonth
                        const year = Number(anchor?.year ?? new Date().getFullYear())
                        const monthName = calendarMonthTitleFormatter.format(new Date(Date.UTC(year, monthIndex, 1)))
                        return `${monthName} ${year}`
                    }}
                    dayHeaderFormat={{ weekday: 'narrow' }}
                    dayCellClassNames={(info) => {
                        const classes = []
                        if (isPastDay(info.date)) {
                            classes.push('fc-day-past-custom')
                        }
                        if (isSameDay(info.date, selectedDate)) {
                            classes.push('fc-day-selected-custom')
                        }
                        return classes
                    }}
                    dateClick={(info) => onDateClick(info.date)}
                />
            </div>

            <div className="flex flex-col gap-4 rounded-xl border border-primary/20 bg-primary/5 p-6">
                <h3 className="flex items-center gap-2 text-lg font-bold text-primary">
                    <span className="material-symbols-outlined">insights</span>
                    Resumo do Período
                </h3>
                <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Total bruto</span>
                        <span className="font-bold text-slate-900">{currencyFormatter.format(totalGross)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-600">Taxa do salão (30%)</span>
                        <span className="font-bold text-rose-500">-{currencyFormatter.format(salonFee)}</span>
                    </div>
                    <div className="my-1 h-px bg-slate-200" />
                    <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">Total líquido</span>
                        <span className="text-xl font-black text-primary">{currencyFormatter.format(totalNet)}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}
