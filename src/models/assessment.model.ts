// Import enums from our interface file
import { RiskLevel, AssessmentStatus } from '../interfaces/assessment.interface';

import { z } from 'zod';

// Extract enum values into Zod-compatible tuples
// Object.values() converts the enum to an array of its string values
// The 'as' cast tells TypeScript this is a non-empty tuple which z.enum() requires
const RiskLevelValues = Object.values(RiskLevel) as [string, ...string[]];
const AssessmentStatusValues = Object.values(AssessmentStatus) as [string, ...string[]];


// Schema for validating POST /api/assessments/assess request body
// These are the fields the caller provides to initiate a risk assessment
export const AssessPaymentSchema = z.object({

    // Account number - digits only, 12 characters
    // Matches standard Canadian bank account number format
    accountNumber: z.string()
        .min(7, 'Account number must be at least 7 digits')
        .max(12, 'Account number must be no more than 12 digits')
        .regex(/^\d+$/, 'Account number must contain digits only'),

    //Payee name - the name associated with the account being paid
    payeeName: z.string()
        .min(2, 'Payee name must be at least 2 characters')
        .max(100, 'Payee name must be no more than 100 characters'),

    bankCode: z.string()
        .length(3, 'Bank code must be exactly 3 characters')
        .regex(/^\d{3}$/, 'Bank code must be 3 digits'),

    // Payment amount - must be a positive number
    // Assessed as part of transaction anomaly risk factor
    paymentAmount : z.number()
        .positive('Payment amount must be greater than zero')
        .max(1000000, 'Payment amount exceeds maximum single transaction limit'),
});

// Schema for validating GET /api/assessments/:referenceId
// referenceId is our human-readable ID e.g. PAY-2024-001
export const GetAssessmentSchema = z.object({
    referenceId: z.string()
        .min(1, 'Reference ID is required')
        .regex(/^PAY-\d{4}-\d{3,}$/, 'Invalid reference ID format'),
})

// Schema for validating query parameters on GET /api/assessments
// Supports filtering by risk level, status, and pagination
export const GetAssessmentsQuerySchema = z.object({
    // Derives valid values directly from RiskLevel enum
    riskLevel: z.enum(RiskLevelValues as [RiskLevel, ...RiskLevel[]]).optional(),

    // Derives valid values directly from AssessmentStatus enum
    assessmentStatus: z.enum(AssessmentStatusValues as [AssessmentStatus, ...AssessmentStatus[]]).optional(),

    // Pagination controls
    limit: z.string().regex(/^\d+$/, 'Limit must be a number').optional(),
    skip: z.string().regex(/^\d+$/, 'Skip must be a number').optional(),
})

// Derive TypeScript types from Zod schemas
export type AssessPaymentInput = z.infer<typeof AssessPaymentSchema>;
export type GetAssessmentInput = z.infer<typeof GetAssessmentSchema>;
export type GetAssessmentsQuery = z.infer<typeof GetAssessmentsQuerySchema>;
