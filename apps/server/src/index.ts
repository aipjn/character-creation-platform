/**
 * Server Entry Point
 * Uses the new server architecture from ../server.ts
 */

import { serverManager } from './server';

// Start the server
if (require.main === module) {
  serverManager.start().catch((error) => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  });
}

export default serverManager;