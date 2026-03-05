import express from 'express'
import {
    createServiceRecord,
    deleteServiceRecord,
    listServiceRecords,
    updateServiceRecord,
} from '../store.js'
import { requireAdmin } from '../middleware/auth.middleware.js'

const router = express.Router()

router.get('/', async (req, res) => {
    try {
        const records = await listServiceRecords()
        res.json(records)
    } catch (error) {
        res.status(500).json({
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Erro interno ao listar serviços.',
        })
    }
})

router.post('/', requireAdmin, async (req, res) => {
    try {
        const created = await createServiceRecord(req.body ?? {})
        res.status(201).json(created)
    } catch (error) {
        if (error instanceof Error && error.message.startsWith('VALIDATION:')) {
            res.status(400).json({ code: 'VALIDATION_ERROR', message: error.message.replace('VALIDATION:', '').trim() })
            return
        }

        if (error instanceof Error && error.message.startsWith('CONFLICT:')) {
            res.status(409).json({ code: 'SERVICE_NAME_CONFLICT', message: error.message.replace('CONFLICT:', '').trim() })
            return
        }

        res.status(500).json({
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Erro interno ao criar serviço.',
        })
    }
})

router.put('/:id', requireAdmin, async (req, res) => {
    try {
        const updated = await updateServiceRecord(req.params.id, req.body ?? {})
        res.json(updated)
    } catch (error) {
        if (error instanceof Error && error.message.startsWith('VALIDATION:')) {
            res.status(400).json({ code: 'VALIDATION_ERROR', message: error.message.replace('VALIDATION:', '').trim() })
            return
        }

        if (error instanceof Error && error.message === 'NOT_FOUND') {
            res.status(404).json({ code: 'NOT_FOUND', message: 'Serviço não encontrado.' })
            return
        }

        if (error instanceof Error && error.message.startsWith('CONFLICT:')) {
            res.status(409).json({ code: 'SERVICE_NAME_CONFLICT', message: error.message.replace('CONFLICT:', '').trim() })
            return
        }

        if (error instanceof Error && error.message === 'SERVICE_HAS_FUTURE_APPOINTMENTS') {
            res.status(409).json({
                code: 'SERVICE_HAS_FUTURE_APPOINTMENTS',
                message: 'Não é possível inativar um serviço com agendamentos futuros.',
            })
            return
        }

        res.status(500).json({
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Erro interno ao atualizar serviço.',
        })
    }
})

router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        await deleteServiceRecord(req.params.id)
        res.status(204).send()
    } catch (error) {
        if (error instanceof Error && error.message === 'NOT_FOUND') {
            res.status(404).json({ code: 'NOT_FOUND', message: 'Serviço não encontrado.' })
            return
        }

        if (error instanceof Error && error.message === 'IN_USE') {
            res.status(409).json({
                code: 'SERVICE_IN_USE',
                message: 'Não é possível excluir um serviço que já possui agendamentos.',
            })
            return
        }

        res.status(500).json({
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Erro interno ao excluir serviço.',
        })
    }
})

export default router
