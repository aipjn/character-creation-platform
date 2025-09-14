// Batch Generation Components
// Export all components for the batch character generation interface

// Main Components
export { BatchControls } from './BatchControls';
export type { BatchControlsProps } from './BatchControls';

export { VariationGrid } from './VariationGrid';
export type { VariationGridProps } from './VariationGrid';

export { ResultsDisplay } from './ResultsDisplay';
export type { ResultsDisplayProps } from './ResultsDisplay';

// Default exports for convenience
export { default as BatchControlsDefault } from './BatchControls';
export { default as VariationGridDefault } from './VariationGrid';
export { default as ResultsDisplayDefault } from './ResultsDisplay';

// Re-export relevant types from the main types file for convenience
export type {
  StyleType,
  GenerationStatus,
  BatchGenerationRequest,
  GenerationVariation,
  BatchGenerationResult
} from '../../types';