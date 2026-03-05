import cors from 'cors'
import express from 'express'
import { authRuntimeFlags } from './auth.js'
import { cleanupExpiredAuthSessions, countActiveAdminUsers, initializeStore } from './store.js'
import { requireAuth, requirePasswordChangeResolved } from './middleware/auth.middleware.js'
import authRoutes from './routes/auth.routes.js'
import usersRoutes from './routes/users.routes.js'
import appointmentsRoutes from './routes/appointments.routes.js'
import servicesRoutes from './routes/services.routes.js'

const app = express()
const port = Number(process.env.PORT || 4000)
const host = (process.env.HOST || '127.0.0.1').trim() || '127.0.0.1'
const corsOrigin = process.env.CORS_ORIGIN
const allowedOrigins = corsOrigin
  ? corsOrigin
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  : ['http://localhost:5173', 'http://127.0.0.1:5173']

app.disable('x-powered-by')

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true)
        return
      }

      callback(null, allowedOrigins.includes(origin))
    },
    credentials: true,
  }),
)

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Cache-Control', 'no-store')
  next()
})

app.use(express.json({ limit: '16kb' }))

// --- Health & info ---

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'salonmanager-api',
    now: new Date().toISOString(),
  })
})

app.get('/', (_req, res) => {
  res.json({
    service: 'salonmanager-api',
    status: 'ok',
    message: 'API online.',
    endpoints: {
      health: '/health',
      authLogin: '/auth/login',
    },
    now: new Date().toISOString(),
  })
})

// --- Routes ---

app.use('/auth', authRoutes)
app.use(['/appointments', '/services', '/users'], requireAuth, requirePasswordChangeResolved)
app.use('/users', usersRoutes)
app.use('/appointments', appointmentsRoutes)
app.use('/services', servicesRoutes)

// --- Bootstrap ---

initializeStore()
  .then(async () => {
    await cleanupExpiredAuthSessions()
    const activeAdmins = await countActiveAdminUsers()
    if (activeAdmins === 0) {
      console.warn('[api] nenhum administrador ativo encontrado. Execute `npm run admin:create`.')
    }

    if (authRuntimeFlags.usesEphemeralTokenSecret) {
      console.warn('[api] AUTH_TOKEN_SECRET não definido. Usando segredo efêmero para esta execução.')
    }

    app.listen(port, host, () => {
      console.log(`[api] running at http://${host}:${port}`)
    })
  })
  .catch((error) => {
    console.error('[api] failed to initialize store:', error)
    process.exit(1)
  })
