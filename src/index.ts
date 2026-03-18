import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import swaggerUi from 'swagger-ui-express'
import swaggerSpec from './config/swagger.js'
import { ApiResponseFactory } from './types/api.js'
import authRouter from './modules/auth/auth.route.js'
import conversationRouter from './modules/conversation/conversation.route.js'
import { Server } from 'socket.io'
import { registerSocketServer } from './realtime/socket.server.js'

const PORT = process.env.PORT || 3000
const PREFIX = process.env.PREFIX || '/api/v1'

const app = express()
const io = new Server({
    path: '/socket.io'
})

const ALLOWED_ORIGINS = new Set([
    'http://localhost:4173',
    'http://127.0.0.1:4173',
    'null',
    'https://wallaby-artistic-horse.ngrok-free.app'
])

app.use(
    cors({
        origin: (origin, callback) => {
            // Allow requests without origin (e.g. curl/Postman) and browser file:// origin ("null")
            if (!origin || ALLOWED_ORIGINS.has(origin)) {
                callback(null, true)
                return
            }

            callback(new Error(`Origin not allowed by CORS: ${origin}`))
        },
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
    })
)

io.listen(3001)
registerSocketServer(io)

app.use(express.json())
app.use(`${PREFIX}/auth`, authRouter)
app.use(`${PREFIX}/conversation`, conversationRouter)

app.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
        explorer: true
    })
)

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Server status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Health check success
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: ok
 */
app.get('/health', (req, res) => {
    const response = ApiResponseFactory.success('Health check success', { status: 'ok' }).toJSON()
    res.json(response)
})

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`)
    console.log(`Swagger docs: http://localhost:${PORT}/docs`)
})
