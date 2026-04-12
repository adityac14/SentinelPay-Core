import { Router } from 'express';
import { assessmentController } from '../controllers/assessment.controller';
import { validate } from '../middleware/validate.middleware';
import {
    AssessPaymentSchema,
    GetAssessmentSchema,
    GetAssessmentsQuerySchema,
} from '../models/assessment.model';

// Create a new Express Router instance
// Router handles all assessment related endpoints
// Registered in app.ts under the /api/aessments base path
const router = Router();

// POST /api/assessments/assess
// Submits payment details for risk assessment
// Middleware chain:
// 1. validate(AssessPaymentSchema, 'body') — validates request body fields
// 2. assessmentController.assess — processes the assessment and returns result
//
// Request body: { accountNumber, payeeName, bankCode, paymentAmount }
// Response: 201 with full assessment result including risk factors and score
router.post('/assess', validate(AssessPaymentSchema, 'body'), (req, res) => assessmentController.assess(req, res))


// GET /api/assessments/:referenceId
// Retrieves a single assessment by its reference ID
// Middleware chain:
// 1. validate(GetAssessmentSchema, 'params') — validates referenceId format
// 2. assessmentController.getOne — fetches and returns the assessment
//
// URL param: referenceId must match PAY-YYYYMMDD-HHMMSS-XXXX format
// Response: 200 with full assessment or 404 if not found
router.get('/:referenceId', validate(GetAssessmentSchema, 'params'), (req, res) => assessmentController.getOne(req, res));

// GET /api/assessments
// Retrieves a paginated and optionally filtered list of assessments
// Middleware chain:
// 1. validate(GetAssessmentsQuerySchema, 'query') — validates query parameters
// 2. assessmentController.getAll — fetches and returns paginated list
//
// Query params (all optional):
// riskLevel        — filter by Low / Medium / High / Critical
// assessmentStatus — filter by Cleared / Flagged / Blocked
// limit            — number of records per page (default 10)
// skip             — number of records to skip (default 0)
// Response: 200 with assessment list and pagination metadata
router.get('/', validate(GetAssessmentsQuerySchema, 'query'), (req, res) => assessmentController.getAll(req, res));

export { router as assessmentRoutes };