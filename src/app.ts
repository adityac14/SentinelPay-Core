import express, { Application } from 'express';

// Import assessment routes - will be under api/assessments
import {assessmentRoutes} from './routes/assessment.routes';

// Create the Express application instance
// Typed as Application for better TypeScript support
const app: Application = express();

// Middleware: parse incoming JSON request bodies
// Without this req.body would be undefined for POST requests
app.use(express.json());

// Middleware: parse URL encoded form data
// extended: false uses the built-in querying library
app.use(express.urlencoded({ extended: false }));

// Health check endpoint
// Used to verify the server is running and responsive
// Useful for monitoring tools, load balancers, and deployment pipelines
// Returns current timestamp so you can see when the server last responded
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'SentinelPay-Core API',
        version: '1.0.0',
    });
});

// Register assessment routes under /api/assessments base path
// All assessment endpoints will be prefixed with this path
// e.g. POST /api/assessments/assess
//      GET  /api/assessments
//      GET  /api/assessments/:referenceId
app.use('/api/assessments', assessmentRoutes);

// Global 404 handler
// Catches any request that doesn't match a registered route
// Must be registered AFTER all other routes
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.method} ${req.url} not found`,
  });
});

// Export the configured app instance
// Imported by server.ts to start listening
// Imported by Jest tests to simulate HTTP requests without starting the server
export default app;