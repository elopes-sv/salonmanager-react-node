export const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
})

export const selectedDateMonthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'long' })

export const calendarMonthTitleFormatter = new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    timeZone: 'UTC',
})

export function formatSelectedDateTitle(date) {
    return `${date.getDate()}º de ${selectedDateMonthFormatter.format(date)} ${date.getFullYear()}`
}

export function addMinutes(date, minutes) {
    return new Date(date.getTime() + minutes * 60_000)
}

export function formatDateInput(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

export function formatTimeInput(date) {
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
}

export function getDurationMinutes(startAt, endAt) {
    const start = new Date(startAt)
    const end = new Date(endAt)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return 0
    }

    const minutes = Math.round((end.getTime() - start.getTime()) / 60_000)
    return minutes > 0 ? minutes : 0
}

export function combineDateAndTime(dateValue, timeValue) {
    const [year, month, day] = dateValue.split('-').map(Number)
    const [hour, minute] = timeValue.split(':').map(Number)
    return new Date(year, month - 1, day, hour || 0, minute || 0, 0, 0)
}

export function isSameDay(left, right) {
    return (
        left.getFullYear() === right.getFullYear() &&
        left.getMonth() === right.getMonth() &&
        left.getDate() === right.getDate()
    )
}

export function isPastDay(date) {
    const today = new Date()
    const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const normalizedToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    return normalizedDate.getTime() < normalizedToday.getTime()
}
