import { Router } from 'express'
import { authenticate } from '../../middleware/auth.middleware.js'
import { ConversationController } from './conversation.controller.js'

const conversationRouter = Router()
const conversationController = new ConversationController()

/**
 * @swagger
 * /api/v1/conversation:
 *   post:
 *     summary: Create a new conversation
 *     tags: [Conversations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, memberIds]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [direct, group, channel]
 *                 example: group
 *               title:
 *                 type: string
 *                 example: Team Backend
 *               memberIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ['2', '3']
 *     responses:
 *       201:
 *         description: Create conversation success
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: One or more members do not exist
 */
conversationRouter.post('/', authenticate, conversationController.createConversation)

export default conversationRouter
