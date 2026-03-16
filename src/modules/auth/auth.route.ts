import { Router } from 'express'
import { AuthController } from './auth.controller.js'

const authController = new AuthController()
const authRouter = Router()

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [username, email, password]
 *             properties:
 *               username:
 *                 type: string
 *                 example: johndoe
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 example: Secret123
 *               displayName:
 *                 type: string
 *                 example: John Doe
 *     responses:
 *       201:
 *         description: Register success
 *       400:
 *         description: Validation failed
 *       409:
 *         description: Email or username already exists
 */
authRouter.post('/register', authController.register)

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Login with username/email and password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [emailOrUsername, password]
 *             properties:
 *               emailOrUsername:
 *                 type: string
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 example: Secret123
 *     responses:
 *       200:
 *         description: Login success
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Invalid credentials
 */
authRouter.post('/login', authController.login)

/**
 * @swagger
 * /api/v1/auth/refresh-token:
 *   post:
 *     summary: Issue new access token by refresh token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: Refresh token success
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Invalid refresh token
 */
authRouter.post('/refresh-token', authController.refreshToken)

export default authRouter
