export const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatCurrencyInput(value) {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) {
        return ''
    }

    return numeric.toFixed(2).replace('.', ',')
}

export function normalizeCurrencyInput(rawValue) {
    const value = typeof rawValue === 'string' ? rawValue : String(rawValue ?? '')
    const onlyDigitsAndComma = value.replace(/[^\d,]/g, '')
    const commaIndex = onlyDigitsAndComma.indexOf(',')

    if (commaIndex === -1) {
        return onlyDigitsAndComma
    }

    const integerPart = onlyDigitsAndComma.slice(0, commaIndex)
    const decimalPart = onlyDigitsAndComma
        .slice(commaIndex + 1)
        .replace(/,/g, '')
        .slice(0, 2)

    return `${integerPart},${decimalPart}`
}

export function parseCurrencyInput(value) {
    const normalized = String(value ?? '').trim().replace(/\./g, '').replace(',', '.')
    return Number.parseFloat(normalized)
}
