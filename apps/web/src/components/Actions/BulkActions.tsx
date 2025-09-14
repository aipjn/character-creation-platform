import React, { useState, useCallback, useMemo } from 'react';
import { Character } from '@prisma/client';
import {
  downloadService,
  BulkDownloadProgress,
} from '../../services/downloadService';
import { shareService } from '../../services/shareService';
import {
  ExportFormat,
  ExportOptions,
  getAvailableFormats,
} from '../../utils/exportUtils';

export interface BulkActionsProps {
  characters: Character[];
  selectedCharacters: Character[];
  onSelectionChange: (characters: Character[]) => void;
  className?: string;
  disabled?: boolean;
  maxSelectable?: number;
  onBulkActionStart?: (action: string, characters: Character[]) => void;
  onBulkActionComplete?: (action: string, success: boolean, details?: any) => void;
}

export const BulkActions: React.FC<BulkActionsProps> = ({
  characters,
  selectedCharacters,
  onSelectionChange,
  className = '',
  disabled = false,
  maxSelectable = 50,
  onBulkActionStart,
  onBulkActionComplete,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('png');
  const [isProcessing, setIsProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<BulkDownloadProgress | null>(null);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [quality, setQuality] = useState(0.9);
  const [maxWidth, setMaxWidth] = useState<number | undefined>(undefined);
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined);

  // Calculate statistics for selected characters
  const stats = useMemo(() => {
    const downloadStats = downloadService.getDownloadStats(selectedCharacters);
    const shareStats = shareService.getShareStats(selectedCharacters);
    
    return {
      total: selectedCharacters.length,
      ...downloadStats,
      ...shareStats,
    };
  }, [selectedCharacters]);

  // Determine available actions based on selected characters
  const availableActions = useMemo(() => {
    const actions = [];
    
    if (selectedCharacters.length > 0) {
      actions.push('delete', 'tag');
      
      // Check if any characters can be downloaded in the selected format
      const downloadable = selectedCharacters.filter(char => 
        getAvailableFormats(char).includes(selectedFormat)
      );
      
      if (downloadable.length > 0) {
        actions.push('download');
      }
      
      // Check if any characters can be shared
      const shareable = selectedCharacters.filter(char =>
        shareService.canShare(char).canShare
      );
      
      if (shareable.length > 0) {
        actions.push('share-collection');
      }
      
      // Privacy actions
      actions.push('make-public', 'make-private');
    }
    
    return actions;
  }, [selectedCharacters, selectedFormat]);

  const handleSelectAll = useCallback(() => {
    if (selectedCharacters.length === characters.length) {
      onSelectionChange([]);
    } else {
      const toSelect = characters.slice(0, maxSelectable);
      onSelectionChange(toSelect);
    }
  }, [characters, selectedCharacters, maxSelectable, onSelectionChange]);

  const handleSelectByStatus = useCallback((status: 'COMPLETED' | 'FAILED' | 'PENDING') => {
    const filtered = characters.filter(char => char.generationStatus === status);
    const toSelect = filtered.slice(0, maxSelectable);
    onSelectionChange(toSelect);
  }, [characters, maxSelectable, onSelectionChange]);

  const handleBulkDownload = useCallback(async () => {
    if (isProcessing || selectedCharacters.length === 0) return;

    setIsProcessing(true);
    setBulkProgress(null);
    onBulkActionStart?.('download', selectedCharacters);

    const options: ExportOptions = {
      format: selectedFormat,
      quality: selectedFormat === 'jpg' || selectedFormat === 'webp' ? quality : undefined,
      maxWidth,
      maxHeight,
      includeMetadata: selectedFormat === 'json',
    };

    try {
      const result = await downloadService.downloadMultipleCharacters(
        selectedCharacters,
        options,
        (progress) => {
          setBulkProgress(progress);
        }
      );

      onBulkActionComplete?.('download', result.success, { 
        result,
        characterCount: selectedCharacters.length 
      });
    } catch (error) {
      console.error('Bulk download failed:', error);
      onBulkActionComplete?.('download', false, { error });
    } finally {
      setIsProcessing(false);
      setBulkProgress(null);
    }
  }, [
    selectedCharacters,
    selectedFormat,
    quality,
    maxWidth,
    maxHeight,
    isProcessing,
    onBulkActionStart,
    onBulkActionComplete,
  ]);

  const handleCreateShareableCollection = useCallback(() => {
    const shareableCharacters = selectedCharacters.filter(char =>
      shareService.canShare(char).canShare
    );

    if (shareableCharacters.length === 0) return;

    const collectionUrl = shareService.createCollectionShareUrl(
      shareableCharacters,
      `My Character Collection (${shareableCharacters.length} characters)`
    );

    // Copy to clipboard
    navigator.clipboard.writeText(collectionUrl).then(() => {
      onBulkActionComplete?.('share-collection', true, { 
        url: collectionUrl,
        characterCount: shareableCharacters.length 
      });
    }).catch((error) => {
      console.error('Failed to copy collection URL:', error);
      onBulkActionComplete?.('share-collection', false, { error });
    });
  }, [selectedCharacters, onBulkActionComplete]);

  const estimateDownloadSize = useCallback(async () => {
    if (selectedCharacters.length === 0) return null;
    
    return await downloadService.estimateDownloadSize(selectedCharacters, selectedFormat);
  }, [selectedCharacters, selectedFormat]);

  const [sizeEstimate, setSizeEstimate] = useState<{
    estimatedSize: number;
    sizeUnit: string;
    characterCount: number;
  } | null>(null);

  // Update size estimate when format or selection changes
  React.useEffect(() => {
    if (selectedCharacters.length > 0) {
      estimateDownloadSize().then(setSizeEstimate);
    } else {
      setSizeEstimate(null);
    }
  }, [selectedCharacters, selectedFormat, estimateDownloadSize]);

  if (characters.length === 0) {
    return null;
  }

  return (
    <div className={`bulk-actions-container ${className} ${disabled ? 'disabled' : ''}`}>
      {/* Selection Controls */}
      <div className="selection-section">
        <h3>Selection ({selectedCharacters.length}/{characters.length})</h3>
        
        <div className="selection-controls">
          <button
            onClick={handleSelectAll}
            disabled={disabled || isProcessing}
            className="select-btn"
          >
            {selectedCharacters.length === characters.length ? 'Deselect All' : 'Select All'}
          </button>
          
          <button
            onClick={() => handleSelectByStatus('COMPLETED')}
            disabled={disabled || isProcessing}
            className="select-btn"
          >
            Select Completed ({characters.filter(c => c.generationStatus === 'COMPLETED').length})
          </button>
          
          <button
            onClick={() => handleSelectByStatus('FAILED')}
            disabled={disabled || isProcessing}
            className="select-btn"
          >
            Select Failed ({characters.filter(c => c.generationStatus === 'FAILED').length})
          </button>
        </div>
      </div>

      {selectedCharacters.length > 0 && (
        <>
          {/* Statistics */}
          <div className="stats-section">
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-label">Total Selected:</span>
                <span className="stat-value">{stats.total}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">With Images:</span>
                <span className="stat-value">{stats.charactersWithImages}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Completed:</span>
                <span className="stat-value">{stats.charactersCompleted}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Public:</span>
                <span className="stat-value">{stats.public}</span>
              </div>
            </div>
          </div>

          {/* Download Actions */}
          <div className="action-section">
            <h4>📥 Download Actions</h4>
            
            <div className="download-controls">
              <div className="format-control">
                <label>Format:</label>
                <select
                  value={selectedFormat}
                  onChange={(e) => setSelectedFormat(e.target.value as ExportFormat)}
                  disabled={disabled || isProcessing}
                  className="format-select"
                >
                  <option value="png">PNG (High Quality)</option>
                  <option value="jpg">JPG (Smaller Size)</option>
                  <option value="webp">WebP (Best Compression)</option>
                  <option value="json">JSON (Data Only)</option>
                </select>
              </div>

              <button
                onClick={handleBulkDownload}
                disabled={disabled || isProcessing || !availableActions.includes('download')}
                className="action-btn download-btn"
              >
                {isProcessing ? 'Processing...' : 'Download Selected'}
              </button>

              <button
                onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
                disabled={disabled || isProcessing}
                className="options-btn"
              >
                ⚙️
              </button>
            </div>

            {showAdvancedOptions && (
              <div className="advanced-options">
                {(selectedFormat === 'jpg' || selectedFormat === 'webp') && (
                  <div className="option-group">
                    <label>Quality: {Math.round(quality * 100)}%</label>
                    <input
                      type="range"
                      min="0.1"
                      max="1"
                      step="0.1"
                      value={quality}
                      onChange={(e) => setQuality(parseFloat(e.target.value))}
                      disabled={disabled || isProcessing}
                    />
                  </div>
                )}
                
                <div className="size-controls">
                  <div className="size-input-group">
                    <label>Max Width:</label>
                    <input
                      type="number"
                      value={maxWidth || ''}
                      onChange={(e) => setMaxWidth(e.target.value ? parseInt(e.target.value) : undefined)}
                      placeholder="Original"
                      min="100"
                      max="4096"
                      disabled={disabled || isProcessing}
                    />
                  </div>
                  
                  <div className="size-input-group">
                    <label>Max Height:</label>
                    <input
                      type="number"
                      value={maxHeight || ''}
                      onChange={(e) => setMaxHeight(e.target.value ? parseInt(e.target.value) : undefined)}
                      placeholder="Original"
                      min="100"
                      max="4096"
                      disabled={disabled || isProcessing}
                    />
                  </div>
                </div>
              </div>
            )}

            {sizeEstimate && (
              <div className="size-estimate">
                Estimated download size: {sizeEstimate.estimatedSize} {sizeEstimate.sizeUnit} 
                ({sizeEstimate.characterCount} characters)
              </div>
            )}
          </div>

          {/* Share Actions */}
          {availableActions.includes('share-collection') && (
            <div className="action-section">
              <h4>🔗 Share Actions</h4>
              
              <button
                onClick={handleCreateShareableCollection}
                disabled={disabled || isProcessing}
                className="action-btn share-btn"
              >
                Create Shareable Collection
              </button>
            </div>
          )}

          {/* Other Actions */}
          <div className="action-section">
            <h4>🔧 Other Actions</h4>
            
            <div className="action-group">
              <button
                onClick={() => {/* TODO: Implement bulk tag editing */}}
                disabled={disabled || isProcessing}
                className="action-btn secondary"
              >
                Edit Tags
              </button>
              
              <button
                onClick={() => {/* TODO: Implement bulk privacy change */}}
                disabled={disabled || isProcessing}
                className="action-btn secondary"
              >
                Make Public
              </button>
              
              <button
                onClick={() => {/* TODO: Implement bulk privacy change */}}
                disabled={disabled || isProcessing}
                className="action-btn secondary"
              >
                Make Private
              </button>
              
              <button
                onClick={() => {/* TODO: Implement bulk delete */}}
                disabled={disabled || isProcessing}
                className="action-btn danger"
              >
                Delete Selected
              </button>
            </div>
          </div>
        </>
      )}

      {/* Progress Display */}
      {bulkProgress && (
        <div className="progress-section">
          <h4>Progress</h4>
          
          <div className="overall-progress">
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ 
                  width: `${(bulkProgress.completed / bulkProgress.total) * 100}%` 
                }}
              ></div>
            </div>
            <div className="progress-text">
              {bulkProgress.completed} of {bulkProgress.total} completed
              {bulkProgress.failed > 0 && ` (${bulkProgress.failed} failed)`}
            </div>
          </div>

          <div className="character-progress">
            {bulkProgress.characters.map((charProgress) => (
              <div key={charProgress.characterId} className="character-progress-item">
                <span className="character-id">
                  {characters.find(c => c.id === charProgress.characterId)?.name || 'Unknown'}
                </span>
                <span className={`status ${charProgress.status}`}>
                  {charProgress.status}
                  {charProgress.error && `: ${charProgress.error}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        .bulk-actions-container {
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 8px;
          padding: 16px;
          margin: 16px 0;
        }

        .bulk-actions-container.disabled {
          opacity: 0.6;
          pointer-events: none;
        }

        .selection-section {
          margin-bottom: 16px;
        }

        .selection-section h3 {
          margin: 0 0 12px 0;
          font-size: 16px;
          color: #495057;
        }

        .selection-controls {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .select-btn {
          padding: 6px 12px;
          background: #6c757d;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .select-btn:hover:not(:disabled) {
          background: #5a6268;
        }

        .select-btn:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .stats-section {
          margin-bottom: 16px;
          padding: 12px;
          background: white;
          border-radius: 4px;
          border: 1px solid #e9ecef;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 12px;
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          text-align: center;
        }

        .stat-label {
          font-size: 12px;
          color: #6c757d;
          margin-bottom: 4px;
        }

        .stat-value {
          font-size: 18px;
          font-weight: 600;
          color: #495057;
        }

        .action-section {
          margin-bottom: 16px;
          padding: 12px;
          background: white;
          border-radius: 4px;
          border: 1px solid #e9ecef;
        }

        .action-section h4 {
          margin: 0 0 12px 0;
          font-size: 14px;
          color: #495057;
        }

        .download-controls {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 8px;
        }

        .format-control {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .format-control label {
          font-size: 14px;
          color: #495057;
        }

        .format-select {
          padding: 6px 8px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          font-size: 14px;
        }

        .action-btn {
          padding: 8px 16px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s ease;
        }

        .action-btn.download-btn {
          background: #007bff;
          color: white;
        }

        .action-btn.share-btn {
          background: #28a745;
          color: white;
        }

        .action-btn.secondary {
          background: #6c757d;
          color: white;
        }

        .action-btn.danger {
          background: #dc3545;
          color: white;
        }

        .action-btn:hover:not(:disabled) {
          filter: brightness(1.1);
          transform: translateY(-1px);
        }

        .action-btn:disabled {
          background: #6c757d !important;
          cursor: not-allowed;
          transform: none;
        }

        .options-btn {
          padding: 8px;
          background: #f8f9fa;
          border: 1px solid #ced4da;
          border-radius: 4px;
          cursor: pointer;
        }

        .advanced-options {
          margin-top: 12px;
          padding: 12px;
          background: #f8f9fa;
          border: 1px solid #dee2e6;
          border-radius: 4px;
        }

        .option-group {
          margin-bottom: 12px;
        }

        .option-group label {
          display: block;
          font-size: 12px;
          color: #6c757d;
          margin-bottom: 4px;
        }

        .size-controls {
          display: flex;
          gap: 12px;
        }

        .size-input-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .size-input-group input {
          padding: 4px 8px;
          border: 1px solid #ced4da;
          border-radius: 3px;
          font-size: 12px;
          width: 80px;
        }

        .size-estimate {
          font-size: 12px;
          color: #6c757d;
          text-align: center;
          padding: 8px;
          background: #e9ecef;
          border-radius: 4px;
        }

        .action-group {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .progress-section {
          margin-top: 16px;
          padding: 12px;
          background: white;
          border-radius: 4px;
          border: 1px solid #e9ecef;
        }

        .progress-section h4 {
          margin: 0 0 12px 0;
          font-size: 14px;
          color: #495057;
        }

        .overall-progress {
          margin-bottom: 12px;
        }

        .progress-bar {
          width: 100%;
          height: 8px;
          background: #e9ecef;
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 4px;
        }

        .progress-fill {
          height: 100%;
          background: #28a745;
          transition: width 0.3s ease;
        }

        .progress-text {
          font-size: 12px;
          color: #6c757d;
          text-align: center;
        }

        .character-progress {
          max-height: 200px;
          overflow-y: auto;
        }

        .character-progress-item {
          display: flex;
          justify-content: space-between;
          padding: 4px 0;
          border-bottom: 1px solid #f8f9fa;
          font-size: 12px;
        }

        .character-progress-item:last-child {
          border-bottom: none;
        }

        .status.completed {
          color: #28a745;
        }

        .status.failed {
          color: #dc3545;
        }

        .status.pending {
          color: #6c757d;
        }

        .status.processing {
          color: #007bff;
        }

        @media (max-width: 768px) {
          .download-controls {
            flex-direction: column;
            align-items: stretch;
          }

          .size-controls {
            flex-direction: column;
          }

          .action-group {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
};

export default BulkActions;