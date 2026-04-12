import { Request, Response } from "express";
import { AssessmentService } from "../services/assessment.service";
import { AssessmentRepository } from "../repositories/assessment.repository";
import {
    AssessPaymentInput,
    GetAssessmentInput,
    GetAssessmentsQuery
} from '../models/assessment.model';

// Instanttiate the repository and inject it into the service
// This wires the layers together - controller --> service --> repository --> MongoDB
const repository = new AssessmentRepository();
const service = new AssessmentService(repository);

// AssessmentController handles all HTTP concenrns from assessment endpoints
// It receives validated request data from middleware and delegates all business logic to the service layer
// It never speaks directly to the repository or database
export class AssessmentController {

    // POST /api/assessments/assess
    // Accepts payment details and returns a full risk assessment
    // Request body is pre-validated by validate(AssessPaymentSchema, 'body') middleware
    async assess(req: Request, res: Response): Promise<void> {
        try {
            // req.body is already validated and typed by the middleware
            // We cast it to AssessPaymentInput for TypeScript type Safety
            const input = req.body as AssessPaymentInput;

            // Delegate to the service layer which orchestrates the full assessment workflow
            // Service calculates risk factors, scores, saves to DB and returns result
            const result = await service.assessPayment(input);

            // Return 201 Created a - new assessment record was created
            // Include the full assessment result in the response body
            res.status(201).json({
                status: 'success',
                message: 'Payment assessment completed',
                data: result
            })

        }
        catch (error) {
            // Catch any unexpected errors from the service or repository 
            // Return 500 Internal Server Error with a safe errorr message
            // We don't expose internal error details to the caller for security
            res.status(500).json({
                status: 'error',
                message: 'An unexpected error occured while proessing the assesment',
                erorr: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    // GET /api/assessments/:referenceId
    // Retrieves a single assessment by its human readable reference ID
    // URL param is pre-validated by validated(GetAssessmentsSchema, 'params') middleware
    async getOne(req: Request, res: Response): Promise<void> {
        try {

            // req.params is already validated and typed by the middleware
            // referenceId is guaranteed to match PAY-YYYYMMDD-HHMMSS-XXXX format
            const { referenceId } = req.params as GetAssessmentInput;

            // Delegate to service — returns full assessment result or null if not found
            const result = await service.getAssessmentByReferenceId(referenceId);

            // Service returns null when no matching document is found
            // Returns 404 Not Found with a descriptiive message
            if (!result) {
                res.status(404).json({
                    status: 'error',
                    message: `Assessment with reference ID ${referenceId} not found`,
                });
                return;
            }

            // Assessment found - return 200 Ok with full assessment details
            // Including the complete risk factor breakdown
            res.status(200).json({
                status: 'success',
                data: result
            })

        }
        catch (error) {
            res.status(500).json({
                status: 'error',
                message: 'An unexpected error occurred while retrieving the assessment',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }

    // GET /api/assessments
    // Retrieves a paginated and optionally filtered list of assessments
    async getAll(req: Request, res: Response): Promise<void> {
        try {

            // Query params are stored in res.locals.validatedQuery by the middleware
            // because Express 5 made req.query read-only and we cannot reassign it
            // Fall back to req.query if res.locals.validatedQuery is not set
            const query = (res.locals.validatedQuery || req.query) as GetAssessmentsQuery;

            // Delegate to service — returns assessments list with pagination metadata
            const result = await service.getAssessments(query);

            // Return 200 OK with the assessment list and pagination metadata
            res.status(200).json({
                status: 'success',
                data: result.assessments,
                pagination: {
                    total: result.total,
                    limit: result.limit,
                    skip: result.skip,
                    totalPages: Math.ceil(result.total / result.limit),
                    currentPage: Math.floor(result.skip / result.limit) + 1,
                },
            });

        } catch (error) {
            res.status(500).json({
                status: 'error',
                message: 'An unexpected error occurred while retrieving assessments',
                error: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
}

// Export a single controller instance
// Shared across all route handlers - no state is stored on the instance
// So sharing is safe and avoids unncessary re-installation per client
export const assessmentController = new AssessmentController()

