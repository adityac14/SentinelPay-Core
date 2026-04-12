// Load enviornment variables first before any other inports
// This ensures porcess.env values are available throughout the app
// Must be at he very top before importing modules that use process.env
import dotenv from 'dotenv';
dotenv.config()

import { Server } from 'http';
import app from './app';
import { connectDB, disconnectDB } from './config/db';

// Read port from enviornment variables or default to 3000
// Using a seperate variable makes it easy to reference in log messages
const PORT = process.env.PORT || 3000;

// Handles graceful shutdown when the process receives a termination signal
// Closes the HTTP server first to stop acepting new requests
// Then disconnects from MongoDB to ensure all operations complete cleanly
const gracefulShutdown = async (server: Server): Promise<void> => {
    console.log('Shutdown signal received - closing server gracefully');

    // server.closes() stops accepting new connections
    // The callback fires once all existing connections are closed
    server.close(async () => {
        try {
            // Disconnect from MongoDB after HTTP server closes
            // Ensures no in-flight database operations are cut short
            await disconnectDB();
            console.log('Server shut down successfully');
            process.exit(0)
        }
        catch (error) {
            console.error('Error during shutdown: ', error);
            process.exit(1);
        }
    });
};

// Main startup function
// Connects to MongoDB first then starts the HTTP server
// Using async so we can await the DB connection before accepting requests
// This prevents the server from receiving requests before the DB is ready
const start = async (): Promise<void> => {
    try {
        // Step 1 - Connect to MongoDB Atlas
        // Must succeed before we start accepting HTTP requests
        await connectDB();

        // Step 2 - Start the HTTP server
        // app.listen() returns an http.Server instance
        // We store it so we can pass it to gracefulShutdown()
        const server = app.listen(PORT, () => {
            console.log(`SentinelPay-Core API running on http://localhost:${PORT}`);
            console.log(`Health check: http://localhost:${PORT}/health`);
            console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        });

        // Step 3 — Register shutdown handlers
        // SIGTERM — sent by process managers like Docker, Kubernetes, or PM2
        // when they want to stop the process gracefully
        process.on('SIGTERM', () => gracefulShutdown(server));

        // SIGINT — sent when the user presses Ctrl+C in the terminal
        // Handles the common development case of stopping the server manually
        process.on('SIGINT', () => gracefulShutdown(server));

        // Handle uncaught promise rejections
        // Prevents the process from crashing silently on unhandled async errors
        // Logs the error and shuts down gracefully
        process.on('unhandledRejection', (reason: unknown) => {
            console.error('Unhandled promise rejection:', reason);
            gracefulShutdown(server);
        });
    }
    catch (error) {
        // If DB connection or server startup fails
        // log the error and exist with a non-zero code
        // Non-zero exit code signals failure to process managers
        console.error('Failed to start SentinelPay-Core API: ', error)
        process.exit(1);

    }
}

// Kick off the startup sequence
start()
