/**
 * Database Types
 * Shared database-related type definitions
 */

export interface DatabaseConnectionStatus {
  isConnected: boolean;
  lastChecked: string;
  error?: string;
  connectionCount?: number;
}