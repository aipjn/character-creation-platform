import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { useDispatch, useSelector, TypedUseSelectorHook } from 'react-redux';

// Reducers
import generationReducer from './slices/generationSlice';
import queueReducer from './slices/queueSlice';

// Middleware
import websocketMiddleware from './middleware/websocketMiddleware';

// Root reducer
const rootReducer = combineReducers({
  generation: generationReducer,
  queue: queueReducer,
});

// Store configuration
export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // Disable serializable check for dates and files
      serializableCheck: {
        ignoredActions: [
          // Ignore file uploads in form data
          'generation/updateFormData',
          // Ignore WebSocket actions
          'INIT_WEBSOCKET',
          'DISCONNECT_WEBSOCKET',
          'SEND_WEBSOCKET_MESSAGE',
        ],
        ignoredPaths: [
          // Ignore file objects in form data
          'generation.formData.photoFile',
          // Ignore Date objects
          'generation.currentGeneration.createdAt',
          'generation.currentGeneration.updatedAt',
          'generation.currentGeneration.completedAt',
          'generation.generations',
          'queue.items',
          'queue.userItems',
        ],
      },
    }).concat(websocketMiddleware),
  devTools: process.env['NODE_ENV'] !== 'production',
});

// Export types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Typed hooks for better TypeScript support
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// Selectors
export const selectGeneration = (state: RootState) => state.generation;
export const selectQueue = (state: RootState) => state.queue;

// Generation selectors
export const selectCurrentGeneration = (state: RootState) => state.generation.currentGeneration;
export const selectGenerations = (state: RootState) => state.generation.generations;
export const selectGenerationFormData = (state: RootState) => state.generation.formData;
export const selectIsGenerating = (state: RootState) => state.generation.isGenerating;
export const selectGenerationError = (state: RootState) => state.generation.error;
export const selectIsWsConnected = (state: RootState) => state.generation.wsConnected;

// Queue selectors
export const selectQueueItems = (state: RootState) => state.queue.items;
export const selectUserQueueItems = (state: RootState) => state.queue.userItems;
export const selectQueueStats = (state: RootState) => state.queue.stats;
export const selectQueueError = (state: RootState) => state.queue.error;

// Compound selectors
export const selectGenerationById = (generationId: string) => (state: RootState) => {
  return state.generation.generations.find(gen => gen.id === generationId);
};

export const selectQueueItemByGenerationId = (generationId: string) => (state: RootState) => {
  return state.queue.items.find(item => item.generation.id === generationId);
};

export const selectUserQueuePosition = (generationId: string) => (state: RootState) => {
  const item = state.queue.userItems.find(item => item.generation.id === generationId);
  return item?.position;
};

export const selectEstimatedWaitTime = (generationId: string) => (state: RootState) => {
  const item = state.queue.items.find(item => item.generation.id === generationId);
  return item?.estimatedWaitTime;
};

// Status selectors
export const selectGenerationsByStatus = (status: string) => (state: RootState) => {
  return state.generation.generations.filter(gen => gen.status === status);
};

export const selectPendingGenerations = (state: RootState) => {
  return selectGenerationsByStatus('PENDING')(state);
};

export const selectProcessingGenerations = (state: RootState) => {
  return selectGenerationsByStatus('PROCESSING')(state);
};

export const selectCompletedGenerations = (state: RootState) => {
  return selectGenerationsByStatus('COMPLETED')(state);
};

export const selectFailedGenerations = (state: RootState) => {
  return selectGenerationsByStatus('FAILED')(state);
};

// Loading state selectors
export const selectIsLoading = (state: RootState) => {
  return state.generation.isLoading || state.queue.isLoading;
};

export const selectHasErrors = (state: RootState) => {
  return Boolean(state.generation.error || state.queue.error);
};

export const selectAllErrors = (state: RootState) => {
  const errors: string[] = [];
  if (state.generation.error) errors.push(state.generation.error);
  if (state.queue.error) errors.push(state.queue.error);
  return errors;
};

// Statistics selectors
export const selectGenerationCount = (state: RootState) => {
  return state.generation.generations.length;
};

export const selectSuccessRate = (state: RootState) => {
  const total = state.generation.generations.length;
  if (total === 0) return 0;
  
  const completed = selectCompletedGenerations(state).length;
  return (completed / total) * 100;
};

export const selectQueueLength = (state: RootState) => {
  return state.queue.stats.queueLength;
};

export const selectAverageProcessingTime = (state: RootState) => {
  return state.queue.stats.averageProcessingTime;
};

// Export store as default
export default store;