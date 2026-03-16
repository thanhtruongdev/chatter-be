import 'dotenv/config'
import express from 'express'
import swaggerUi from 'swagger-ui-express'
import swaggerSpec from './config/swagger.js'
import { ApiResponseFactory } from './types/api.js'
import authRouter from './modules/auth/auth.route.js'
import conversationRouter from './modules/conversation/conversation.route.js'

const app = express()

const PORT = process.env.PORT || 3000
const PREFIX = process.env.PREFIX || '/api/v1'

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
