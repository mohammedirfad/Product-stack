export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Secure Product Catalog API',
    version: '2.0.0',
    description: 'JWT-protected product catalog API with pagination, search, filtering, Redis caching, and rate limiting.'
  },
  servers: [{ url: 'http://localhost:4000' }],
  tags: [
    { name: 'Auth' },
    { name: 'Products' },
    { name: 'System' }
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
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'admin@example.com' },
          password: { type: 'string', format: 'password', example: 'ChangeMe123!' }
        }
      },
      ProductInput: {
        type: 'object',
        required: ['name', 'sku', 'category', 'price', 'stock'],
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 120 },
          sku: { type: 'string', minLength: 2, maxLength: 64 },
          category: { type: 'string', minLength: 2, maxLength: 80 },
          imageUrl: { type: 'string', maxLength: 300, example: '/products/wearable-kit.svg' },
          description: { type: 'string', maxLength: 500 },
          price: { type: 'number', minimum: 0, maximum: 1000000 },
          stock: { type: 'integer', minimum: 0, maximum: 10000000 }
        }
      },
      Product: {
        allOf: [
          { $ref: '#/components/schemas/ProductInput' },
          {
            type: 'object',
            properties: {
              id: { type: 'string' },
              active: { type: 'boolean' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' }
            }
          }
        ]
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: { type: 'object' }
            }
          }
        }
      }
    },
    responses: {
      Error: {
        description: 'Standard error response',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' }
          }
        }
      }
    }
  },
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'API health check',
        description: 'Verifies that the API server is up and running. Returns the current cache engine status (Redis or In-Memory) and server uptime in seconds. Used for monitoring, container health checks, and dashboard status checks.',
        responses: {
          200: { description: 'API is healthy' }
        }
      }
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login and receive a JWT',
        description: 'Authenticates an administrator with email and password. Returns a JWT token type (Bearer) and access token. This token must be sent in the \'Authorization\' header of subsequent write operations (Create, Update, Delete, Upload).',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } }
        },
        responses: {
          200: { description: 'Authenticated session' },
          401: { $ref: '#/components/responses/Error' },
          429: { $ref: '#/components/responses/Error' }
        }
      }
    },
    '/api/products': {
      get: {
        tags: ['Products'],
        summary: 'List products (Public)',
        description: 'Retrieves a paginated list of products from the catalog. Supports client-side query parameters for full-text search, category filtering, stock status, min/max price bounds, and custom sorting. This route is public and does not require authentication.',
        parameters: [
          { in: 'query', name: 'search', description: 'Search query matching product name, SKU, category, or description', schema: { type: 'string' } },
          { in: 'query', name: 'category', description: 'Filter by product category (Electronics, Home, Fashion)', schema: { type: 'string' } },
          { in: 'query', name: 'inStock', description: 'Filter by inventory availability (true for stock > 0, false for stock = 0)', schema: { type: 'boolean' } },
          { in: 'query', name: 'minPrice', description: 'Filter by minimum unit price', schema: { type: 'number' } },
          { in: 'query', name: 'maxPrice', description: 'Filter by maximum unit price', schema: { type: 'number' } },
          { in: 'query', name: 'page', description: 'Page number for pagination (starts at 1)', schema: { type: 'integer', default: 1 } },
          { in: 'query', name: 'pageSize', description: 'Number of products to display per page (default: 10, max: 50)', schema: { type: 'integer', default: 10, maximum: 50 } },
          { in: 'query', name: 'sortBy', description: 'Field to sort the products by', schema: { type: 'string', enum: ['name', 'price', 'createdAt', 'updatedAt', 'stock'] } },
          { in: 'query', name: 'sortOrder', description: 'Sorting order (asc for ascending, desc for descending)', schema: { type: 'string', enum: ['asc', 'desc'] } }
        ],
        responses: {
          200: { description: 'Paginated products list' },
          429: { $ref: '#/components/responses/Error' }
        }
      },
      post: {
        tags: ['Products'],
        security: [{ bearerAuth: [] }],
        summary: 'Create product (Admin Only)',
        description: 'Adds a new product to the catalog database. Validates input values (name length, unique SKU, category matching, and positive price/stock). Caches are automatically cleared on success. Requires a valid JWT in the Authorization header.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ProductInput' } } }
        },
        responses: {
          201: { description: 'Created product' },
          401: { $ref: '#/components/responses/Error' },
          409: { $ref: '#/components/responses/Error' },
          422: { $ref: '#/components/responses/Error' }
        }
      }
    },
    '/api/products/upload': {
      post: {
        tags: ['Products'],
        security: [{ bearerAuth: [] }],
        summary: 'Upload product image (Admin Only)',
        description: 'Allows authenticated administrators to upload a local image file (JPG, PNG, GIF, WEBP, SVG) up to 5MB. The image is saved on the server\'s static disk, and the relative URL is returned. This URL path can be passed in the \'imageUrl\' field of product creation/modification requests.',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  image: {
                    type: 'string',
                    format: 'binary',
                    description: 'The image file to upload (JPEG, PNG, WEBP, GIF, SVG up to 5MB)'
                  }
                },
                required: ['image']
              }
            }
          }
        },
        responses: {
          200: {
            description: 'Image uploaded successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    imageUrl: {
                      type: 'string',
                      example: '/uploads/84313f8c-8f12-421b-a25e-38411d33ca24.png'
                    }
                  }
                }
              }
            }
          },
          400: { $ref: '#/components/responses/Error' },
          401: { $ref: '#/components/responses/Error' }
        }
      }
    },
    '/api/products/{id}': {
      get: {
        tags: ['Products'],
        summary: 'Get product by id (Public)',
        description: 'Retrieves full details of a specific product using its unique UUID. This route is public and does not require authentication. Results are cached server-side to maximize read performance.',
        parameters: [{ in: 'path', name: 'id', required: true, description: 'The unique product UUID', schema: { type: 'string' } }],
        responses: {
          200: { description: 'Product detail' },
          404: { $ref: '#/components/responses/Error' }
        }
      },
      put: {
        tags: ['Products'],
        security: [{ bearerAuth: [] }],
        summary: 'Update product (Admin Only)',
        description: 'Modifies fields of an existing product by its UUID. Supports partial updates. Validates unique SKUs to prevent conflicts. Clears the server cache and requires a valid JWT in the Authorization header.',
        parameters: [{ in: 'path', name: 'id', required: true, description: 'The unique product UUID to update', schema: { type: 'string' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ProductInput' } } }
        },
        responses: {
          200: { description: 'Updated product' },
          401: { $ref: '#/components/responses/Error' },
          409: { $ref: '#/components/responses/Error' },
          422: { $ref: '#/components/responses/Error' }
        }
      },
      delete: {
        tags: ['Products'],
        security: [{ bearerAuth: [] }],
        summary: 'Delete product (Admin Only)',
        description: 'Removes a product permanently from the catalog. Automatically invalidates related list and detail caches on completion. Requires a valid JWT in the Authorization header.',
        parameters: [{ in: 'path', name: 'id', required: true, description: 'The unique product UUID to delete', schema: { type: 'string' } }],
        responses: {
          200: { description: 'Deleted product' },
          401: { $ref: '#/components/responses/Error' },
          404: { $ref: '#/components/responses/Error' }
        }
      }
    }
  }
};
