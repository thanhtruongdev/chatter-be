import type { AuthenticatedUser } from './middleware/auth.middleware.js'

declare global {
	namespace Express {
		interface Request {
			user?: AuthenticatedUser
		}
	}
}

export {}
