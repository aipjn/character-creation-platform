import { useCallback, useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import {
  createGeneration,
  fetchGenerations,
  fetchGenerationById,
  cancelGeneration,
  updateFormData,
  resetFormData,
  clearError,
  reset,
  GenerationFormData,
  Generation,
} from '../store/slices/generationSlice';
import {
  fetchQueueStatus,
  fetchUserQueueItems,
  fetchQueueStats,
  removeFromQueue,
  calculateWaitTimes,
  QueueItem,
  QueueStats,
} from '../store/slices/queueSlice';
import {
  initWebSocket,
  disconnectWebSocket,
  sendWebSocketMessage,
  WsMessageType,
} from '../store/middleware/websocketMiddleware';

export interface UseGenerationResult {
  // State
  currentGeneration: Generation | null;
  generations: Generation[];
  formData: GenerationFormData;
  isGenerating: boolean;
  isLoading: boolean;
  error: string | null;
  wsConnected: boolean;
  
  // Queue state
  queueItems: QueueItem[];
  userQueueItems: QueueItem[];
  queueStats: QueueStats;
  queueError: string | null;
  
  // Actions
  createNewGeneration: (formData: GenerationFormData) => Promise<any>;
  loadGenerations: (params?: { limit?: number; offset?: number }) => Promise<any>;
  loadGeneration: (id: string) => Promise<any>;
  cancelCurrentGeneration: (id: string) => Promise<any>;
  
  // Form actions
  updateForm: (updates: Partial<GenerationFormData>) => void;
  resetForm: () => void;
  
  // Queue actions
  loadQueueStatus: () => Promise<any>;
  loadUserQueue: (userId: string) => Promise<any>;
  loadQueueStats: () => Promise<any>;
  removeFromGenerationQueue: (generationId: string) => Promise<any>;
  refreshWaitTimes: () => void;
  
  // WebSocket actions
  connectWebSocket: (url?: string) => void;
  disconnectWebSocketConnection: () => void;
  sendMessage: (type: WsMessageType, payload: any) => void;
  
  // Utility actions
  clearErrors: () => void;
  resetState: () => void;
}

export const useGeneration = (): UseGenerationResult => {
  const dispatch = useAppDispatch();
  
  // Selectors
  const currentGeneration = useAppSelector(state => state.generation.currentGeneration);
  const generations = useAppSelector(state => state.generation.generations);
  const formData = useAppSelector(state => state.generation.formData);
  const isGenerating = useAppSelector(state => state.generation.isGenerating);
  const isLoading = useAppSelector(state => state.generation.isLoading || state.queue.isLoading);
  const error = useAppSelector(state => state.generation.error);
  const wsConnected = useAppSelector(state => state.generation.wsConnected);
  
  // Queue selectors
  const queueItems = useAppSelector(state => state.queue.items);
  const userQueueItems = useAppSelector(state => state.queue.userItems);
  const queueStats = useAppSelector(state => state.queue.stats);
  const queueError = useAppSelector(state => state.queue.error);
  
  // Generation actions
  const createNewGeneration = useCallback(async (formData: GenerationFormData) => {
    const result = await dispatch(createGeneration(formData));
    return result;
  }, [dispatch]);
  
  const loadGenerations = useCallback(async (params?: { limit?: number; offset?: number }) => {
    const userId = ''; // TODO: Get from auth context
    const result = await dispatch(fetchGenerations({ userId, ...params }));
    return result;
  }, [dispatch]);
  
  const loadGeneration = useCallback(async (id: string) => {
    const result = await dispatch(fetchGenerationById(id));
    return result;
  }, [dispatch]);
  
  const cancelCurrentGeneration = useCallback(async (id: string) => {
    const result = await dispatch(cancelGeneration(id));
    return result;
  }, [dispatch]);
  
  // Form actions
  const updateForm = useCallback((updates: Partial<GenerationFormData>) => {
    dispatch(updateFormData(updates));
  }, [dispatch]);
  
  const resetForm = useCallback(() => {
    dispatch(resetFormData());
  }, [dispatch]);
  
  // Queue actions
  const loadQueueStatus = useCallback(async () => {
    const result = await dispatch(fetchQueueStatus());
    return result;
  }, [dispatch]);
  
  const loadUserQueue = useCallback(async (userId: string) => {
    const result = await dispatch(fetchUserQueueItems(userId));
    return result;
  }, [dispatch]);
  
  const loadQueueStats = useCallback(async () => {
    const result = await dispatch(fetchQueueStats());
    return result;
  }, [dispatch]);
  
  const removeFromGenerationQueue = useCallback(async (generationId: string) => {
    const result = await dispatch(removeFromQueue(generationId));
    return result;
  }, [dispatch]);
  
  const refreshWaitTimes = useCallback(() => {
    dispatch(calculateWaitTimes());
  }, [dispatch]);
  
  // WebSocket actions
  const connectWebSocket = useCallback((url?: string) => {
    dispatch(initWebSocket(url));
  }, [dispatch]);
  
  const disconnectWebSocketConnection = useCallback(() => {
    dispatch(disconnectWebSocket());
  }, [dispatch]);
  
  const sendMessage = useCallback((type: WsMessageType, payload: any) => {
    dispatch(sendWebSocketMessage({
      type,
      payload,
      timestamp: new Date().toISOString(),
    }));
  }, [dispatch]);
  
  // Utility actions
  const clearErrors = useCallback(() => {
    dispatch(clearError());
    dispatch({ type: 'queue/clearError' });
  }, [dispatch]);
  
  const resetState = useCallback(() => {
    dispatch(reset());
    dispatch({ type: 'queue/reset' });
  }, [dispatch]);
  
  return {
    // State
    currentGeneration,
    generations,
    formData,
    isGenerating,
    isLoading,
    error,
    wsConnected,
    
    // Queue state
    queueItems,
    userQueueItems,
    queueStats,
    queueError,
    
    // Actions
    createNewGeneration,
    loadGenerations,
    loadGeneration,
    cancelCurrentGeneration,
    
    // Form actions
    updateForm,
    resetForm,
    
    // Queue actions
    loadQueueStatus,
    loadUserQueue,
    loadQueueStats,
    removeFromGenerationQueue,
    refreshWaitTimes,
    
    // WebSocket actions
    connectWebSocket,
    disconnectWebSocketConnection: disconnectWebSocketConnection,
    sendMessage,
    
    // Utility actions
    clearErrors,
    resetState,
  };
};

// Additional specialized hooks for specific use cases
export const useGenerationForm = () => {
  const { formData, updateForm, resetForm, createNewGeneration, isGenerating, error } = useGeneration();
  
  const submitForm = useCallback(async () => {
    if (!formData.prompt.trim()) {
      throw new Error('Prompt is required');
    }
    
    return await createNewGeneration(formData);
  }, [formData, createNewGeneration]);
  
  return {
    formData,
    updateForm,
    resetForm,
    submitForm,
    isGenerating,
    error,
  };
};

export const useGenerationQueue = (userId?: string) => {
  const { 
    queueItems, 
    userQueueItems, 
    queueStats, 
    queueError,
    loadQueueStatus,
    loadUserQueue,
    loadQueueStats,
    removeFromGenerationQueue,
    refreshWaitTimes,
  } = useGeneration();
  
  // Auto-load queue data
  useEffect(() => {
    loadQueueStatus();
    loadQueueStats();
    if (userId) {
      loadUserQueue(userId);
    }
  }, [userId, loadQueueStatus, loadQueueStats, loadUserQueue]);
  
  // Refresh wait times when queue updates
  useEffect(() => {
    refreshWaitTimes();
  }, [queueItems.length, refreshWaitTimes]);
  
  return {
    queueItems,
    userQueueItems,
    queueStats,
    queueError,
    removeFromGenerationQueue,
    refreshData: useCallback(() => {
      loadQueueStatus();
      loadQueueStats();
      if (userId) {
        loadUserQueue(userId);
      }
    }, [userId, loadQueueStatus, loadQueueStats, loadUserQueue]),
  };
};

export const useWebSocket = (autoConnect: boolean = true, url?: string) => {
  const { wsConnected, connectWebSocket, disconnectWebSocketConnection, sendMessage } = useGeneration();
  
  useEffect(() => {
    if (autoConnect) {
      connectWebSocket(url);
    }
    
    return () => {
      if (autoConnect) {
        disconnectWebSocketConnection();
      }
    };
  }, [autoConnect, url, connectWebSocket, disconnectWebSocketConnection]);
  
  return {
    isConnected: wsConnected,
    connect: connectWebSocket,
    disconnect: disconnectWebSocketConnection,
    send: sendMessage,
  };
};

export default useGeneration;