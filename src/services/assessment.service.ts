import { AssessmentRepository } from "../repositories/assessment.repository";

import {
    RiskLevel,
    AssessmentStatus,
    IRiskFactor,
    IAssessmentDocument,
    IAssessmentResult,
    IAssessmentSummary
} from '../interfaces/assessment.interface';

import {
    AssessPaymentInput,
    GetAssessmentsQuery
} from '../models/assessment.model';

// Valid Canadian bank instiution codes
// Source: Payments Canada - these are the major Canadian financial institutions
// Any bank code not in this list triggers the bank code validitiy risk factor
const VALID_BANK_CODES: string[] = [
    '001', // BMO — Bank of Montreal
    '002', // Scotiabank
    '003', // RBC — Royal Bank of Canada
    '004', // TD — Toronto-Dominion Bank
    '006', // National Bank of Canada
    '010', // CIBC — Canadian Imperial Bank of Commerce
    '016', // HSBC Canada
    '030', // Canadian Western Bank
    '039', // Laurentian Bank
    '117', // Bank of Canada
]

// Payment amounts above this threshold trigger the amount anomaly risk factor
// $50,000 is considered a high value transaction in the Canadian retail context
const HIGH_AMOUNT_THRESHOLD = 50000;

// Risk score thresholds for each risk level classification
// Scores are compared against these values in the determineRiskLevel()
const RISK_THRESHOLDS = {
    CRITICAL: 90, // 90-100 → Critical → Blocked
    HIGH: 70,     // 70-89  → High    → Flagged
    MEDIUM: 40,   // 40-69  → Medium  → Flagged
    LOW: 0,       // 0-39   → Low     → Cleared
};

// AssesmentService contains all business logic for payment risk assessment
// It orchestrates the full assessment workflow and delegates data access to the repository (never speaks to MongoDB directly)
export class AssessmentService {
    // Repository instance received via constructor injection
    // The service declares what it needs but it doesn't create it
    // Makes it easy to inject a mock repository during Jest testing
    private repository: AssessmentRepository;

    constructor(repository: AssessmentRepository) {
        this.repository = repository;
    }

    // ─── Public Methods ───────────────────────────────────────────────────────

    // Main entry point - orchestrates the full payment risk assessment workflow
    // Called by the controller when POST /api/assessments/assess is received
    // Steps: calculates risk factors -> score -> classify -> save -> return result
    async assessPayment(input: AssessPaymentInput): Promise<IAssessmentResult> {
        // Step 1 - Evaluate each risk factor indepently
        // Each private method returns an IRiskFactor with score and description
        const riskFactors: IRiskFactor[] = [
            this.assessBankCodeValidity(input.bankCode),
            this.assessAmountAnomaly(input.paymentAmount),
            this.assessAccountNumberPattern(input.accountNumber),
            this.assessPayeeNameRisk(input.payeeName),
            this.assessTransactionVelocity(input.paymentAmount),
        ];

        // Step 2 - Calculate the weighted average score across all factors
        // Each factor contributes proportionally based on its weight
        // All weights must sum to 1.0
        const overallRiskScore = this.calculateOverallScore(riskFactors);

        // Step 3 - Classify the overall score into a RiskLevel enum value
        // Low / Medium / High / Critical
        const riskLevel = this.determineRiskLevel(overallRiskScore);

        // Step 4 - Determine the actionable outcome based on risk level
        // Cleared / Flagged / Blocked
        const assessmentStatus = this.determineAssessmentStatus(riskLevel);

        // Step 5 - Generate a human readable reccomendation for the API caller
        const recommendation = this.generateReccomendation(
            assessmentStatus,
            overallRiskScore
        )

        // Step 6 — Generate a unique traceable reference ID for this assessment
        // Format: PAY-YYYYMMDD-HHMMSS-XXXX Ex: PAY-20260412-001558-4821
        // Date and time components make the ID naturally traceable
        // Random suffix prevents collisions within the same second
        const referenceId = this.generateReferenceId();

        // Step 7 - Assemble the complete document to persist to MongoDB
        // combines validated input with all calculated assessment results
        const document: IAssessmentDocument = {
            referenceId,
            accountNumber: input.accountNumber,
            payeeName: input.payeeName,
            bankCode: input.bankCode,
            paymentAmount: input.paymentAmount,
            riskFactors,
            overallRiskScore,
            riskLevel,
            assessmentStatus,
            recommendation,
            createdAt: new Date(),
        };

        // Step 8 - Persist the assembled document MongoDB via the repository
        // The repository handles all direct databse interactions
        const saved = await this.repository.createAssessment(document);

        // Step 9 - Map the saved document to the clean API response format
        // Strips internal MongoDB fields like _id before returning to the controller
        return this.mapToResult(saved);
    }

    // Retrieves a single assessment by its human readable referenceID
    // Returns null if no matching document found
    // Controller converts null into a 404 HTTP response
    async getAssessmentByReferenceID(referenceId: string): Promise<IAssessmentResult | null> {
        const document = await this.repository.getAssessmentByRefereneId(referenceId);

        // Return null if no document found - this is a normal expected outcome
        // not an error condition - the controller handles the 404 HTTP response
        if (!document) return null;

        return this.mapToResult(document);
    }

    // Retrieves a paginated and optionally filtered list of assessments
    // Runs list query and count query concurrently for better performance
    // Returns assessments alongside pagination metadata for the caller
    async getAssessments(query: GetAssessmentsQuery): Promise<{ assessments: IAssessmentSummary[]; total: number; limit: number; skip: number; }> {

        // Run both queries concurrently using Promise.all
        // Sequential execution would wait for the list before counting - slower
        // Concurrent execution runs both simultaneously - faster response time
        const [assessments, total] = await Promise.all([
            this.repository.getAssessments(query),
            this.repository.countAssessments(query)
        ]);

        // Prase pagination values back to integers for the response
        // They arriave as strings from the query params so we convert here
        return {
            assessments,
            total,
            limit: query.limit ? parseInt(query.limit, 10) : 10,
            skip: query.skip ? parseInt(query.skip, 10) : 0,
        };
    }

    // ─── Private Risk Factor Methods ──────────────────────────────────────────

    // Risk Factor 1 - A Bank Code Validity (weight: 0.20)
    // Checks if the provided bank code matches a known Canadian institution
    // An unrecognized bank code is a strong indicator of a fradulent account
    // Valid bank code scores 0 - no risk
    // Invalid bank scores 90 - very high risk
    private assessBankCodeValidity(bankCode: string): IRiskFactor {

        const isValid = VALID_BANK_CODES.includes(bankCode);

        return {
            factor: 'Bank Code Validity',
            score: isValid ? 0 : 90,
            weight: 0.20,
            description: isValid
                ? `Bank code ${bankCode} is a recognized Canadian financial institution`
                : `Bank code ${bankCode} is not a recognized Canadian institution — potential fraud risk`,
        };
    }

    // Risk Factor 2 - Amount Anomally (weight 0.30)
    // Checks if the payment amount is unusually large compared to the threshold
    // large unexpected payments are one of the strongest fraud signals
    // This factor carries the highest weight - 30% of total score
    // Score scales proportionally based on how far the amount exceeds the threshold
    private assessAmountAnomaly(amount: number): IRiskFactor {

        // If above threshold - score scales based on how far above it is
        // Capped at 100 so score never exceeds the maximum possible value
        // If below thresold - score scales proportionally the amount
        const score = amount > HIGH_AMOUNT_THRESHOLD
            ? Math.min(100, Math.round((amount / HIGH_AMOUNT_THRESHOLD) * 50))
            : Math.round((amount / HIGH_AMOUNT_THRESHOLD) * 30);

        return {
            factor: 'Amount Anomaly',
            score,
            weight: 0.30,
            description: amount > HIGH_AMOUNT_THRESHOLD
                ? `Payment of $${amount.toLocaleString()} exceeds the high risk threshold of $${HIGH_AMOUNT_THRESHOLD.toLocaleString()}`
                : `Payment of $${amount.toLocaleString()} is within the normal transaction range`,
        }
    }

    // Risk Factor 3 — Account Number Pattern (weight: 0.20)
    // Checks for suspicious patterns in the account number
    // Fraudsters often use test accounts with easily guessable numbers
    // Repeating digits e.g. 1111111 or sequential e.g. 1234567 are suspicious
    private assessAccountNumberPattern(accountNumber: string): IRiskFactor {

        // Repeating digits - entire string is the same digit repeated
        // REgex: match a single digit then check the entire string is that digit
        const hasRepeatingDigits = /^(\d)\1+$/.test(accountNumber);

        // Sequential digits - ascending or descending by 1 each step
        // Detected by isSequentialNumber helper method below
        const isSequential = this.isSequentialNumber(accountNumber);

        const isSuspicious = hasRepeatingDigits || isSequential;

        return {
            factor: 'Account Number Pattern',
            score: isSuspicious ? 85 : 5,
            weight: 0.20,
            description: isSuspicious
                ? `Account number ${accountNumber} contains suspicious patterns — repeating or sequential digits detected`
                : `Account number ${accountNumber} shows no suspicious patterns`,
        };
    }

    // Risk factor 4 - Payee Name Risk (weight: 0.15)
    // Checks for suspicious patterns in the payee name
    // Fradulent accounts often use genertic, test, or numeric names
    // Real people and businesses have more meaningful names of reasonable length
    private assessPayeeNameRisk(payeeName: string): IRiskFactor {

        // Common keywords found in a fradulent or test payee names
        // These are generic placeholders rather than real person or business names
        const suspiciousKeywords = [
            'test', 'fake', 'temp', 'dummy',
            'anonymous', 'unknown', 'cash',
        ];

        const nameLower = payeeName.toLowerCase();

        // Checks if any suspicious keyword appears anywhere in the name
        const hasSuspiciousKeyword = suspiciousKeywords.some(keyword => nameLower.includes(keyword));

        // Names shorter than 3 character are unlikely to be legitmiate
        const isTooShort = payeeName.trim().length < 3;

        // A name consisting entirely of numbers is not a valid person or business
        // Ex: "1234567" as a payee name is highly suspicious
        const isNumericOnly = /^\d+$/.test(payeeName.trim());

        const isSuspicious = hasSuspiciousKeyword || isTooShort || isNumericOnly

        return {
            factor: "Payee Name Risk",
            score: isSuspicious ? 75 : 5,
            weight: 0.15,
            description: isSuspicious
                ? `Payee name "${payeeName}" contains suspicious patterns`
                : `Payee name "${payeeName}" shows no suspicious patterns`,
        }
    }

    // Risk Factor 5 - Transaction Velocity (weight: 0.15)
    // Checks for suspicious amount patterns commonly used in payment fraud
    // Round numbers are used to test accounts without raising alerts
    // Micro amounts under $10 are used to probe if an account is active
    private assessTransactionVelocity(amount: number): IRiskFactor {

        // Exactly round numbers disvisble by 1000 are suspicious
        // Ex: Exactly $1000, $5000, $10000 - no cents, perfectly rounded
        const isRoundNumber = amount % 1000 === 0 && amount >= 1000;

        // Very Small amounts under $10 are cmmonly used to probe accounts
        // Fraudsters test with tiny amounts before attempting large transfers
        const isProbeAmount = amount < 10

        const isSuspicious = isRoundNumber || isProbeAmount

        return {
            factor: 'Transaction Velocity',
            score: isSuspicious ? 60 : 10,
            weight: 0.15,
            description: isSuspicious
                ? `Payment of $${amount.toLocaleString()} matches fraud probing patterns — round number or micro transaction detected`
                : `Payment of $${amount.toLocaleString()} shows no suspicious velocity patterns`,
        };
    }

    // ─── Private Helper Methods ───────────────────────────────────────────────

    // Calculates the weighted average score across all risk factors
    // Formula: sum of (each factor score * its weight)
    // reduce() starts with 0 and accumulates teh weighted sum iteratively
    // All factor weights must sum to 1.0 for result to stay on a 0-100 scale
    private calculateOverallScore(factors: IRiskFactor[]): number {
        const weightedSum = factors.reduce(
            (sum, factor) => sum + factor.score * factor.weight, 0
        );

        // Round to the nearest whole number
        // Risk scores are always integers - deciaml scores would be misleading
        return Math.round(weightedSum);
    }

    // Classifies the overall risk score into a RiskLevel enum value 
    // Checks from highest threshold to lowest so the first match wins
    // Uses RISK_THRESHOLDS constants defined at the top of this file
    private determineRiskLevel(score: number): RiskLevel {
        if (score >= RISK_THRESHOLDS.CRITICAL) return RiskLevel.CRITICAL;
        if (score >= RISK_THRESHOLDS.HIGH) return RiskLevel.HIGH;
        if (score >= RISK_THRESHOLDS.MEDIUM) return RiskLevel.MEDIUM;
        return RiskLevel.LOW;
    }

    // Maps each RiskLevel to its corresponding AssessmentStatus
    // Using Record<RiskLevel, AssessmentStatus> ensures every possible RiskLvl value has a defined status
    // TypeScript will error if a new RiskLevel is added without a mapping
    private determineAssessmentStatus(riskLevel: RiskLevel): AssessmentStatus {
        const statusMap: Record<RiskLevel, AssessmentStatus> = {
            [RiskLevel.LOW]: AssessmentStatus.CLEARED,      // Low risk — safe to proceed
            [RiskLevel.MEDIUM]: AssessmentStatus.FLAGGED,   // Medium risk — review needed
            [RiskLevel.HIGH]: AssessmentStatus.FLAGGED,     // High risk — review needed
            [RiskLevel.CRITICAL]: AssessmentStatus.BLOCKED, // Critical risk — block payment
        };
        return statusMap[riskLevel];
    }

    // Generates a human readable actionable reccomendation for the API caller
    // Tells the caller exactly what to do, not just what the score is
    // Using Record<AssessmentStatus, string> ensures every status has a messages
    private generateReccomendation(status: AssessmentStatus, score: number): string {

        const reccomendations: Record<AssessmentStatus, string> = {
            [AssessmentStatus.CLEARED]:
                `Risk score ${score}/100 — payment cleared. No significant risk factors detected. Safe to proceed.`,
            [AssessmentStatus.FLAGGED]:
                `Risk score ${score}/100 — payment flagged. One or more risk factors detected. Manual review recommended before processing.`,
            [AssessmentStatus.BLOCKED]:
                `Risk score ${score}/100 — payment blocked. Critical risk factors detected. Do not process. Contact fraud team immediately.`,
        };

        return reccomendations[status];
    }

    // Generates a unique traceable reference ID for each assessment
    // Format: PAY-YYYYMMDD-HHMMSS-XXXX
    // e.g. PAY-20260412-001558-4821
    //
    // Components:
    // PAY      — constant prefix identifying this as a payment assessment
    // YYYYMMDD — date the assessment was created e.g. 20260412
    // HHMMSS   — time the assessment was created e.g. 001558 (00:15:58)
    // XXXX     — random 4 digit suffix to prevent same-second collisions
    private generateReferenceId(): string {
        const now = new Date()

        // Extract and pad date components
        // padStart(2, '0') ensures single digit values are zero padded
        // Ex: January 01 not 1, day 5 = 05 not 5
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0'); // getMonth() is 0 indexed
        const day = String(now.getDate()).padStart(2, '0');

        // Extract and pad time components
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');

        // Generate a random number between 0 and 9999
        // Math.random() returns 0 to 0.9999... so * 10000 gives 0 to 9999.9...
        // Math.floor() rounds down to give a whole integer 0-9999
        const randomNum = Math.floor(Math.random() * 10000);

        // Zero pad the random number to always be 4 digits
        // e.g. 7 becomes 0007, 42 becomes 0042, 999 becomes 0999
        // This ensures the reference ID always has a consistent length
        const formattedRNG = randomNum.toString().padStart(4, '0');
        // Assemble and return reference ID in PAY-YYYYMMDD-HHMMSS-XXXX format
        return `PAY-${year}${month}${day}-${hours}${minutes}${seconds}-${formattedRNG}`;
    }

    // Checks if a numeric string contains purely sequential digits
    // Ascending sequential Ex: "1234567", each digit is previous + 1
    // Descending sequential Ex: "9876543", each digit is previous - 1
    // Non-sequential e.g. "1234562" — pattern breaks — not suspicious
    private isSequentialNumber(str: string): boolean {
        const digits = str.split('').map(Number);

        // every() returns true only if ALL elments satisfy the condition
        // i === 0 skips the first element, no previous digit to compare to
        const isAscending = digits.every(
            (digit, i) => i === 0 || digit === digits[i - 1] + 1
        );

        const isDecending = digits.every(
            (digit, i) => i === 0 || digit === digits[i - 1] - 1
        )

        return isAscending || isDecending;
    }

    // Maps an IAssessmentDocument to an IAssessmentResult for the API response 
    // Strips internal MongoDB fields like _id that callers should never see
    // Returns only the fields defined in the IAssessmentResult interface
    // Explicit field mapping rather than spread prevents accidental data leaks
    private mapToResult(doc: IAssessmentDocument): IAssessmentResult {
        return {
            referenceId: doc.referenceId,
            accountNumber: doc.accountNumber,
            payeeName: doc.payeeName,
            paymentAmount: doc.paymentAmount,
            overallRiskScore: doc.overallRiskScore,
            riskLevel: doc.riskLevel,
            assessmentStatus: doc.assessmentStatus,
            riskFactors: doc.riskFactors,
            recommendation: doc.recommendation,
            createdAt: doc.createdAt,
        };
    }
}
