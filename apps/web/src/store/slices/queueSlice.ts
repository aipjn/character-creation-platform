import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { Generation } from './generationSlice';

export interface QueueItem {
  id: string;
  generation: Generation;
  position: number;
  estimatedWaitTime?: number; // in seconds
  addedAt: Date;
}

export interface QueueStats {
  totalQueued: number;
  totalProcessing: number;
  totalCompleted: number;
  totalFailed: number;
  averageProcessingTime: number; // in seconds
  queueLength: number;
}

export interface QueueState {
  // Queue items
  items: QueueItem[];
  // Current user's items in queue
  userItems: QueueItem[];
  // Queue statistics
  stats: QueueStats;
  // UI state
  isLoading: boolean;
  error: string | null;
  // Real-time updates
  lastQueueUpdate: string | null;
}

const initialState: QueueState = {
  items: [],
  userItems: [],
  stats: {
    totalQueued: 0,
    totalProcessing: 0,
    totalCompleted: 0,
    totalFailed: 0,
    averageProcessingTime: 0,
    queueLength: 0,
  },
  isLoading: false,
  error: null,
  lastQueueUpdate: null,
};

// Async thunks for queue operations
export const fetchQueueStatus = createAsyncThunk(
  'queue/fetchStatus',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/queue/status');
      
      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to fetch queue status');
      }

      const queueData = await response.json();
      return queueData;
    } catch (error: unknown) {
      return rejectWithValue(error instanceof Error ? error.message : 'Network error occurred');
    }
  }
);

export const fetchUserQueueItems = createAsyncThunk(
  'queue/fetchUserItems',
  async (userId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/queue/user/${userId}`);
      
      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to fetch user queue items');
      }

      const userItems = await response.json();
      return userItems as QueueItem[];
    } catch (error: unknown) {
      return rejectWithValue(error instanceof Error ? error.message : 'Network error occurred');
    }
  }
);

export const fetchQueueStats = createAsyncThunk(
  'queue/fetchStats',
  async (_, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/queue/stats');
      
      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to fetch queue stats');
      }

      const stats = await response.json();
      return stats as QueueStats;
    } catch (error: unknown) {
      return rejectWithValue(error instanceof Error ? error.message : 'Network error occurred');
    }
  }
);

export const removeFromQueue = createAsyncThunk(
  'queue/remove',
  async (generationId: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/queue/remove/${generationId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to remove from queue');
      }

      return { generationId };
    } catch (error: unknown) {
      return rejectWithValue(error instanceof Error ? error.message : 'Network error occurred');
    }
  }
);

const queueSlice = createSlice({
  name: 'queue',
  initialState,
  reducers: {
    // Real-time queue updates from WebSocket
    addToQueue: (state, action: PayloadAction<QueueItem>) => {
      const item = action.payload;
      // Add to queue items
      state.items.push(item);
      // Sort by position
      state.items.sort((a, b) => a.position - b.position);
      
      // If it's the user's item, add to userItems
      if (state.userItems.some(userItem => userItem.generation.userId === item.generation.userId)) {
        state.userItems.push(item);
        state.userItems.sort((a, b) => a.position - b.position);
      }
      
      state.lastQueueUpdate = new Date().toISOString();
      state.stats.queueLength = state.items.length;
    },

    updateQueueItem: (state, action: PayloadAction<{ id: string; updates: Partial<QueueItem> }>) => {
      const { id, updates } = action.payload;
      
      // Update in items
      const itemIndex = state.items.findIndex(item => item.id === id);
      if (itemIndex !== -1) {
        Object.assign(state.items[itemIndex], updates);
      }
      
      // Update in userItems
      const userItemIndex = state.userItems.findIndex(item => item.id === id);
      if (userItemIndex !== -1) {
        Object.assign(state.userItems[userItemIndex], updates);
      }
      
      state.lastQueueUpdate = new Date().toISOString();
    },

    removeQueueItem: (state, action: PayloadAction<string>) => {
      const generationId = action.payload;
      
      // Remove from items
      state.items = state.items.filter(item => item.generation.id !== generationId);
      
      // Remove from userItems
      state.userItems = state.userItems.filter(item => item.generation.id !== generationId);
      
      // Update positions for remaining items
      state.items.forEach((item, index) => {
        item.position = index + 1;
      });
      
      state.userItems.forEach((item, index) => {
        item.position = index + 1;
      });
      
      state.lastQueueUpdate = new Date().toISOString();
      state.stats.queueLength = state.items.length;
    },

    updateQueuePositions: (state, action: PayloadAction<QueueItem[]>) => {
      state.items = action.payload.sort((a, b) => a.position - b.position);
      
      // Update user items based on updated items
      state.userItems = state.items.filter(item => 
        state.userItems.some(userItem => userItem.generation.userId === item.generation.userId)
      );
      
      state.lastQueueUpdate = new Date().toISOString();
      state.stats.queueLength = state.items.length;
    },

    updateQueueStats: (state, action: PayloadAction<Partial<QueueStats>>) => {
      state.stats = { ...state.stats, ...action.payload };
      state.lastQueueUpdate = new Date().toISOString();
    },

    // Calculate estimated wait times based on queue position and average processing time
    calculateWaitTimes: (state) => {
      const avgProcessingTime = state.stats.averageProcessingTime || 60; // Default 1 minute
      
      state.items.forEach((item, index) => {
        // Estimate wait time based on position and average processing time
        item.estimatedWaitTime = (index + 1) * avgProcessingTime;
      });
      
      state.userItems.forEach((item, index) => {
        item.estimatedWaitTime = (index + 1) * avgProcessingTime;
      });
    },

    // Clear errors
    clearError: (state) => {
      state.error = null;
    },

    // Reset queue state
    reset: () => {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    // Fetch queue status
    builder
      .addCase(fetchQueueStatus.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchQueueStatus.fulfilled, (state, action) => {
        state.isLoading = false;
        state.items = (action.payload as any)?.items || [];
        state.stats = (action.payload as any)?.stats || state.stats;
        state.lastQueueUpdate = new Date().toISOString();
      })
      .addCase(fetchQueueStatus.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Fetch user queue items
    builder
      .addCase(fetchUserQueueItems.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchUserQueueItems.fulfilled, (state, action) => {
        state.isLoading = false;
        state.userItems = action.payload;
      })
      .addCase(fetchUserQueueItems.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Fetch queue stats
    builder
      .addCase(fetchQueueStats.pending, (state) => {
        state.error = null;
      })
      .addCase(fetchQueueStats.fulfilled, (state, action) => {
        state.stats = action.payload;
        state.lastQueueUpdate = new Date().toISOString();
      })
      .addCase(fetchQueueStats.rejected, (state, action) => {
        state.error = action.payload as string;
      });

    // Remove from queue
    builder
      .addCase(removeFromQueue.pending, (state) => {
        state.error = null;
      })
      .addCase(removeFromQueue.fulfilled, (state, action) => {
        const { generationId } = action.payload;
        
        // Remove from items
        state.items = state.items.filter(item => item.generation.id !== generationId);
        
        // Remove from userItems  
        state.userItems = state.userItems.filter(item => item.generation.id !== generationId);
        
        // Update positions
        state.items.forEach((item, index) => {
          item.position = index + 1;
        });
        
        state.lastQueueUpdate = new Date().toISOString();
        state.stats.queueLength = state.items.length;
      })
      .addCase(removeFromQueue.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

export const {
  addToQueue,
  updateQueueItem,
  removeQueueItem,
  updateQueuePositions,
  updateQueueStats,
  calculateWaitTimes,
  clearError,
  reset,
} = queueSlice.actions;

export default queueSlice.reducer;