import { Collection } from 'mongodb';
import { getDB } from '../config/db';
import { IAssessmentDocument, IAssessmentSummary } from '../interfaces/assessment.interface';
import { GetAssessmentsQuery } from '../models/assessment.model';

// Name of MongoDB collection where assessments are stored
// Defined as a constant to avoid typos across multiple methods
const COLLECTION_NAME = 'assessments';

// AssessmentRepository encapsulates all direct MongoDB operations
// No business logic lives here, only data access
// The service layer calls these methods and handles the results
export class AssessmentRepository {

    // Returns the typed MongoDB collection instance
    // Called inside each method ratehr than stored as a class property
    // This ensures we always get a fresh reference after DB connections
    // Collection is typed with IAssessmentDocument for type safety
    private getCollection(): Collection<IAssessmentDocument> {
        return getDB().collection<IAssessmentDocument>(COLLECTION_NAME);
    }

    // Saves a new assessment document to MongoDB
    // Called by the service layer after all risk calculations are complete
    //  Returns the full saved document including MongoDB generated _id
    async createAssessment(document: IAssessmentDocument): Promise<IAssessmentDocument> {
        try {
            const collection = this.getCollection();

            // insertsOne saves the document to MongoDB
            // results contains metadata about the operations
            // including the auto generated ObjectId
            const result = await collection.insertOne(document);

            // Spread the original document and attach the generated _id
            // so the caller received the complete persisted record
            return {
                ...document,
                _id: result.insertedId,
            };
        }
        catch (error) {
            throw new Error(`Failed to create assessment: ${error}`);
        }
    }

    // Retrieves a single assessment by a human readable refrenceID
    // Returns null if no matching document is found
    // Controller converts null to a 404 HTTP response
    async getAssessmentByRefereneId(referenceId: string): Promise<IAssessmentDocument | null> {
        try {
            const collection = this.getCollection()

            // findOne returns the first matching document or null
            // We query by referenceId not _id because referenceId is the human readable identifier exposed in our API
            return await collection.findOne({ referenceId });
        }
        catch (error) {
            throw new Error(`Failed to retrieve assessment ${referenceId}`);
        }
    }

    // Retrieves a paginated and optionally filtered list of assessments
    // Retruns lightweight IAssessmentSummary objects - not full documents
    // riskFactors and reccomendations are excluded to keep list responses fast
    async getAssessments(query: GetAssessmentsQuery): Promise<IAssessmentSummary[]> {
        try {
            const collection = this.getCollection();

            // Build the MongoDB filter object dynamically
            // Only add a condition if the query parameter was provided
            // An empty filter {} matches and return all documents
            const filter: Record<string, unknown> = {};

            if (query.riskLevel) {
                // Filter to only return assessments matching the requested risk level
                // Ex: riskLevel = High returns only High risk assessments
                filter.riskLevel = query.riskLevel;
            }

            // Filter to only return assessments matching the requested status
            // Ex:  assessmentStatus = Blocked returns only blocked assessments
            if (query.assessmentStatus) {
                filter.assessmentStatus = query.assessmentStatus;
            }

            // Convert pagination string values to integers
            // Query parameters always arrive as strings from the URL
            // Ex: ?limit=10&skip=20 arrives as { limit: "10", skip: "20" }
            // Default to 10 records per page starting from the first record
            const limit = query.limit ? parseInt(query.limit, 10) : 10;
            const skip = query.skip ? parseInt(query.skip, 10) : 0;

            // Projection tells MongoDB which fields to include or exclude
            // 1 = include this field, 0 = exclude this field
            // We exclude riskFactors and reccomendation to keep the list response lightweight
            // Full details avaiable via referenceId
            const projection = {
                _id: 0,              // Exclude MongoDB internal ObjectId
                referenceId: 1,      // Include human readable reference ID
                accountNumber: 1,    // Include account number
                payeeName: 1,        // Include payee name
                paymentAmount: 1,    // Include payment amount
                overallRiskScore: 1, // Include composite risk score
                riskLevel: 1,        // Include risk classification
                assessmentStatus: 1, // Include assessment outcome
                createdAt: 1,        // Include creation timestamp
            };

            // Chain MongoDB cursor operations:
            // find()    — applies the filter to match documents
            // project() — applies the field projection
            // sort()    — orders results by newest first (-1 = descending)
            // skip()    — skips N records for pagination
            // limit()   — caps the number of records returned
            // toArray() — executes the query and materializes results
            const results = await collection
                .find(filter)           // 1. match documents
                .sort({ createdAt: -1 }) // 2. sort first — newest first
                .skip(skip)             // 3. then skip
                .limit(limit)           // 4. then limit
                .project(projection)    // 5. then shape fields
                .toArray();             // 6. execute query

            // Cast results to IAssessmentSummary since our projection
            // guarantees only summary fields are present in each document
            return results as unknown as IAssessmentSummary[];

        }
        catch (error) {
            throw new Error(`Failed to retrieve assessments: ${error}`)
        }
    }

    // Returns the total count of documents matching the same filters
    // As getAssessments() - used to calculate total pages available
    // Ex: totalPages = Math.ciel(total/limit)
    async countAssessments(query: GetAssessmentsQuery): Promise<number> {
        try {
            const collection = this.getCollection();

            // Build the same filter as getAssessments()
            // so the count accurately reflects the filtered result set
            const filter: Record<string, unknown> = {};

            if (query.riskLevel) {
                filter.riskLevel = query.riskLevel;
            }

            if (query.assessmentStatus) {
                filter.assessmentStatus = query.assessmentStatus;
            }

            // countDocuments returns the number of documents matching the filter
            return await collection.countDocuments(filter);
        } catch (error) {
            throw new Error(`Failed to count assessments: ${error}`);
        }
    }
}