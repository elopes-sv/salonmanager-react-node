import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import ptBrLocale from '@fullcalendar/core/locales/pt-br'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '../../components/AppShell'
import { createAppointment, listAppointments, removeAppointment, updateAppointment } from '../../api/appointments'
import { listServices } from '../../api/services'
import './DashboardPage.css'

const referenceDate = new Date()

const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
const selectedDateMonthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'long' })
const calendarMonthTitleFormatter = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  timeZone: 'UTC',
})

function formatSelectedDateTitle(date) {
  return `${date.getDate()}º de ${selectedDateMonthFormatter.format(date)} ${date.getFullYear()}`
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60_000)
}

function formatDateInput(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatTimeInput(date) {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

function getDurationMinutes(startAt, endAt) {
  const start = new Date(startAt)
  const end = new Date(endAt)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0
  }

  const minutes = Math.round((end.getTime() - start.getTime()) / 60_000)
  return minutes > 0 ? minutes : 0
}

function formatCurrencyInput(value) {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) {
    return ''
  }

  return numeric.toFixed(2).replace('.', ',')
}

function normalizeCurrencyInput(rawValue) {
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

function parseCurrencyInput(value) {
  const normalized = String(value ?? '').trim().replace(/\./g, '').replace(',', '.')
  return Number.parseFloat(normalized)
}

function combineDateAndTime(dateValue, timeValue) {
  const [year, month, day] = dateValue.split('-').map(Number)
  const [hour, minute] = timeValue.split(':').map(Number)
  return new Date(year, month - 1, day, hour || 0, minute || 0, 0, 0)
}

function isSameDay(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  )
}

function isPastDay(date) {
  const today = new Date()
  const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const normalizedToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return normalizedDate.getTime() < normalizedToday.getTime()
}

function getErrorMessage(error, fallbackMessage = 'Ocorreu um erro inesperado.') {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallbackMessage
}

function getErrorCode(error) {
  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code
  }

  return ''
}

function downloadBlobFile(fileName, blob) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

function makeFormState({ date = referenceDate, appointment = null, services = [] } = {}) {
  const firstActiveService = services.find((service) => service.isActive) || null

  if (appointment) {
    const start = new Date(appointment.startAt)
    const appointmentServiceIsActive = services.some((service) => service.id === appointment.serviceId && service.isActive)
    const appointmentDuration = getDurationMinutes(appointment.startAt, appointment.endAt)

    return {
      client: appointment.client,
      date: formatDateInput(start),
      time: formatTimeInput(start),
      serviceId: appointmentServiceIsActive ? appointment.serviceId : firstActiveService ? firstActiveService.id : '',
      durationMinutes:
        appointmentDuration > 0
          ? String(appointmentDuration)
          : String(firstActiveService ? firstActiveService.durationMinutes : 45),
      value: formatCurrencyInput(appointment.value),
      notes: appointment.notes || '',
    }
  }

  return {
    client: '',
    date: formatDateInput(date),
    time: '14:00',
    serviceId: firstActiveService ? firstActiveService.id : '',
    durationMinutes: firstActiveService ? String(firstActiveService.durationMinutes) : '45',
    value: firstActiveService ? formatCurrencyInput(firstActiveService.defaultPrice) : '',
    notes: '',
  }
}

export function DashboardPage() {
  const navigate = useNavigate()
  const exportMenuRef = useRef(null)
  const [appointments, setAppointments] = useState([])
  const [services, setServices] = useState([])
  const [selectedDate, setSelectedDate] = useState(referenceDate)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingAppointmentId, setEditingAppointmentId] = useState(null)
  const [formState, setFormState] = useState(makeFormState())
  const [formError, setFormError] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [noActiveServicesModalOpen, setNoActiveServicesModalOpen] = useState(false)
  const [hasShownNoActiveServicesModal, setHasShownNoActiveServicesModal] = useState(false)

  const serviceOptions = useMemo(
    () =>
      services.map((service) => ({
        id: service.id,
        label: service.name,
        durationMinutes: service.durationMinutes,
        defaultPrice: service.price,
        isActive: service.isActive,
      })),
    [services],
  )
  const activeServiceOptions = useMemo(() => serviceOptions.filter((service) => service.isActive), [serviceOptions])

  const serviceIndex = useMemo(() => Object.fromEntries(serviceOptions.map((service) => [service.id, service])), [serviceOptions])
  const hasActiveService = useMemo(() => serviceOptions.some((service) => service.isActive), [serviceOptions])

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true)
    setLoadError('')

    try {
      const [appointmentRecords, serviceRecords] = await Promise.all([listAppointments(), listServices()])
      setAppointments(appointmentRecords)
      setServices(serviceRecords)
    } catch (error) {
      if (getErrorCode(error) === 'UNAUTHORIZED') {
        navigate('/login', { replace: true })
        return
      }

      setLoadError(getErrorMessage(error, 'Não foi possível carregar agendamentos e serviços.'))
    } finally {
      setIsLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    void loadDashboardData()
  }, [loadDashboardData])

  useEffect(() => {
    if (isLoading || loadError) {
      return
    }

    if (hasActiveService) {
      setNoActiveServicesModalOpen(false)
      return
    }

    if (!hasShownNoActiveServicesModal) {
      setNoActiveServicesModalOpen(true)
      setHasShownNoActiveServicesModal(true)
    }
  }, [isLoading, loadError, hasActiveService, hasShownNoActiveServicesModal])

  useEffect(() => {
    if (!exportMenuOpen) {
      return
    }

    function handleOutsideClick(event) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setExportMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [exportMenuOpen])

  const sortedAppointments = useMemo(
    () =>
      [...appointments].sort((left, right) => {
        return new Date(left.startAt).getTime() - new Date(right.startAt).getTime()
      }),
    [appointments],
  )

  const filteredAppointments = useMemo(() => {
    return sortedAppointments.filter((appointment) => isSameDay(new Date(appointment.startAt), selectedDate))
  }, [sortedAppointments, selectedDate])

  const totalGross = useMemo(() => {
    return filteredAppointments.reduce((sum, appointment) => sum + appointment.value, 0)
  }, [filteredAppointments])

  const salonFee = totalGross * 0.3
  const totalNet = totalGross - salonFee

  const eventData = useMemo(() => {
    return sortedAppointments.map((appointment) => {
      const service = serviceIndex[appointment.serviceId]
      return {
        id: appointment.id,
        title: `${appointment.client} - ${service?.label || 'Serviço'}`,
        start: appointment.startAt,
        end: appointment.endAt,
      }
    })
  }, [sortedAppointments, serviceIndex])

  function closeModal() {
    setModalOpen(false)
    setEditingAppointmentId(null)
    setFormError('')
    setIsSaving(false)
  }

  function openCreateModal(date = selectedDate) {
    if (!hasActiveService) {
      setNoActiveServicesModalOpen(true)
      return
    }

    setEditingAppointmentId(null)
    setFormState(makeFormState({ date, services: serviceOptions }))
    setFormError('')
    setActionError('')
    setModalOpen(true)
  }

  function openEditModal(appointmentId) {
    const appointment = appointments.find((item) => item.id === appointmentId)
    if (!appointment) {
      return
    }

    if (!hasActiveService) {
      setNoActiveServicesModalOpen(true)
      return
    }

    if (!serviceIndex[appointment.serviceId]) {
      setActionError('Esse agendamento usa um serviço inexistente. Ajuste os serviços antes de editar.')
      return
    }

    setEditingAppointmentId(appointmentId)
    setFormState(makeFormState({ appointment, services: serviceOptions }))
    setFormError('')
    setActionError('')
    setModalOpen(true)
  }

  async function handleDeleteAppointment(appointmentId) {
    const appointment = appointments.find((item) => item.id === appointmentId)
    if (!appointment) {
      return
    }

    const service = serviceIndex[appointment.serviceId]
    const confirmed = window.confirm(
      `Excluir o agendamento de ${appointment.client} (${service?.label || 'Serviço'}) em ${dateTimeFormatter.format(new Date(appointment.startAt))}?`,
    )

    if (!confirmed) {
      return
    }

    setActionError('')

    try {
      await removeAppointment(appointmentId)
      setAppointments((current) => current.filter((item) => item.id !== appointmentId))
    } catch (error) {
      if (getErrorCode(error) === 'UNAUTHORIZED') {
        navigate('/login', { replace: true })
        return
      }

      setActionError(getErrorMessage(error, 'Não foi possível excluir o agendamento.'))
    }
  }

  function handleServiceChange(nextServiceId) {
    setFormState((current) => {
      const previousService = serviceIndex[current.serviceId]
      const nextService = serviceIndex[nextServiceId]

      if (!nextService) {
        return current
      }

      const previousDefault = previousService ? formatCurrencyInput(previousService.defaultPrice) : ''
      const shouldReplaceValue = current.value === '' || current.value === previousDefault
      const previousDurationDefault = previousService ? String(previousService.durationMinutes) : ''
      const shouldReplaceDuration = current.durationMinutes === '' || current.durationMinutes === previousDurationDefault

      return {
        ...current,
        serviceId: nextServiceId,
        durationMinutes: shouldReplaceDuration ? String(nextService.durationMinutes) : current.durationMinutes,
        value: shouldReplaceValue ? formatCurrencyInput(nextService.defaultPrice) : current.value,
      }
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')

    const client = formState.client.trim()
    const service = serviceIndex[formState.serviceId]
    const parsedValue = parseCurrencyInput(formState.value)
    const parsedDuration = Number.parseInt(formState.durationMinutes, 10)

    if (!client) {
      setFormError('Informe o nome da cliente.')
      return
    }

    if (!formState.date || !formState.time) {
      setFormError('Informe a data e o horário do agendamento.')
      return
    }

    if (!service) {
      setFormError('Selecione um serviço válido.')
      return
    }

    if (Number.isNaN(parsedValue) || parsedValue <= 0) {
      setFormError('Informe um valor válido.')
      return
    }

    if (!Number.isInteger(parsedDuration) || parsedDuration <= 0) {
      setFormError('Informe uma duração válida em minutos.')
      return
    }

    const start = combineDateAndTime(formState.date, formState.time)
    if (Number.isNaN(start.getTime())) {
      setFormError('Data ou horário inválido.')
      return
    }

    const end = addMinutes(start, parsedDuration)
    const payload = {
      client,
      serviceId: service.id,
      value: parsedValue,
      notes: formState.notes.trim(),
      startAt: start.toISOString(),
      endAt: end.toISOString(),
    }

    setIsSaving(true)
    setActionError('')

    try {
      if (editingAppointmentId) {
        const updated = await updateAppointment(editingAppointmentId, payload)
        setAppointments((current) => current.map((item) => (item.id === editingAppointmentId ? updated : item)))
      } else {
        const created = await createAppointment(payload)
        setAppointments((current) => [...current, created])
      }

      setSelectedDate(start)
      closeModal()
    } catch (error) {
      if (getErrorCode(error) === 'UNAUTHORIZED') {
        navigate('/login', { replace: true })
        return
      }

      if (getErrorCode(error) === 'TIME_CONFLICT') {
        setFormError('Já existe um agendamento nesse horário. Escolha outro horário.')
        return
      }

      if (getErrorCode(error) === 'SERVICE_NOT_FOUND') {
        setFormError('O serviço selecionado não existe mais. Atualize os serviços e tente novamente.')
        return
      }

      if (getErrorCode(error) === 'SERVICE_INACTIVE') {
        setFormError('O serviço selecionado está inativo. Escolha outro serviço ativo.')
        return
      }

      setFormError(getErrorMessage(error, 'Não foi possível salvar o agendamento.'))
    } finally {
      setIsSaving(false)
    }
  }

  async function handleExportCsv() {
    setExportMenuOpen(false)

    if (filteredAppointments.length === 0) {
      setActionError('Não há agendamentos na data selecionada para exportar.')
      return
    }

    try {
      const { default: Papa } = await import('papaparse')

      setActionError('')
      const csvRows = filteredAppointments.map((appointment) => {
        const service = serviceIndex[appointment.serviceId]
        const durationMinutes = getDurationMinutes(appointment.startAt, appointment.endAt)

        return [
          dateTimeFormatter.format(new Date(appointment.startAt)),
          appointment.client,
          service?.label || 'Serviço',
          String(durationMinutes),
          Number(appointment.value).toFixed(2).replace('.', ','),
          appointment.notes || '',
        ]
      })

      const csvContent = Papa.unparse(
        {
          fields: ['Data e horário', 'Cliente', 'Serviço', 'Duração (min)', 'Valor (R$)', 'Observações'],
          data: csvRows,
        },
        {
          delimiter: ';',
        },
      )

      const blob = new Blob([`\uFEFF${csvContent}`], {
        type: 'text/csv;charset=utf-8',
      })

      downloadBlobFile(`agendamentos-${formatDateInput(selectedDate)}.csv`, blob)
    } catch (error) {
      setActionError(getErrorMessage(error, 'Não foi possível exportar o CSV.'))
    }
  }

  async function handleExportPdf() {
    setExportMenuOpen(false)

    if (filteredAppointments.length === 0) {
      setActionError('Não há agendamentos na data selecionada para exportar.')
      return
    }

    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')])

      setActionError('')
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
      })

      const marginX = 40
      const titleY = 48

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(20)
      doc.text(`Agenda de ${formatSelectedDateTitle(selectedDate)}`, marginX, titleY)

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(71, 85, 105)
      doc.text(`Gerado em ${dateTimeFormatter.format(new Date())}`, marginX, titleY + 18)
      doc.setTextColor(15, 23, 42)

      const tableRows = filteredAppointments.map((appointment) => {
        const service = serviceIndex[appointment.serviceId]
        const durationMinutes = getDurationMinutes(appointment.startAt, appointment.endAt)

        return [
          dateTimeFormatter.format(new Date(appointment.startAt)),
          appointment.client,
          service?.label || 'Serviço',
          `${durationMinutes} min`,
          currencyFormatter.format(appointment.value),
          appointment.notes || '-',
        ]
      })

      autoTable(doc, {
        head: [['Data e horário', 'Cliente', 'Serviço', 'Duração', 'Valor', 'Observações']],
        body: tableRows,
        startY: titleY + 34,
        theme: 'grid',
        styles: {
          fontSize: 10,
          cellPadding: 6,
        },
        headStyles: {
          fillColor: [248, 250, 252],
          textColor: [71, 85, 105],
          fontStyle: 'bold',
        },
        margin: { left: marginX, right: marginX },
      })

      const tableFinalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : titleY + 34
      const summaryStartY = tableFinalY + 20

      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.text(`Total bruto: ${currencyFormatter.format(totalGross)}`, marginX, summaryStartY)
      doc.text(`Taxa do salão (30%): ${currencyFormatter.format(salonFee)}`, marginX, summaryStartY + 16)
      doc.setFont('helvetica', 'bold')
      doc.text(`Total líquido: ${currencyFormatter.format(totalNet)}`, marginX, summaryStartY + 32)

      doc.save(`agendamentos-${formatDateInput(selectedDate)}.pdf`)
    } catch (error) {
      setActionError(getErrorMessage(error, 'Não foi possível exportar o PDF.'))
    }
  }

  return (
    <AppShell active="appointments">
      <div className="flex flex-col gap-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-black leading-tight tracking-[-0.033em] text-slate-900">
                  Agenda de {formatSelectedDateTitle(selectedDate)}
                </h1>
                <p className="text-base font-normal leading-normal text-slate-500">
                  Selecione um dia no calendário para ver os agendamentos da data selecionada.
                </p>
              </div>

              <div className="flex gap-3 max-md:flex-col max-md:w-[100%]">
                <div ref={exportMenuRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setExportMenuOpen((value) => !value)}
                    className="max-md:w-[100%] flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-6 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-200"
                  >
                    <span className="material-symbols-outlined text-lg">download</span>
                    <span>Exportar CSV/PDF</span>
                  </button>

                  {exportMenuOpen ? (
                    <div className="absolute right-0 top-12 z-20 min-w-[200px] rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
                      <button
                        type="button"
                        onClick={() => void handleExportCsv()}
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                      >
                        <span className="material-symbols-outlined text-base">table_view</span>
                        Exportar CSV
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleExportPdf()}
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
                      >
                        <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                        Exportar PDF
                      </button>
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => openCreateModal(selectedDate)}
                  className="flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:brightness-110"
                >
                  <span className="material-symbols-outlined text-lg">person_add</span>
                  <span>Novo agendamento</span>
                </button>
              </div>
            </div>

            {actionError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{actionError}</div>
            )}

            <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
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
                    dateClick={(info) => setSelectedDate(info.date)}
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

              <div className="lg:col-span-8">
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
                                  onClick={() => void loadDashboardData()}
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
                                      onClick={() => openEditModal(appointment.id)}
                                      className="text-slate-400 transition-colors hover:text-primary"
                                    >
                                      <span className="material-symbols-outlined text-lg">edit</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void handleDeleteAppointment(appointment.id)}
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
                      <button type="button" className="rounded-lg border border-slate-200 p-2 text-slate-400 opacity-50" disabled>
                        <span className="material-symbols-outlined">chevron_left</span>
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 p-2 text-slate-400 transition-colors hover:text-slate-900"
                      >
                        <span className="material-symbols-outlined">chevron_right</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
      </div>

      <button
        type="button"
        onClick={() => openCreateModal(selectedDate)}
        className="fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-xl shadow-primary/30 transition-transform hover:scale-105 active:scale-95 lg:hidden"
      >
        <span className="material-symbols-outlined text-3xl">add</span>
      </button>

      {modalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm">
          <div className="bg-white max-lg:h-dvh max-lg:overflow-auto max-w-[560px] overflow-hidden rounded-xl shadow-2xl w-full">
            <div className="flex items-center justify-between px-8 pb-4 pt-8">
              <h2 className="text-2xl font-bold text-slate-900">
                {editingAppointmentId ? 'Editar Agendamento' : 'Novo Agendamento'}
              </h2>
              <button
                type="button"
                disabled={isSaving}
                className="text-slate-400 transition-colors hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-70"
                onClick={closeModal}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form className="space-y-6 px-8 py-4" onSubmit={(event) => void handleSubmit(event)}>
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
                    className="w-full appearance-none rounded-lg border border-slate-200 bg-white py-3 pl-11 pr-10 text-slate-900 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
                    disabled={isSaving}
                    value={formState.serviceId}
                    onChange={(event) => handleServiceChange(event.target.value)}
                  >
                    {activeServiceOptions.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.label}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                    keyboard_arrow_down
                  </span>
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
                  {isSaving ? 'Salvando...' : editingAppointmentId ? 'Salvar Alterações' : 'Salvar Agendamento'}
                </button>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={closeModal}
                  className="flex-1 rounded-lg bg-slate-100 px-4 py-3 font-semibold text-slate-700 transition-all hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Cancelar
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {noActiveServicesModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[520px] rounded-xl bg-white p-8 shadow-2xl">
            <h3 className="text-2xl font-bold text-slate-900">Nenhum serviço ativo</h3>
            <p className="mt-3 text-sm text-slate-600">
              {serviceOptions.length === 0
                ? 'Para criar agendamentos, cadastre e ative pelo menos um serviço.'
                : 'Para criar agendamentos, ative pelo menos um serviço na tela de Serviços.'}
            </p>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setNoActiveServicesModalOpen(false)}
                className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => {
                  setNoActiveServicesModalOpen(false)
                  navigate('/services')
                }}
                className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90"
              >
                Ir para serviços
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
