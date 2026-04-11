import { ObjectId } from "mongodb";

// Risk level classification based on the overall risk score
// Low: 0-39, Medium: 40-69, High: 70-89, Critical: 90-100
export enum RiskLevel {
    LOW = 'Low',           // Payment appears safe to proceed
    MEDIUM = 'Medium',     // Some concerns — proceed with caution
    HIGH = 'High',         // Multiple risk factors — recommend review
    CRITICAL = 'Critical', // Severe risk indicators — block payment
}

// Assessment status reflecting the outcome of the risk evaulation
export enum AssessmentStatus {
    CLEARED = 'Cleared',       // Risk score below threshold — safe
    FLAGGED = 'Flagged',       // Risk score above threshold — review needed
    BLOCKED = 'Blocked',       // Critical risk — payment should not proceed
}

export interface IRiskFactor {
    factor: string;        // Name of the risk factor e.g. "Account Age Risk"
    score: number;         // This factor's contribution to the overall score 0-100
    weight: number;        // How much this factor influences the final score 0-1
    description: string;   // Human readable explanation of why this scored as it did
}

// Represents a payment risk assessment record stored in MongoDB
export interface IAssessmentDocument {
  _id?: ObjectId;                    // MongoDB auto-generated document ID
  referenceId: string;               // Unique human-readable reference e.g. PAY-2024-001
  accountNumber: string;             // Account number being assessed
  payeeName: string;                 // Name of the payee being assessed
  bankCode: string;                  // 3-digit Canadian bank institution code
  paymentAmount: number;             // Amount of the payment being assessed
  riskFactors: IRiskFactor[];        // Breakdown of individual risk factors
  overallRiskScore: number;          // Weighted composite score 0-100
  riskLevel: RiskLevel;              // Low / Medium / High / Critical
  assessmentStatus: AssessmentStatus;// Cleared / Flagged / Blocked
  recommendation: string;            // Actionable recommendation for the caller
  createdAt: Date;                   // When this assessment was performed
}

// API response returned to the caller after an assessment
// Structured to give the caller everything they need to make a decision
export interface IAssessmentResult {
  referenceId: string;               // Unique reference for this assessment
  accountNumber: string;             // Account number assessed
  payeeName: string;                 // Payee name assessed
  paymentAmount: number;             // Payment amount assessed
  overallRiskScore: number;          // 0-100 composite risk score
  riskLevel: RiskLevel;              // Low / Medium / High / Critical
  assessmentStatus: AssessmentStatus;// Cleared / Flagged / Blocked
  riskFactors: IRiskFactor[];        // Full breakdown of what drove the score
  recommendation: string;            // What the caller should do next
  createdAt: Date;                   // Timestamp of assessment
}

// Lightweight summary used when returning a list of assessments
// Avoids returning the full risk factor breakdown for every record
export interface IAssessmentSummary {
  referenceId: string;               // Unique reference ID
  accountNumber: string;             // Account number assessed
  payeeName: string;                 // Payee name assessed
  paymentAmount: number;             // Payment amount assessed
  overallRiskScore: number;          // Composite risk score
  riskLevel: RiskLevel;              // Low / Medium / High / Critical
  assessmentStatus: AssessmentStatus;// Cleared / Flagged / Blocked
  createdAt: Date;                   // When assessment was performed
}