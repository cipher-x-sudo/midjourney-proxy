import { createApp } from './app';
import { config } from './config';

/**
 * Start server
 */
async function start(): Promise<void> {
  try {
    const app = await createApp();
    const port = config.server.port || 8080;
    const host = process.env.HOST || '0.0.0.0';

    await app.listen({ port, host });
    console.log(`Server listening on http://${host}:${port}${config.server.contextPath || ''}`);
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// Start server
start();

