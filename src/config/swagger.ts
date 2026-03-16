import swaggerJsdoc from 'swagger-jsdoc'

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Chatter API',
      version: '1.0.0',
      description: 'API documentation for Chatter messaging app'
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Local development'
      }
    ],
    tags: [
      { name: 'System', description: 'System endpoints' },
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Users', description: 'User endpoints' },
      { name: 'Conversations', description: 'Conversation endpoints' },
      { name: 'Messages', description: 'Message endpoints' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Validation failed'
            }
          }
        }
      }
    }
  },
  apis: ['./src/**/*.js']
}

const swaggerSpec = swaggerJsdoc(options)

export default swaggerSpec
