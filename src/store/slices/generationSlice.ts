import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

// Import Prisma types for Generation and related enums
type GenerationStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
type StyleType = 'REALISTIC' | 'CARTOON' | 'ANIME' | 'FANTASY' | 'CYBERPUNK' | 'VINTAGE' | 'MINIMALIST';

export interface Generation {
  id: string;
  userId: string;
  characterId?: string;
  status: GenerationStatus;
  batchSize: number;
  nanoBananaRequestId?: string;
  prompt: string;
  styleType: StyleType;
  errorMessage?: string;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface GenerationFormData {
  prompt: string;
  styleType: StyleType;
  batchSize: number;
  photoFile?: File;
}

export interface GenerationState {
  // Current generation being processed
  currentGeneration: Generation | null;
  // List of recent generations
  generations: Generation[];
  // Form state
  formData: GenerationFormData;
  // UI state
  isGenerating: boolean;
  isLoading: boolean;
  error: string | null;
  // Real-time updates
  wsConnected: boolean;
  lastUpdate: string | null;
}

const initialState: GenerationState = {
  currentGeneration: null,
  generations: [],
  formData: {
    prompt: '',
    styleType: 'REALISTIC',
    batchSize: 1,
  },
  isGenerating: false,
  isLoading: false,
  error: null,
  wsConnected: false,
  lastUpdate: null,
};

// Async thunks for API calls
export const createGeneration = createAsyncThunk(
  'generation/create',
  async (formData: GenerationFormData, { rejectWithValue }) => {
    try {
      const response = await fetch('/api/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to create generation');
      }

      const generation = await response.json();
      return generation as Generation;
    } catch (error: unknown) {
      return rejectWithValue(error instanceof Error ? error.message : 'Network error occurred');
    }
  }
);

export const fetchGenerations = createAsyncThunk(
  'generation/fetchAll',
  async (params: { userId: string; limit?: number; offset?: number } = { userId: '', limit: 20, offset: 0 }, { rejectWithValue }) => {
    try {
      const queryParams = new URLSearchParams({
        limit: params.limit?.toString() || '20',
        offset: params.offset?.toString() || '0',
      });

      const response = await fetch(`/api/generations?${queryParams}`);
      
      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to fetch generations');
      }

      const generations = await response.json();
      return generations as Generation[];
    } catch (error: unknown) {
      return rejectWithValue(error instanceof Error ? error.message : 'Network error occurred');
    }
  }
);

export const fetchGenerationById = createAsyncThunk(
  'generation/fetchById',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/generations/${id}`);
      
      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to fetch generation');
      }

      const generation = await response.json();
      return generation as Generation;
    } catch (error: unknown) {
      return rejectWithValue(error instanceof Error ? error.message : 'Network error occurred');
    }
  }
);

export const cancelGeneration = createAsyncThunk(
  'generation/cancel',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await fetch(`/api/generations/${id}/cancel`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const error = await response.json();
        return rejectWithValue(error.message || 'Failed to cancel generation');
      }

      const generation = await response.json();
      return generation as Generation;
    } catch (error: unknown) {
      return rejectWithValue(error instanceof Error ? error.message : 'Network error occurred');
    }
  }
);

const generationSlice = createSlice({
  name: 'generation',
  initialState,
  reducers: {
    // Form data updates
    updateFormData: (state, action: PayloadAction<Partial<GenerationFormData>>) => {
      state.formData = { ...state.formData, ...action.payload };
    },
    
    resetFormData: (state) => {
      state.formData = initialState.formData;
    },

    // Real-time updates from WebSocket
    updateGenerationStatus: (state, action: PayloadAction<{ id: string; status: GenerationStatus; errorMessage?: string; completedAt?: Date }>) => {
      const { id, status, errorMessage, completedAt } = action.payload;
      
      // Update current generation
      if (state.currentGeneration?.id === id) {
        state.currentGeneration.status = status;
        if (errorMessage) state.currentGeneration.errorMessage = errorMessage;
        if (completedAt) state.currentGeneration.completedAt = completedAt;
      }

      // Update in generations list
      const generationIndex = state.generations.findIndex(gen => gen.id === id);
      if (generationIndex !== -1) {
        state.generations[generationIndex].status = status;
        if (errorMessage) state.generations[generationIndex].errorMessage = errorMessage;
        if (completedAt) state.generations[generationIndex].completedAt = completedAt;
      }

      state.lastUpdate = new Date().toISOString();
    },

    setCurrentGeneration: (state, action: PayloadAction<Generation | null>) => {
      state.currentGeneration = action.payload;
    },

    // WebSocket connection status
    setWsConnected: (state, action: PayloadAction<boolean>) => {
      state.wsConnected = action.payload;
    },

    // Clear errors
    clearError: (state) => {
      state.error = null;
    },

    // Reset state
    reset: () => {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    // Create generation
    builder
      .addCase(createGeneration.pending, (state) => {
        state.isGenerating = true;
        state.error = null;
      })
      .addCase(createGeneration.fulfilled, (state, action) => {
        state.isGenerating = false;
        state.currentGeneration = action.payload;
        // Add to beginning of generations list
        state.generations.unshift(action.payload);
        // Reset form data after successful creation
        state.formData = initialState.formData;
      })
      .addCase(createGeneration.rejected, (state, action) => {
        state.isGenerating = false;
        state.error = action.payload as string;
      });

    // Fetch generations
    builder
      .addCase(fetchGenerations.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchGenerations.fulfilled, (state, action) => {
        state.isLoading = false;
        state.generations = action.payload;
      })
      .addCase(fetchGenerations.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Fetch generation by ID
    builder
      .addCase(fetchGenerationById.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchGenerationById.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentGeneration = action.payload;
        
        // Update in generations list if it exists
        const generationIndex = state.generations.findIndex(gen => gen.id === action.payload.id);
        if (generationIndex !== -1) {
          state.generations[generationIndex] = action.payload;
        } else {
          // Add to list if not exists
          state.generations.unshift(action.payload);
        }
      })
      .addCase(fetchGenerationById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Cancel generation
    builder
      .addCase(cancelGeneration.pending, (state) => {
        state.error = null;
      })
      .addCase(cancelGeneration.fulfilled, (state, action) => {
        // Update current generation
        if (state.currentGeneration?.id === action.payload.id) {
          state.currentGeneration = action.payload;
        }

        // Update in generations list
        const generationIndex = state.generations.findIndex(gen => gen.id === action.payload.id);
        if (generationIndex !== -1) {
          state.generations[generationIndex] = action.payload;
        }
      })
      .addCase(cancelGeneration.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

export const {
  updateFormData,
  resetFormData,
  updateGenerationStatus,
  setCurrentGeneration,
  setWsConnected,
  clearError,
  reset,
} = generationSlice.actions;

export default generationSlice.reducer;