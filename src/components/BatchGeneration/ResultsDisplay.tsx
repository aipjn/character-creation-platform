import React, { useMemo } from 'react';
import { BatchGenerationResult, GenerationStatus } from '../../types';
import { VariationGrid } from './VariationGrid';

export interface ResultsDisplayProps {
  results: BatchGenerationResult[];
  onVariationSelect?: (variationId: string, resultId: string) => void;
  onDownload?: (variationId: string, resultId: string) => void;
  onRetry?: (variationId: string, resultId: string) => void;
  onNewGeneration?: () => void;
  selectedVariationId?: string;
  showActions?: boolean;
}

export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({
  results,
  onVariationSelect,
  onDownload,
  onRetry,
  onNewGeneration,
  selectedVariationId,
  showActions = true
}) => {
  const stats = useMemo(() => {
    const totalResults = results.length;
    const totalVariations = results.reduce((acc, result) => acc + result.variations.length, 0);
    const completedVariations = results.reduce(
      (acc, result) => acc + result.variations.filter(v => v.status === 'completed').length, 
      0
    );
    const processingVariations = results.reduce(
      (acc, result) => acc + result.variations.filter(v => v.status === 'processing').length, 
      0
    );
    const failedVariations = results.reduce(
      (acc, result) => acc + result.variations.filter(v => v.status === 'failed').length, 
      0
    );

    return {
      totalResults,
      totalVariations,
      completedVariations,
      processingVariations,
      failedVariations,
      completionRate: totalVariations > 0 ? Math.round((completedVariations / totalVariations) * 100) : 0
    };
  }, [results]);

  const handleVariationSelect = (variation: any, resultId: string) => {
    if (onVariationSelect) {
      onVariationSelect(variation.id, resultId);
    }
  };

  const handleDownload = (variation: any, resultId: string) => {
    if (onDownload) {
      onDownload(variation.id, resultId);
    }
  };

  const handleRetry = (variationId: string, resultId: string) => {
    if (onRetry) {
      onRetry(variationId, resultId);
    }
  };

  const formatTimestamp = (timestamp: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(timestamp);
  };

  const getStatusColor = (status: GenerationStatus): string => {
    switch (status) {
      case 'completed':
        return '#28a745';
      case 'processing':
        return '#007bff';
      case 'failed':
        return '#dc3545';
      default:
        return '#6c757d';
    }
  };

  const getStatusText = (status: GenerationStatus): string => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'processing':
        return 'In Progress';
      case 'failed':
        return 'Failed';
      default:
        return 'Pending';
    }
  };

  if (results.length === 0) {
    return (
      <div className="results-display results-display--empty">
        <div className="empty-state">
          <div className="empty-state__icon">🎨</div>
          <h3 className="empty-state__title">No generations yet</h3>
          <p className="empty-state__description">
            Start by creating your first character generation above.
          </p>
          {onNewGeneration && (
            <button
              onClick={onNewGeneration}
              className="btn btn--primary"
            >
              Create New Generation
            </button>
          )}
        </div>

      </div>
    );
  }

  return (
    <div className="results-display">
      {/* Statistics Header */}
      <div className="results-stats">
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-card__number">{stats.totalResults}</div>
            <div className="stat-card__label">Generation{stats.totalResults !== 1 ? 's' : ''}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__number">{stats.totalVariations}</div>
            <div className="stat-card__label">Total Variations</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__number">{stats.completedVariations}</div>
            <div className="stat-card__label">Completed</div>
          </div>
          <div className="stat-card">
            <div className="stat-card__number">{stats.completionRate}%</div>
            <div className="stat-card__label">Success Rate</div>
          </div>
        </div>

        {stats.processingVariations > 0 && (
          <div className="processing-indicator">
            <span className="processing-indicator__spinner">⟳</span>
            <span className="processing-indicator__text">
              {stats.processingVariations} variation{stats.processingVariations !== 1 ? 's' : ''} processing...
            </span>
          </div>
        )}
      </div>

      {/* Results List */}
      <div className="results-list">
        {results.map((result) => (
          <div key={result.id} className="result-section">
            {/* Result Header */}
            <div className="result-header">
              <div className="result-header__info">
                <h3 className="result-header__title">
                  {result.request.styleType} Style Generation
                </h3>
                <div className="result-header__meta">
                  <span className="meta-item">
                    📅 {formatTimestamp(result.createdAt)}
                  </span>
                  <span className="meta-item">
                    🎨 {result.variations.length} variation{result.variations.length !== 1 ? 's' : ''}
                  </span>
                  <span 
                    className="meta-item meta-item--status"
                    style={{ color: getStatusColor(result.status) }}
                  >
                    ⚡ {getStatusText(result.status)}
                  </span>
                </div>
              </div>

              {result.completedAt && (
                <div className="result-header__duration">
                  <span className="duration-text">
                    Completed in {Math.round((result.completedAt.getTime() - result.createdAt.getTime()) / 1000)}s
                  </span>
                </div>
              )}
            </div>

            {/* Request Details */}
            <div className="result-details">
              <div className="request-prompt">
                <strong>Prompt:</strong> {result.request.prompt}
              </div>
              {result.request.imageFile && (
                <div className="request-image">
                  <strong>Reference Image:</strong> {result.request.imageFile.name}
                </div>
              )}
            </div>

            {/* Variations Grid */}
            <VariationGrid
              variations={result.variations}
              onVariationSelect={(variation) => handleVariationSelect(variation, result.id)}
              onDownload={(variation) => handleDownload(variation, result.id)}
              onRetry={(variationId) => handleRetry(variationId, result.id)}
              selectedVariationId={selectedVariationId}
              showActions={showActions}
            />
          </div>
        ))}
      </div>

      {/* Actions */}
      {onNewGeneration && (
        <div className="results-actions">
          <button
            onClick={onNewGeneration}
            className="btn btn--primary btn--large"
          >
            Generate New Characters
          </button>
        </div>
      )}

    </div>
  );
};

export default ResultsDisplay;