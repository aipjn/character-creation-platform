import React, { useCallback } from 'react';
import { GenerationVariation, GenerationStatus } from '../../types';

export interface VariationGridProps {
  variations: GenerationVariation[];
  onVariationSelect?: (variation: GenerationVariation) => void;
  onDownload?: (variation: GenerationVariation) => void;
  onRetry?: (variationId: string) => void;
  selectedVariationId?: string;
  showActions?: boolean;
}

export const VariationGrid: React.FC<VariationGridProps> = ({
  variations,
  onVariationSelect,
  onDownload,
  onRetry,
  selectedVariationId,
  showActions = true
}) => {
  const handleVariationClick = useCallback((variation: GenerationVariation) => {
    if (onVariationSelect && variation.status === 'completed') {
      onVariationSelect(variation);
    }
  }, [onVariationSelect]);

  const handleDownload = useCallback((e: React.MouseEvent, variation: GenerationVariation) => {
    e.stopPropagation();
    if (onDownload && variation.imageUrl) {
      onDownload(variation);
    }
  }, [onDownload]);

  const handleRetry = useCallback((e: React.MouseEvent, variationId: string) => {
    e.stopPropagation();
    if (onRetry) {
      onRetry(variationId);
    }
  }, [onRetry]);

  const getStatusIcon = (status: GenerationStatus): string => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'processing':
        return '🔄';
      case 'completed':
        return '✅';
      case 'failed':
        return '❌';
      default:
        return '❓';
    }
  };

  const getStatusText = (status: GenerationStatus): string => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'processing':
        return 'Processing';
      case 'completed':
        return 'Completed';
      case 'failed':
        return 'Failed';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className="variation-grid">
      <div className="variation-grid__container">
        {variations.map((variation, index) => (
          <div
            key={variation.id}
            className={`variation-card ${
              selectedVariationId === variation.id ? 'variation-card--selected' : ''
            } ${
              variation.status === 'completed' && onVariationSelect ? 'variation-card--clickable' : ''
            }`}
            onClick={() => handleVariationClick(variation)}
          >
            {/* Variation Header */}
            <div className="variation-card__header">
              <span className="variation-card__number">#{index + 1}</span>
              <div className="variation-card__status">
                <span className="status-icon">{getStatusIcon(variation.status)}</span>
                <span className="status-text">{getStatusText(variation.status)}</span>
              </div>
            </div>

            {/* Variation Content */}
            <div className="variation-card__content">
              {variation.status === 'processing' && (
                <div className="variation-card__progress">
                  <div className="progress-bar">
                    <div 
                      className="progress-bar__fill"
                      style={{ width: `${variation.progress || 0}%` }}
                    />
                  </div>
                  <span className="progress-text">
                    {variation.progress || 0}%
                  </span>
                </div>
              )}

              {variation.status === 'completed' && variation.imageUrl && (
                <div className="variation-card__image-container">
                  <img
                    src={variation.imageUrl}
                    alt={`Variation ${index + 1}`}
                    className="variation-card__image"
                    loading="lazy"
                  />
                  {selectedVariationId === variation.id && (
                    <div className="variation-card__selected-overlay">
                      <span className="selected-icon">✓</span>
                    </div>
                  )}
                </div>
              )}

              {variation.status === 'failed' && (
                <div className="variation-card__error">
                  <div className="error-icon">⚠️</div>
                  <p className="error-message">
                    {variation.error || 'Generation failed'}
                  </p>
                </div>
              )}

              {variation.status === 'pending' && (
                <div className="variation-card__placeholder">
                  <div className="placeholder-icon">⏳</div>
                  <p className="placeholder-text">Waiting to start...</p>
                </div>
              )}
            </div>

            {/* Variation Actions */}
            {showActions && (
              <div className="variation-card__actions">
                {variation.status === 'completed' && variation.imageUrl && (
                  <button
                    type="button"
                    onClick={(e) => handleDownload(e, variation)}
                    className="action-btn action-btn--download"
                    title="Download"
                  >
                    <span className="action-btn__icon">⬇️</span>
                    <span className="action-btn__text">Download</span>
                  </button>
                )}

                {variation.status === 'failed' && onRetry && (
                  <button
                    type="button"
                    onClick={(e) => handleRetry(e, variation.id)}
                    className="action-btn action-btn--retry"
                    title="Retry"
                  >
                    <span className="action-btn__icon">🔄</span>
                    <span className="action-btn__text">Retry</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

    </div>
  );
};

export default VariationGrid;