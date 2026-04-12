import { MongoClient, Db } from 'mongodb';

// No dotenv import here — environment variables are loaded
// once at application startup in server.ts
// By the time connectDB() is called, process.env is already populated

// Read the MongoDB connection string from environment variables
// This keeps credentials out of source code
const uri = process.env.MongoDB_URI || '';

// Read the database name from environment variables
// Defaults to 'payshield' if not specified
const dbName = process.env.DB_Name || 'payshield';

// Create a single MongoClient instance
// MongoClient manages a connection pool internally
// We create it once and reuse it throughout the application
const client = new MongoClient(uri)

// Holds the active database instance once connected
// Declared outside connectDB() so it persists across function calls
// This is the singleton pattern - one instance shared
let db: Db;

// Establishes a connection to MongoDB Atlas
// Called once at server startup in server.ts
// All subsequent calls to getDB() reuse this connection
export const connectDB = async (): Promise<void> => {
    // Checks if a connection already exists, if so do nothing
    // Prevents creating duplicate connections if connectDB()
    // is accidentally called more than once
    if (db) {
        console.log('MongoDB already connected - reusing existing connection');
        return;
    }

    // Validate that a connection string was provided
    // Fail fast with a clear message rather than a cryptic MongoDB error
    if (!uri) {
        throw new Error('MONGODB_URI is not defined in environment variables. Check your .env file.');
    }

    // Connect the client to MongoDB atlas
    // This initializes the connection pool
    await client.connect();

    // Select which databases to use within the cluster
    // If the database doesn't exist MongoDB creates it automatically on the first write operation
    db = client.db(dbName);

    console.log(`Connected to MongoDB Atlas - Database: ${dbName}`);
}

// Returns the active database instance for use in repositories
// Throws a calear error if called before connectDB() has run
// This prevents silent feailures from unconnected database operations
export const getDB = (): Db => {
    if (!db) {
        throw new Error('Database not connected. Ensure connectDB() is called at server startup.');
    }
    return db
}

// Gracefully closes the MongoDB connection
// Called when the server is shutting down
// Ensures all other operations complete before disconnecting
export const disconnectDB = async (): Promise<void> => {
    if (client) {
        await client.close();
        console.log('MongoDB connection closed');
    }
}