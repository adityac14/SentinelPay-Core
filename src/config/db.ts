import { MongoClient, Db } from 'mongodb';

// No dotenv import here — environment variables are loaded
// once at application startup in server.ts
// By the time connectDB() is called, process.env is already populated

// Read the MongoDB connection string from environment variables
// This keeps credentials out of source code
// Note: environment variables are case sensitive on Linux
// MONGODB_URI must match exactly what is set in Azure environment variables
const uri = process.env.MONGODB_URI || '';

// Read the database name from environment variables
// Defaults to 'sentinelpay' if not specified
// DB_NAME must match exactly what is set in Azure environment variables
const dbName = process.env.DB_NAME || 'sentinelpay';

// Debug logging to help diagnose environment variable issues
// Shows whether MONGODB_URI was loaded without exposing the full connection string
// Safe to keep in production — only logs the first 20 characters
console.log('DB_NAME:', dbName);
console.log('MONGODB_URI defined:', uri ? 'YES' : 'NO — check Azure environment variables');
console.log('MONGODB_URI prefix:', uri.substring(0, 20));

// Create a single MongoClient instance
// MongoClient manages a connection pool internally
// We create it once and reuse it throughout the application
// Creating a new client per request would be extremely inefficient
const client = new MongoClient(uri);

// Holds the active database instance once connected
// Declared outside connectDB() so it persists across function calls
// This is the singleton pattern — one shared instance
let db: Db;

// Establishes a connection to MongoDB Atlas
// Called once at server startup in server.ts
// All subsequent calls to getDB() reuse this connection
export const connectDB = async (): Promise<void> => {

  // Guard clause — if already connected do nothing
  // Prevents creating duplicate connections if connectDB()
  // is accidentally called more than once
  if (db) {
    console.log('MongoDB already connected — reusing existing connection');
    return;
  }

  // Validate that a connection string was provided
  // Fail fast with a clear message rather than a cryptic MongoDB error
  // On Azure this fires if environment variables were not set in the portal
  if (!uri) {
    throw new Error(
      'MONGODB_URI is not defined. Check environment variables in Azure Portal under Settings → Environment variables.'
    );
  }

  // Connect the client to MongoDB Atlas
  // This initialises the connection pool
  await client.connect();

  // Select which database to use within the cluster
  // If the database does not exist MongoDB creates it automatically
  // on the first write operation
  db = client.db(dbName);

  console.log(`Connected to MongoDB Atlas — database: ${dbName}`);
};

// Returns the active database instance for use in repositories
// Throws a clear error if called before connectDB() has run
// This prevents silent failures from unconnected database operations
export const getDB = (): Db => {
  if (!db) {
    throw new Error(
      'Database not connected. Ensure connectDB() is called at server startup.'
    );
  }
  return db;
};

// Gracefully closes the MongoDB connection
// Called when the server is shutting down
// Ensures all in-flight operations complete before disconnecting
export const disconnectDB = async (): Promise<void> => {
  if (client) {
    await client.close();
    console.log('MongoDB connection closed');
  }
};