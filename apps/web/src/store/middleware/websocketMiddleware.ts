import { Middleware } from '@reduxjs/toolkit';
import { updateGenerationStatus, setWsConnected } from '../slices/generationSlice';
import { addToQueue, removeQueueItem, updateQueueItem, updateQueueStats } from '../slices/queueSlice';

// WebSocket message types
export enum WsMessageType {
  GENERATION_STATUS_UPDATE = 'generation_status_update',
  QUEUE_UPDATE = 'queue_update',
  QUEUE_STATS_UPDATE = 'queue_stats_update',
  QUEUE_ITEM_ADDED = 'queue_item_added',
  QUEUE_ITEM_REMOVED = 'queue_item_removed',
  QUEUE_ITEM_UPDATED = 'queue_item_updated',
  CONNECTION_ACK = 'connection_ack',
  ERROR = 'error',
}

export interface WsMessage {
  type: WsMessageType;
  payload: any;
  timestamp: string;
}

interface WebSocketState {
  socket: WebSocket | null;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  reconnectDelay: number;
  isReconnecting: boolean;
}

class WebSocketManager {
  private state: WebSocketState = {
    socket: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,
    reconnectDelay: 1000, // Start with 1 second
    isReconnecting: false,
  };

  private dispatch: any = null;
  private url: string = '';

  constructor(url: string) {
    this.url = url;
  }

  setDispatch(dispatch: any) {
    this.dispatch = dispatch;
  }

  connect(): void {
    if (this.state.socket?.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    try {
      this.state.socket = new WebSocket(this.url);
      this.setupEventHandlers();
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.handleConnectionError();
    }
  }

  disconnect(): void {
    if (this.state.socket) {
      this.state.socket.close(1000, 'Client disconnect');
      this.state.socket = null;
    }
    this.state.reconnectAttempts = 0;
    this.state.isReconnecting = false;
    
    if (this.dispatch) {
      this.dispatch(setWsConnected(false));
    }
  }

  private setupEventHandlers(): void {
    if (!this.state.socket) return;

    this.state.socket.onopen = () => {
      console.log('WebSocket connected');
      this.state.reconnectAttempts = 0;
      this.state.reconnectDelay = 1000;
      this.state.isReconnecting = false;
      
      if (this.dispatch) {
        this.dispatch(setWsConnected(true));
      }
    };

    this.state.socket.onmessage = (event) => {
      try {
        const message: WsMessage = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.state.socket.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason);
      
      if (this.dispatch) {
        this.dispatch(setWsConnected(false));
      }

      // Only attempt to reconnect if it wasn't a normal closure
      if (event.code !== 1000 && !this.state.isReconnecting) {
        this.handleConnectionError();
      }
    };

    this.state.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.handleConnectionError();
    };
  }

  private handleMessage(message: WsMessage): void {
    if (!this.dispatch) return;

    switch (message.type) {
      case WsMessageType.GENERATION_STATUS_UPDATE:
        this.dispatch(updateGenerationStatus(message.payload));
        break;

      case WsMessageType.QUEUE_ITEM_ADDED:
        this.dispatch(addToQueue(message.payload));
        break;

      case WsMessageType.QUEUE_ITEM_REMOVED:
        this.dispatch(removeQueueItem(message.payload.generationId));
        break;

      case WsMessageType.QUEUE_ITEM_UPDATED:
        this.dispatch(updateQueueItem({
          id: message.payload.id,
          updates: message.payload.updates,
        }));
        break;

      case WsMessageType.QUEUE_STATS_UPDATE:
        this.dispatch(updateQueueStats(message.payload));
        break;

      case WsMessageType.CONNECTION_ACK:
        console.log('WebSocket connection acknowledged');
        break;

      case WsMessageType.ERROR:
        console.error('WebSocket server error:', message.payload);
        break;

      default:
        console.warn('Unknown WebSocket message type:', message.type);
    }
  }

  private handleConnectionError(): void {
    if (this.state.reconnectAttempts >= this.state.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    if (this.state.isReconnecting) {
      return; // Already attempting to reconnect
    }

    this.state.isReconnecting = true;
    this.state.reconnectAttempts++;

    console.log(`Attempting to reconnect (${this.state.reconnectAttempts}/${this.state.maxReconnectAttempts}) in ${this.state.reconnectDelay}ms`);

    setTimeout(() => {
      if (this.state.isReconnecting) {
        this.connect();
        // Exponential backoff with jitter
        this.state.reconnectDelay = Math.min(
          this.state.reconnectDelay * 2 + Math.random() * 1000,
          30000 // Max 30 seconds
        );
      }
    }, this.state.reconnectDelay);
  }

  send(message: WsMessage): void {
    if (this.state.socket?.readyState === WebSocket.OPEN) {
      this.state.socket.send(JSON.stringify(message));
    } else {
      console.warn('Cannot send message: WebSocket not connected');
    }
  }

  getConnectionState(): 'connecting' | 'open' | 'closing' | 'closed' {
    if (!this.state.socket) return 'closed';
    
    switch (this.state.socket.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'open';
      case WebSocket.CLOSING:
        return 'closing';
      case WebSocket.CLOSED:
      default:
        return 'closed';
    }
  }
}

// Global WebSocket manager instance
let wsManager: WebSocketManager | null = null;

// Redux middleware for WebSocket integration
export const websocketMiddleware: Middleware = (store) => (next) => (action: any) => {
  const result = next(action);

  // Initialize WebSocket connection when store is created
  if (action.type === 'INIT_WEBSOCKET') {
    let wsUrl: string;
    
    // Check if we're in a browser environment
    if (typeof window !== 'undefined') {
      wsUrl = action.payload?.url || `ws://${window.location.host}/ws`;
    } else {
      wsUrl = action.payload?.url || 'ws://localhost:3000/ws';
    }
    
    if (wsManager) {
      wsManager.disconnect();
    }
    
    wsManager = new WebSocketManager(wsUrl);
    wsManager.setDispatch(store.dispatch);
    wsManager.connect();
  }

  // Disconnect WebSocket
  if (action.type === 'DISCONNECT_WEBSOCKET') {
    if (wsManager) {
      wsManager.disconnect();
      wsManager = null;
    }
  }

  // Send WebSocket messages
  if (action.type === 'SEND_WEBSOCKET_MESSAGE') {
    if (wsManager) {
      wsManager.send(action.payload);
    }
  }

  return result;
};

// Action creators for WebSocket control
export const initWebSocket = (url?: string) => ({
  type: 'INIT_WEBSOCKET' as const,
  payload: { url },
});

export const disconnectWebSocket = () => ({
  type: 'DISCONNECT_WEBSOCKET' as const,
});

export const sendWebSocketMessage = (message: WsMessage) => ({
  type: 'SEND_WEBSOCKET_MESSAGE' as const,
  payload: message,
});

// Utility functions
export const getWebSocketManager = (): WebSocketManager | null => {
  return wsManager;
};

export const isWebSocketConnected = (): boolean => {
  return wsManager?.getConnectionState() === 'open';
};

export default websocketMiddleware;