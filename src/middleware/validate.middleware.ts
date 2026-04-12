import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';

// ValidateSource defines which part of the HTTP request to validate
// body   — POST request payload e.g. { accountNumber, payeeName, ... }
// params — URL parameters e.g. /api/assessments/:referenceId
// query  — URL query string e.g. ?riskLevel=High&limit=10
type ValidateSource = 'body' | 'params' | 'query';

// Validate is a middleware factory function
// It takes a Zod schema and a source location then returns an Express middleware
// The returned middleware validates the request data against the schema
// If validation passes — calls next() to continue to the controller
// If validation fails — returns a 400 response with detailed error messages
//
// Usage in routes:
// router.post('/assess', validate(AssessPaymentSchema, 'body'), controller.assess)
// router.get('/:referenceId', validate(GetAssessmentSchema, 'params'), controller.getOne)
// router.get('/', validate(GetAssessmentsQuerySchema, 'query'), controller.getAll)
export const validate = (
    // z.ZodType is the correct Zod v4 type for accepting any Zod schema
    // z.ZodTypeAny and ZodSchema are both deprecated aliases for z.ZodType
    schema: z.ZodType,
    source: ValidateSource = 'body'
) => {
    // Returns the actual Express midleware function
    // Express calls this with req, res, next for every matching request
    return (req: Request, res: Response, next: NextFunction): void => {
        try {
            // Extract the data to validate from the corrrect part of the request
            // req.body - parsed JSON body from POST/PUT requests
            // req.params - dynamic URL segments Ex: :referenceId
            // req.query - query string parameters ex: ? limit=10
            const dataToValidate = req[source];

            // safeParse validates without throwing - returns success or error object
            // We use safeParse instead of parse so we can handle errors gracefully
            // rather than letting Zod throw an uncaught exception
            const result = schema.safeParse(dataToValidate);

            if (!result.success) {
                // Validation failed - extract and format the error messages
                // result.error is a ZodError containing an array of issues
                const errors = formatZodErrors(result.error);

                // Return 400 Bad Request with structured error response
                // 400 means the client sent invalid data - their problem to fix
                res.status(400).json({
                    status: 'error',
                    message: 'Validation failed',
                    errors,
                });

                // Return early - do not call next()
                // This stops the request from reaching the controller
                return;
            }

            // Validation passed - attach the validated and typed data back to the request object so the controller receives clean data
            req[source] = result.data

            // Call next to pass control to the next middleware or controller
            next();

        }
        catch (error) {
            // Catch any unexpected errors during validation
            // PAsses to Express global error handler
            next(error)

        }
    }

}

// Formats a ZodError into a clean array of field/message pairs
// Makes it easy for API callers to identify exactly which fields failed
//
// Example output:
// [
//   { field: 'accountNumber', message: 'Account number must be at least 7 digits' },
//   { field: 'bankCode', message: 'Bank code must be exactly 3 characters' }
// ]
const formatZodErrors = (error: ZodError) => {
    return error.issues.map(issue => ({
        // issue.path is an array of keys showing where the error occurred
        // e.g. ['accountNumber'] or ['address', 'postCode'] for nested objects
        // join('.') converts it to dot notation e.g. 'address.postCode'
        // If path is empty the error is at root level — we show 'root'
        field: issue.path.length > 0 ? issue.path.join('.') : 'root',
        // issue.message is the human readable validation error message
        // defined in our Zod schema
        message: issue.message,
    }));
};