import swaggerJsdoc from 'swagger-jsdoc';

// Swagger definition — describes the entire API
// This follows the OpenAPI 3.0 specification standard
// Used by swagger-ui-express to render the interactive documentation page
const swaggerDefinition = {
  openapi: '3.0.0',

  // API metadata — shown at the top of the docs page
  info: {
    title: 'SentinelPay API',
    version: '1.0.0',
    description:
      'A payment risk assessment REST API built for the Canadian fintech ecosystem. ' +
      'SentinelPay evaluates incoming payments against a multi-factor risk scoring engine ' +
      'and returns a detailed risk assessment to help detect and prevent fraudulent transactions.',
    contact: {
      name: 'Aditya Chattopadhyay',
      url: 'https://github.com/adityac14/SentinelPay-Core',
    },
  },

  // Server URLs — shown in the dropdown at the top of the docs page
  // Allows testers to switch between local and production environments
  servers: [
    {
      url: 'https://sentinelpay-core-api-b4b0fzdvgwdnhtgc.canadacentral-01.azurewebsites.net',
      description: 'Production — Azure App Service Canada Central',
    },
    {
      url: 'http://localhost:3000',
      description: 'Local development',
    },
  ],

  // Reusable schema components — referenced throughout the API paths
  // Defining them here avoids repeating the same structure multiple times
  components: {
    schemas: {

      // Request body schema for POST /api/assessments/assess
      AssessPaymentInput: {
        type: 'object',
        required: ['accountNumber', 'payeeName', 'bankCode', 'paymentAmount'],
        properties: {
          accountNumber: {
            type: 'string',
            minLength: 7,
            maxLength: 12,
            pattern: '^\\d+$',
            example: '1234567',
            description: 'Canadian bank account number — digits only, 7 to 12 characters',
          },
          payeeName: {
            type: 'string',
            minLength: 2,
            maxLength: 100,
            example: 'John Smith',
            description: 'Name of the payee associated with the account',
          },
          bankCode: {
            type: 'string',
            minLength: 3,
            maxLength: 3,
            pattern: '^\\d{3}$',
            example: '004',
            description: 'Canadian bank institution code — exactly 3 digits (e.g. 004 = TD Bank)',
          },
          paymentAmount: {
            type: 'number',
            minimum: 0.01,
            maximum: 1000000,
            example: 5000,
            description: 'Payment amount in Canadian dollars — must be positive',
          },
        },
      },

      // Individual risk factor returned in assessment results
      RiskFactor: {
        type: 'object',
        properties: {
          factor: {
            type: 'string',
            example: 'Bank Code Validity',
            description: 'Name of the risk factor evaluated',
          },
          score: {
            type: 'number',
            example: 0,
            description: 'Risk score for this factor — 0 to 100',
          },
          weight: {
            type: 'number',
            example: 0.2,
            description: 'Influence of this factor on the overall score — 0 to 1',
          },
          description: {
            type: 'string',
            example: 'Bank code 004 is a recognized Canadian financial institution',
            description: 'Human readable explanation of this factor score',
          },
        },
      },

      // Full assessment result returned after POST /api/assessments/assess
      AssessmentResult: {
        type: 'object',
        properties: {
          referenceId: {
            type: 'string',
            example: 'PAY-20260412-001558-4821',
            description: 'Unique traceable reference ID in PAY-YYYYMMDD-HHMMSS-XXXX format',
          },
          accountNumber: {
            type: 'string',
            example: '1234567',
          },
          payeeName: {
            type: 'string',
            example: 'John Smith',
          },
          paymentAmount: {
            type: 'number',
            example: 5000,
          },
          overallRiskScore: {
            type: 'number',
            example: 9,
            description: 'Weighted composite risk score — 0 to 100',
          },
          riskLevel: {
            type: 'string',
            enum: ['Low', 'Medium', 'High', 'Critical'],
            example: 'Low',
            description: 'Risk classification based on overall score',
          },
          assessmentStatus: {
            type: 'string',
            enum: ['Cleared', 'Flagged', 'Blocked'],
            example: 'Cleared',
            description: 'Actionable outcome of the assessment',
          },
          riskFactors: {
            type: 'array',
            items: { $ref: '#/components/schemas/RiskFactor' },
            description: 'Breakdown of individual risk factors that contributed to the score',
          },
          recommendation: {
            type: 'string',
            example: 'Risk score 9/100 — payment cleared. No significant risk factors detected. Safe to proceed.',
            description: 'Human readable actionable recommendation for the caller',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2026-04-12T00:15:58.696Z',
          },
        },
      },

      // Lightweight summary used in the paginated list response
      AssessmentSummary: {
        type: 'object',
        properties: {
          referenceId: { type: 'string', example: 'PAY-20260412-001558-4821' },
          accountNumber: { type: 'string', example: '1234567' },
          payeeName: { type: 'string', example: 'John Smith' },
          paymentAmount: { type: 'number', example: 5000 },
          overallRiskScore: { type: 'number', example: 9 },
          riskLevel: {
            type: 'string',
            enum: ['Low', 'Medium', 'High', 'Critical'],
            example: 'Low',
          },
          assessmentStatus: {
            type: 'string',
            enum: ['Cleared', 'Flagged', 'Blocked'],
            example: 'Cleared',
          },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },

      // Standard validation error response
      ValidationError: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'error' },
          message: { type: 'string', example: 'Validation failed' },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string', example: 'accountNumber' },
                message: { type: 'string', example: 'Account number must be at least 7 digits' },
              },
            },
          },
        },
      },

      // Standard not found error response
      NotFoundError: {
        type: 'object',
        properties: {
          status: { type: 'string', example: 'error' },
          message: { type: 'string', example: 'Assessment with reference ID PAY-20260412-001558-4821 not found' },
        },
      },
    },
  },

  // API endpoint definitions
  // Each path defines the HTTP method, parameters, request body and responses
  paths: {

    // Health check endpoint
    '/health': {
      get: {
        summary: 'Health check',
        description: 'Verifies the server is running and responsive',
        tags: ['Health'],
        responses: {
          200: {
            description: 'Server is running',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    timestamp: { type: 'string', example: '2026-04-12T00:15:58.696Z' },
                    service: { type: 'string', example: 'SentinelPay API' },
                    version: { type: 'string', example: '1.0.0' },
                  },
                },
              },
            },
          },
        },
      },
    },

    // POST assess endpoint
    '/api/assessments/assess': {
      post: {
        summary: 'Submit payment for risk assessment',
        description:
          'Evaluates a payment against 5 weighted risk factors and returns a ' +
          'composite risk score, risk level, and actionable recommendation',
        tags: ['Assessments'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/AssessPaymentInput' },
            },
          },
        },
        responses: {
          201: {
            description: 'Assessment completed successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    message: { type: 'string', example: 'Payment assessment completed' },
                    data: { $ref: '#/components/schemas/AssessmentResult' },
                  },
                },
              },
            },
          },
          400: {
            description: 'Validation error — invalid request body',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ValidationError' },
              },
            },
          },
          500: {
            description: 'Internal server error',
          },
        },
      },
    },

    // GET single assessment endpoint
    '/api/assessments/{referenceId}': {
      get: {
        summary: 'Get assessment by reference ID',
        description: 'Retrieves a single assessment by its human readable reference ID',
        tags: ['Assessments'],
        parameters: [
          {
            name: 'referenceId',
            in: 'path',
            required: true,
            description: 'Reference ID in PAY-YYYYMMDD-HHMMSS-XXXX format',
            schema: {
              type: 'string',
              example: 'PAY-20260412-001558-4821',
            },
          },
        ],
        responses: {
          200: {
            description: 'Assessment found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    data: { $ref: '#/components/schemas/AssessmentResult' },
                  },
                },
              },
            },
          },
          404: {
            description: 'Assessment not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/NotFoundError' },
              },
            },
          },
          500: {
            description: 'Internal server error',
          },
        },
      },
    },

    // GET list assessments endpoint
    '/api/assessments': {
      get: {
        summary: 'Get paginated list of assessments',
        description: 'Retrieves a paginated and optionally filtered list of assessments',
        tags: ['Assessments'],
        parameters: [
          {
            name: 'riskLevel',
            in: 'query',
            required: false,
            description: 'Filter by risk level',
            schema: {
              type: 'string',
              enum: ['Low', 'Medium', 'High', 'Critical'],
            },
          },
          {
            name: 'assessmentStatus',
            in: 'query',
            required: false,
            description: 'Filter by assessment status',
            schema: {
              type: 'string',
              enum: ['Cleared', 'Flagged', 'Blocked'],
            },
          },
          {
            name: 'limit',
            in: 'query',
            required: false,
            description: 'Number of records to return per page — defaults to 10',
            schema: { type: 'integer', example: 10 },
          },
          {
            name: 'skip',
            in: 'query',
            required: false,
            description: 'Number of records to skip — defaults to 0',
            schema: { type: 'integer', example: 0 },
          },
        ],
        responses: {
          200: {
            description: 'List of assessments with pagination metadata',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/AssessmentSummary' },
                    },
                    pagination: {
                      type: 'object',
                      properties: {
                        total: { type: 'integer', example: 42 },
                        limit: { type: 'integer', example: 10 },
                        skip: { type: 'integer', example: 0 },
                        totalPages: { type: 'integer', example: 5 },
                        currentPage: { type: 'integer', example: 1 },
                      },
                    },
                  },
                },
              },
            },
          },
          500: {
            description: 'Internal server error',
          },
        },
      },
    },
  },
};

// swagger-jsdoc options
// apis array would point to route files if using JSDoc comment approach
// Since we define everything above we pass an empty array
const options = {
  definition: swaggerDefinition,
  apis: [],
};

// Generate the OpenAPI specification object
// This is passed to swagger-ui-express to render the docs page
export const swaggerSpec = swaggerJsdoc(options);