import express from 'express'
import {
    createAppointmentRecord,
    deleteAppointmentRecord,
    listAppointmentRecords,
    updateAppointmentRecord,
} from '../store.js'

const router = express.Router()

router.get('/', async (req, res) => {
    try {
        const records = await listAppointmentRecords(req.authUser.id)
        res.json(records)
    } catch (error) {
        res.status(500).json({
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Erro interno ao listar agendamentos.',
        })
    }
})

router.post('/', async (req, res) => {
    try {
        const created = await createAppointmentRecord(req.authUser.id, req.body ?? {})
        res.status(201).json(created)
    } catch (error) {
        if (error instanceof Error && error.message.startsWith('VALIDATION:')) {
            res.status(400).json({ code: 'VALIDATION_ERROR', message: error.message.replace('VALIDATION:', '').trim() })
            return
        }

        if (error instanceof Error && error.message.startsWith('CONFLICT:')) {
            res.status(409).json({ code: 'TIME_CONFLICT', message: error.message.replace('CONFLICT:', '').trim() })
            return
        }

        if (error instanceof Error && error.message === 'SERVICE_NOT_FOUND') {
            res.status(400).json({ code: 'SERVICE_NOT_FOUND', message: 'Serviço informado não existe.' })
            return
        }

        if (error instanceof Error && error.message === 'SERVICE_INACTIVE') {
            res.status(409).json({ code: 'SERVICE_INACTIVE', message: 'Não é possível criar agendamento com serviço inativo.' })
            return
        }

        res.status(500).json({
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Erro interno ao criar agendamento.',
        })
    }
})

router.put('/:id', async (req, res) => {
    try {
        const updated = await updateAppointmentRecord(req.authUser.id, req.params.id, req.body ?? {})
        res.json(updated)
    } catch (error) {
        if (error instanceof Error && error.message.startsWith('VALIDATION:')) {
            res.status(400).json({ code: 'VALIDATION_ERROR', message: error.message.replace('VALIDATION:', '').trim() })
            return
        }

        if (error instanceof Error && error.message === 'NOT_FOUND') {
            res.status(404).json({ code: 'NOT_FOUND', message: 'Agendamento não encontrado.' })
            return
        }

        if (error instanceof Error && error.message.startsWith('CONFLICT:')) {
            res.status(409).json({ code: 'TIME_CONFLICT', message: error.message.replace('CONFLICT:', '').trim() })
            return
        }

        if (error instanceof Error && error.message === 'SERVICE_NOT_FOUND') {
            res.status(400).json({ code: 'SERVICE_NOT_FOUND', message: 'Serviço informado não existe.' })
            return
        }

        if (error instanceof Error && error.message === 'SERVICE_INACTIVE') {
            res.status(409).json({ code: 'SERVICE_INACTIVE', message: 'Não é possível trocar para um serviço inativo.' })
            return
        }

        res.status(500).json({
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Erro interno ao atualizar agendamento.',
        })
    }
})

router.delete('/:id', async (req, res) => {
    try {
        await deleteAppointmentRecord(req.authUser.id, req.params.id)
        res.status(204).send()
    } catch (error) {
        if (error instanceof Error && error.message === 'NOT_FOUND') {
            res.status(404).json({ code: 'NOT_FOUND', message: 'Agendamento não encontrado.' })
            return
        }

        res.status(500).json({
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Erro interno ao excluir agendamento.',
        })
    }
})

export default router
