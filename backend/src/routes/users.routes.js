import { randomUUID } from 'node:crypto'
import express from 'express'
import { hashPassword } from '../auth.js'
import {
    countActiveAdminUsers,
    createUserRecord,
    deleteUserRecord,
    getUserPublicById,
    listUserRecords,
    revokeAuthSessionsByUser,
    updateUserPasswordRecord,
    updateUserRecord,
    updateUserStatusRecord,
} from '../store.js'
import { isEmail, requireAdmin } from '../middleware/auth.middleware.js'

const router = express.Router()

router.get('/', requireAdmin, async (_req, res) => {
    try {
        const records = await listUserRecords()
        res.json(records)
    } catch (error) {
        res.status(500).json({
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Erro interno ao listar usuários.',
        })
    }
})

router.post('/', requireAdmin, async (req, res) => {
    try {
        const payload = req.body ?? {}
        const name = typeof payload.name === 'string' ? payload.name.trim() : ''
        const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
        const password = typeof payload.password === 'string' ? payload.password : ''
        const role = typeof payload.role === 'string' ? payload.role.trim().toLowerCase() : 'staff'

        if (!name) {
            res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Nome é obrigatório.' })
            return
        }

        if (name.length > 120) {
            res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Nome deve ter no máximo 120 caracteres.' })
            return
        }

        if (!isEmail(email) || email.length > 254) {
            res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Informe um e-mail válido.' })
            return
        }

        if (password.length < 8 || password.length > 1024) {
            res.status(400).json({ code: 'VALIDATION_ERROR', message: 'A senha deve ter entre 8 e 1024 caracteres.' })
            return
        }

        if (role !== 'admin' && role !== 'staff') {
            res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Perfil de usuário inválido.' })
            return
        }

        const createdUser = await createUserRecord({
            name,
            email,
            passwordHash: hashPassword(password),
            role,
            mustChangePassword: true,
        })

        res.status(201).json(createdUser)
    } catch (error) {
        if (error instanceof Error && error.message.startsWith('VALIDATION:')) {
            res.status(400).json({ code: 'VALIDATION_ERROR', message: error.message.replace('VALIDATION:', '').trim() })
            return
        }

        if (error instanceof Error && error.message.startsWith('CONFLICT:')) {
            res.status(409).json({ code: 'EMAIL_CONFLICT', message: error.message.replace('CONFLICT:', '').trim() })
            return
        }

        res.status(500).json({
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Erro interno ao criar usuário.',
        })
    }
})

router.put('/:id', requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id
        const payload = req.body ?? {}
        const name = typeof payload.name === 'string' ? payload.name.trim() : ''
        const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
        const role = typeof payload.role === 'string' ? payload.role.trim().toLowerCase() : ''
        const password = typeof payload.password === 'string' ? payload.password : ''

        if (!name) {
            res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Nome é obrigatório.' })
            return
        }

        if (name.length > 120) {
            res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Nome deve ter no máximo 120 caracteres.' })
            return
        }

        if (!isEmail(email) || email.length > 254) {
            res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Informe um e-mail válido.' })
            return
        }

        if (role !== 'admin' && role !== 'staff') {
            res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Perfil de usuário inválido.' })
            return
        }

        if (password && (password.length < 8 || password.length > 1024)) {
            res.status(400).json({ code: 'VALIDATION_ERROR', message: 'A senha deve ter entre 8 e 1024 caracteres.' })
            return
        }

        const currentTarget = await getUserPublicById(userId)
        if (!currentTarget) {
            res.status(404).json({ code: 'NOT_FOUND', message: 'Usuário não encontrado.' })
            return
        }

        if (currentTarget.role === 'admin' && currentTarget.isActive && role !== 'admin') {
            const activeAdmins = await countActiveAdminUsers()
            if (activeAdmins <= 1) {
                res.status(409).json({
                    code: 'LAST_ADMIN_REQUIRED',
                    message: 'Deve existir ao menos um administrador ativo.',
                })
                return
            }
        }

        const updated = await updateUserRecord(userId, {
            name,
            email,
            role,
            passwordHash: password ? hashPassword(password) : '',
        })

        res.json(updated)
    } catch (error) {
        if (error instanceof Error && error.message === 'NOT_FOUND') {
            res.status(404).json({ code: 'NOT_FOUND', message: 'Usuário não encontrado.' })
            return
        }

        if (error instanceof Error && error.message.startsWith('VALIDATION:')) {
            res.status(400).json({ code: 'VALIDATION_ERROR', message: error.message.replace('VALIDATION:', '').trim() })
            return
        }

        if (error instanceof Error && error.message.startsWith('CONFLICT:')) {
            res.status(409).json({ code: 'EMAIL_CONFLICT', message: error.message.replace('CONFLICT:', '').trim() })
            return
        }

        res.status(500).json({
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Erro interno ao atualizar usuário.',
        })
    }
})

router.patch('/:id/status', requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id
        const isActive = req.body?.isActive

        if (typeof isActive !== 'boolean') {
            res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Status de usuário inválido.' })
            return
        }

        const currentTarget = await getUserPublicById(userId)
        if (!currentTarget) {
            res.status(404).json({ code: 'NOT_FOUND', message: 'Usuário não encontrado.' })
            return
        }

        if (req.authUser.id === userId && !isActive) {
            res.status(409).json({
                code: 'SELF_DEACTIVATION_NOT_ALLOWED',
                message: 'Não é possível inativar o próprio usuário logado.',
            })
            return
        }

        if (currentTarget.role === 'admin' && currentTarget.isActive && !isActive) {
            const activeAdmins = await countActiveAdminUsers()
            if (activeAdmins <= 1) {
                res.status(409).json({
                    code: 'LAST_ADMIN_REQUIRED',
                    message: 'Deve existir ao menos um administrador ativo.',
                })
                return
            }
        }

        const updated = await updateUserStatusRecord(userId, isActive)
        if (!isActive) {
            await revokeAuthSessionsByUser(userId)
        }
        res.json(updated)
    } catch (error) {
        if (error instanceof Error && error.message === 'NOT_FOUND') {
            res.status(404).json({ code: 'NOT_FOUND', message: 'Usuário não encontrado.' })
            return
        }

        if (error instanceof Error && error.message.startsWith('VALIDATION:')) {
            res.status(400).json({ code: 'VALIDATION_ERROR', message: error.message.replace('VALIDATION:', '').trim() })
            return
        }

        res.status(500).json({
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Erro interno ao atualizar status do usuário.',
        })
    }
})

router.delete('/:id', requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id

        if (req.authUser.id === userId) {
            res.status(409).json({
                code: 'SELF_DELETION_NOT_ALLOWED',
                message: 'Não é possível excluir o próprio usuário logado.',
            })
            return
        }

        await deleteUserRecord(userId)
        res.status(204).send()
    } catch (error) {
        if (error instanceof Error && error.message === 'NOT_FOUND') {
            res.status(404).json({ code: 'NOT_FOUND', message: 'Usuário não encontrado.' })
            return
        }

        if (error instanceof Error && error.message === 'LAST_ADMIN_REQUIRED') {
            res.status(409).json({
                code: 'LAST_ADMIN_REQUIRED',
                message: 'Deve existir ao menos um administrador ativo.',
            })
            return
        }

        res.status(500).json({
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Erro interno ao excluir usuário.',
        })
    }
})

router.post('/:id/reset-password', requireAdmin, async (req, res) => {
    try {
        const userId = req.params.id
        const providedPassword = typeof req.body?.password === 'string' ? req.body.password : ''
        const generatedPassword = randomUUID().replace(/-/g, '')
        const password = providedPassword || generatedPassword

        if (password.length < 8 || password.length > 1024) {
            res.status(400).json({ code: 'VALIDATION_ERROR', message: 'A senha deve ter entre 8 e 1024 caracteres.' })
            return
        }

        const updated = await updateUserPasswordRecord(userId, hashPassword(password), {
            mustChangePassword: true,
        })
        await revokeAuthSessionsByUser(userId)

        res.json({
            user: updated,
            temporaryPassword: providedPassword ? '' : password,
        })
    } catch (error) {
        if (error instanceof Error && error.message === 'NOT_FOUND') {
            res.status(404).json({ code: 'NOT_FOUND', message: 'Usuário não encontrado.' })
            return
        }

        if (error instanceof Error && error.message.startsWith('VALIDATION:')) {
            res.status(400).json({ code: 'VALIDATION_ERROR', message: error.message.replace('VALIDATION:', '').trim() })
            return
        }

        res.status(500).json({
            code: 'INTERNAL_ERROR',
            message: error instanceof Error ? error.message : 'Erro interno ao redefinir senha.',
        })
    }
})

export default router
