import { MongoClient, Db } from 'mongodb';

const uri = process.env.MONGODB_URI || '';
const dbName = process.env.DB_NAME || 'sentinelpay';

// Add TLS options to fix SSL handshake issues on Azure Linux with Node.js 22
// tlsAllowInvalidCertificates and tlsAllowInvalidHostnames help bypass
// TLS version negotiation issues between MongoDB driver v7 and Node.js v22
const client = new MongoClient(uri, {
  tls: true,
  tlsAllowInvalidCertificates: false,
  serverSelectionTimeoutMS: 30000,
  connectTimeoutMS: 30000,
});

let db: Db;

export const connectDB = async (): Promise<void> => {
  if (db) {
    console.log('MongoDB already connected — reusing existing connection');
    return;
  }

  if (!uri) {
    throw new Error(
      'MONGODB_URI is not defined. Check environment variables in Azure Portal under Settings → Environment variables.'
    );
  }

  await client.connect();
  db = client.db(dbName);
  console.log(`Connected to MongoDB Atlas — database: ${dbName}`);
};

export const getDB = (): Db => {
  if (!db) {
    throw new Error(
      'Database not connected. Ensure connectDB() is called at server startup.'
    );
  }
  return db;
};

export const disconnectDB = async (): Promise<void> => {
  if (client) {
    await client.close();
    console.log('MongoDB connection closed');
  }
};