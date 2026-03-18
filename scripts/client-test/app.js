/* global document, io */

const EVENT = {
	AUTH_LOGIN: 'auth:login',
	CONVERSATION_JOIN: 'conversation:join',
	CONVERSATION_HISTORY: 'conversation:history',
	MESSAGE_SEND: 'message:send',
	MESSAGE_NEW: 'message:new',
	MESSAGE_TYPING: 'message:typing'
}

const STORAGE_KEY_PREFIX = 'chatter_client_test_session_'

const byId = (id) => {
	const element = document.getElementById(id)
	if (!element) {
		throw new Error(`Missing element: ${id}`)
	}
	return element
}

const now = () => new Date().toISOString()

const safeJson = (value) => {
	try {
		return JSON.stringify(value)
	} catch {
		return String(value)
	}
}

const maskToken = (token) => {
	if (!token) {
		return 'none'
	}

	if (token.length <= 20) {
		return token
	}

	return `${token.slice(0, 12)}...${token.slice(-8)}`
}

const readApiConfig = () => {
	const apiUrl = byId('api-url').value.trim().replace(/\/$/, '')
	const apiPrefix = byId('api-prefix').value.trim()

	return {
		apiUrl,
		apiPrefix
	}
}

class SimClient {
	constructor(name) {
		this.name = name
		this.clientCode = name.toLowerCase()
		this.socket = null
		this.session = null

		this.loginIdInput = byId(`login-id-${this.clientCode}`)
		this.passwordInput = byId(`login-password-${this.clientCode}`)
		this.opsFieldset = byId(`ops-${this.clientCode}`)

		this.conversationInput = byId(`conversation-id-${this.clientCode}`)
		this.limitInput = byId(`history-limit-${this.clientCode}`)
		this.messageInput = byId(`message-content-${this.clientCode}`)

		this.statusEl = byId(`status-${this.clientCode}`)
		this.typingStateEl = byId(`typing-state-${this.clientCode}`)
		this.logEl = byId(`log-${this.clientCode}`)
		this.messagesEl = byId(`messages-${this.clientCode}`)
		this.sessionUserEl = byId(`session-user-${this.clientCode}`)
		this.sessionTokenEl = byId(`session-token-${this.clientCode}`)

		byId(`login-${this.clientCode}`).addEventListener('click', () => this.login())
		byId(`logout-${this.clientCode}`).addEventListener('click', () => this.logout())
		byId(`fetch-conversations-${this.clientCode}`).addEventListener('click', () => this.fetchConversations())

		byId(`connect-${this.clientCode}`).addEventListener('click', () => this.connect())
		byId(`disconnect-${this.clientCode}`).addEventListener('click', () => this.disconnect())
		byId(`auth-login-${this.clientCode}`).addEventListener('click', () => this.authLogin())
		byId(`join-${this.clientCode}`).addEventListener('click', () => this.joinConversation())
		byId(`typing-on-${this.clientCode}`).addEventListener('click', () => this.sendTyping(true))
		byId(`typing-off-${this.clientCode}`).addEventListener('click', () => this.sendTyping(false))
		byId(`send-${this.clientCode}`).addEventListener('click', () => this.sendMessage())
		byId(`send-invalid-${this.clientCode}`).addEventListener('click', () => this.sendInvalidMessage())

		this.loadSession()
		this.renderSession()
	}

	storageKey() {
		return `${STORAGE_KEY_PREFIX}${this.clientCode}`
	}

	setStatus(text, isError = false) {
		this.statusEl.textContent = `Status: ${text}`
		this.statusEl.style.color = isError ? '#b00020' : '#0f8a5f'
	}

	setTypingState(text, isActive = false) {
		this.typingStateEl.textContent = `Typing: ${text}`
		this.typingStateEl.style.color = isActive ? '#c05b00' : '#6a7784'
	}

	log(message, payload) {
		const line = payload === undefined ? `[${now()}] ${message}` : `[${now()}] ${message} ${safeJson(payload)}`
		this.logEl.textContent += `${line}\n`
		this.logEl.scrollTop = this.logEl.scrollHeight
	}

	clearLog() {
		this.logEl.textContent = ''
	}

	clearMessages() {
		this.messagesEl.innerHTML = ''
	}

	appendMessage(message, sourceEvent) {
		const item = document.createElement('div')
		item.className = 'message-item'
		item.innerHTML = `
            <div><strong>${message.content ?? '(no content)'}</strong></div>
            <div class="message-meta">event=${sourceEvent} messageId=${message.id} senderId=${message.senderId} type=${message.type}</div>
            <div class="message-meta">createdAt=${message.createdAt}</div>
        `
		this.messagesEl.prepend(item)
	}

	getSocketConfig() {
		const socketUrl = byId('socket-url').value.trim()
		const socketPath = byId('socket-path').value.trim()

		return {
			socketUrl,
			socketPath
		}
	}

	ensureSocket() {
		if (!this.socket) {
			throw new Error(`[${this.name}] Socket is not connected. Click connect first.`)
		}
		return this.socket
	}

	getTokenOrThrow() {
		const token = this.session?.accessToken
		if (!token) {
			throw new Error(`[${this.name}] No access token. Login first.`)
		}
		return token
	}

	renderSession() {
		if (!this.session) {
			this.sessionUserEl.textContent = 'User: not logged in'
			this.sessionTokenEl.textContent = 'Token: none'
			this.opsFieldset.disabled = true
			this.setTypingState('nobody')
			return
		}

		const user = this.session.user
		this.sessionUserEl.textContent = `User: ${user.username} (${user.email}) id=${user.id}`
		this.sessionTokenEl.textContent = `Token: ${maskToken(this.session.accessToken)}`
		this.opsFieldset.disabled = false
		this.setTypingState('nobody')
	}

	saveSession(session) {
		this.session = session
		localStorage.setItem(this.storageKey(), JSON.stringify(session))
		this.renderSession()
	}

	loadSession() {
		const raw = localStorage.getItem(this.storageKey())
		if (!raw) {
			return
		}

		try {
			const parsed = JSON.parse(raw)
			if (parsed?.accessToken && parsed?.user) {
				this.session = parsed
				if (parsed.user.email && !this.loginIdInput.value) {
					this.loginIdInput.value = parsed.user.email
				}
			}
		} catch {
			localStorage.removeItem(this.storageKey())
		}
	}

	clearSession() {
		this.session = null
		localStorage.removeItem(this.storageKey())
		this.renderSession()
	}

	async login() {
		const emailOrUsername = this.loginIdInput.value.trim()
		const password = this.passwordInput.value

		if (!emailOrUsername || !password) {
			this.log('login skipped', { reason: 'missing emailOrUsername/password' })
			this.setStatus('login failed: missing credentials', true)
			return
		}

		const { apiUrl, apiPrefix } = readApiConfig()
		const loginUrl = `${apiUrl}${apiPrefix}/auth/login`

		try {
			this.log('login request', { loginUrl, emailOrUsername })

			const response = await fetch(loginUrl, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					emailOrUsername,
					password
				})
			})

			const body = await response.json()

			if (!response.ok || !body?.success || !body?.data?.accessToken) {
				this.log('login failed', body)
				this.setStatus('login failed', true)
				return
			}

			const session = {
				accessToken: body.data.accessToken,
				refreshToken: body.data.refreshToken ?? null,
				user: body.data.user
			}

			this.saveSession(session)
			this.log('login success', { userId: session.user.id, username: session.user.username })
			this.setStatus('logged in')
		} catch (error) {
			this.log('login error', { message: error instanceof Error ? error.message : String(error) })
			this.setStatus('login error', true)
		}
	}

	logout() {
		this.disconnect()
		this.clearSession()
		this.log('logout success')
		this.setStatus('logged out')
	}

	authHeaders() {
		return {
			Authorization: `Bearer ${this.getTokenOrThrow()}`,
			'Content-Type': 'application/json'
		}
	}

	async fetchConversations() {
		const { apiUrl, apiPrefix } = readApiConfig()
		const url = `${apiUrl}${apiPrefix}/conversation`

		try {
			const response = await fetch(url, {
				method: 'GET',
				headers: this.authHeaders()
			})

			const body = await response.json()
			this.log('GET /conversation', body)

			if (response.ok && Array.isArray(body?.data) && body.data.length > 0) {
				const firstConversationId = body.data[0]?.id
				if (firstConversationId) {
					this.conversationInput.value = firstConversationId
					this.log('conversationId auto-filled', { conversationId: firstConversationId })
				}
			}
		} catch (error) {
			this.log('GET /conversation error', { message: error instanceof Error ? error.message : String(error) })
		}
	}

	connect() {
		if (this.socket?.connected) {
			this.log('Already connected')
			return
		}

		const { socketUrl, socketPath } = this.getSocketConfig()
		const token = this.getTokenOrThrow()

		this.socket = io(socketUrl, {
			path: socketPath,
			auth: {
				token
			},
			transports: ['websocket'],
			autoConnect: true
		})

		this.socket.on('connect', () => {
			this.setStatus(`connected (${this.socket.id})`)
			this.log('connect', { socketId: this.socket.id, handshakeTokenPresent: true })
		})

		this.socket.on('disconnect', (reason) => {
			this.setStatus(`disconnected (${reason})`, true)
			this.log('disconnect', { reason })
		})

		this.socket.on('connect_error', (error) => {
			this.setStatus('connect_error', true)
			this.log('connect_error', { message: error.message })
		})

		this.socket.on(EVENT.CONVERSATION_HISTORY, (payload) => {
			this.log(EVENT.CONVERSATION_HISTORY, payload)
			if (Array.isArray(payload?.messages)) {
				this.clearMessages()
				payload.messages.forEach((message) => this.appendMessage(message, EVENT.CONVERSATION_HISTORY))
			}
		})

		this.socket.on(EVENT.MESSAGE_NEW, (payload) => {
			this.log(EVENT.MESSAGE_NEW, payload)
			if (payload?.message) {
				this.appendMessage(payload.message, EVENT.MESSAGE_NEW)
			}
		})

		this.socket.on(EVENT.MESSAGE_TYPING, (payload) => {
			this.log(EVENT.MESSAGE_TYPING, payload)
			if (!payload) {
				return
			}

			const typingText = payload.isTyping
				? `user ${payload.userId} is typing in conversation ${payload.conversationId}`
				: `user ${payload.userId} stopped typing in conversation ${payload.conversationId}`

			this.setTypingState(typingText, Boolean(payload.isTyping))
		})
	}

	disconnect() {
		if (!this.socket) {
			return
		}

		this.socket.disconnect()
		this.socket = null
		this.setTypingState('nobody')
	}

	authLogin() {
		const socket = this.ensureSocket()
		const token = this.getTokenOrThrow()

		socket.emit(EVENT.AUTH_LOGIN, { token }, (ack) => {
			this.log(`${EVENT.AUTH_LOGIN} ack`, ack)
		})
	}

	joinConversation() {
		const socket = this.ensureSocket()
		const conversationId = this.conversationInput.value.trim()
		const limit = Number(this.limitInput.value || '30')

		socket.emit(
			EVENT.CONVERSATION_JOIN,
			{
				conversationId,
				limit,
				cursor: null
			},
			(ack) => {
				this.log(`${EVENT.CONVERSATION_JOIN} ack`, ack)
			}
		)
	}

	sendTyping(isTyping) {
		const socket = this.ensureSocket()
		const conversationId = this.conversationInput.value.trim()

		socket.emit(
			EVENT.MESSAGE_TYPING,
			{
				conversationId,
				isTyping
			},
			(ack) => {
				this.log(`${EVENT.MESSAGE_TYPING} ack`, ack)
				if (ack?.ok) {
					const stateText = isTyping
						? `you are typing in conversation ${conversationId}`
						: `you stopped typing in conversation ${conversationId}`
					this.setTypingState(stateText, isTyping)
				}
			}
		)
	}

	sendMessage(contentOverride) {
		const socket = this.ensureSocket()
		const conversationId = this.conversationInput.value.trim()
		const content = contentOverride ?? this.messageInput.value.trim()

		socket.emit(
			EVENT.MESSAGE_SEND,
			{
				clientMessageId: `${this.clientCode}-${Date.now()}`,
				conversationId,
				type: 'text',
				content,
				metadata: null,
				replyToMessageId: null
			},
			(ack) => {
				this.log(`${EVENT.MESSAGE_SEND} ack`, ack)
				if (ack?.ok && ack?.data?.message) {
					this.appendMessage(ack.data.message, `${EVENT.MESSAGE_SEND}:ack`)
				}
			}
		)
	}

	sendInvalidMessage() {
		this.sendMessage('')
	}
}

const clientA = new SimClient('A')
const clientB = new SimClient('B')

byId('sync-config').addEventListener('click', () => {
	clientA.log('Global config synchronized')
	clientB.log('Global config synchronized')
})

byId('clear-all-logs').addEventListener('click', () => {
	clientA.clearLog()
	clientB.clearLog()
	byId('quick-log').textContent = ''
})

const quickLog = byId('quick-log')
const quickWrite = (line) => {
	quickLog.textContent += `[${now()}] ${line}\n`
	quickLog.scrollTop = quickLog.scrollHeight
}

byId('run-e2e').addEventListener('click', async () => {
	try {
		quickLog.textContent = ''
		quickWrite('Starting quick E2E flow')

		clientA.connect()
		clientB.connect()

		await new Promise((resolve) => setTimeout(resolve, 700))

		clientA.joinConversation()
		clientB.joinConversation()

		await new Promise((resolve) => setTimeout(resolve, 700))

		clientA.sendMessage(`quick-e2e-${Date.now()}`)

		quickWrite('Sent message from A, check B log for message:new')
	} catch (error) {
		quickWrite(`E2E error: ${error instanceof Error ? error.message : String(error)}`)
	}
})
