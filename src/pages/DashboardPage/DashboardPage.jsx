import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppShell } from '../../components/AppShell'
import { createAppointment, listAppointments, removeAppointment, updateAppointment } from '../../api/appointments'
import { getErrorCode, getErrorMessage } from '../../api/errors'
import { listServices } from '../../api/services'
import { currencyFormatter, formatCurrencyInput, parseCurrencyInput } from '../../utils/currency'
import {
  addMinutes,
  combineDateAndTime,
  dateTimeFormatter,
  formatDateInput,
  formatSelectedDateTitle,
  formatTimeInput,
  getDurationMinutes,
  isSameDay,
} from '../../utils/date'
import { downloadBlobFile } from '../../utils/download'
import { useClickOutside } from '../../hooks/useClickOutside'
import { AppointmentFormModal } from './components/AppointmentFormModal'
import { AppointmentTable } from './components/AppointmentTable'
import { DaySummaryPanel } from './components/DaySummaryPanel'
import { NoActiveServicesModal } from './components/NoActiveServicesModal'
import './DashboardPage.css'

const referenceDate = new Date()

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

  useClickOutside(exportMenuRef, () => setExportMenuOpen(false), exportMenuOpen)

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
          <DaySummaryPanel
            referenceDate={referenceDate}
            selectedDate={selectedDate}
            eventData={eventData}
            totalGross={totalGross}
            salonFee={salonFee}
            totalNet={totalNet}
            onDateClick={setSelectedDate}
          />

          <div className="lg:col-span-8">
            <AppointmentTable
              isLoading={isLoading}
              loadError={loadError}
              filteredAppointments={filteredAppointments}
              serviceIndex={serviceIndex}
              onEdit={openEditModal}
              onDelete={(id) => void handleDeleteAppointment(id)}
              onRetry={() => void loadDashboardData()}
            />
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

      <AppointmentFormModal
        isOpen={modalOpen}
        isEditing={Boolean(editingAppointmentId)}
        formState={formState}
        setFormState={setFormState}
        formError={formError}
        isSaving={isSaving}
        activeServiceOptions={activeServiceOptions}
        onServiceChange={handleServiceChange}
        onSubmit={handleSubmit}
        onClose={closeModal}
      />

      <NoActiveServicesModal
        isOpen={noActiveServicesModalOpen}
        hasAnyServices={serviceOptions.length > 0}
        onClose={() => setNoActiveServicesModalOpen(false)}
      />
    </AppShell>
  )
}
