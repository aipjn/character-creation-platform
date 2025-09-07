import React, { useState, useCallback } from 'react';
import { Character } from '@prisma/client';
import {
  downloadService,
  DownloadProgress,
} from '../../services/downloadService';
import {
  ExportFormat,
  ExportOptions,
  getAvailableFormats,
} from '../../utils/exportUtils';

export interface DownloadButtonProps {
  character: Character;
  className?: string;
  disabled?: boolean;
  showFormatSelector?: boolean;
  defaultFormat?: ExportFormat;
  onDownloadStart?: (character: Character, format: ExportFormat) => void;
  onDownloadComplete?: (character: Character, success: boolean) => void;
  onDownloadProgress?: (progress: DownloadProgress) => void;
}

export const DownloadButton: React.FC<DownloadButtonProps> = ({
  character,
  className = '',
  disabled = false,
  showFormatSelector = true,
  defaultFormat = 'png',
  onDownloadStart,
  onDownloadComplete,
  onDownloadProgress,
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>(defaultFormat);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [showOptions, setShowOptions] = useState(false);

  const availableFormats = getAvailableFormats(character);

  // Quality options for lossy formats
  const [quality, setQuality] = useState(0.9);
  const [maxWidth, setMaxWidth] = useState<number | undefined>(undefined);
  const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined);

  const handleDownload = useCallback(async () => {
    if (isDownloading) return;

    setIsDownloading(true);
    setDownloadProgress(null);
    onDownloadStart?.(character, selectedFormat);

    const options: ExportOptions = {
      format: selectedFormat,
      quality: selectedFormat === 'jpg' || selectedFormat === 'webp' ? quality : undefined,
      maxWidth,
      maxHeight,
      includeMetadata: selectedFormat === 'json',
    };

    try {
      const result = await downloadService.downloadCharacter(
        character,
        options,
        (progress) => {
          setDownloadProgress(progress);
          onDownloadProgress?.(progress);
        }
      );

      onDownloadComplete?.(character, result.success);
    } catch (error) {
      console.error('Download failed:', error);
      onDownloadComplete?.(character, false);
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  }, [
    character,
    selectedFormat,
    quality,
    maxWidth,
    maxHeight,
    isDownloading,
    onDownloadStart,
    onDownloadComplete,
    onDownloadProgress,
  ]);

  const formatLabels: Record<ExportFormat, string> = {
    png: 'PNG (High Quality)',
    jpg: 'JPG (Smaller Size)',
    webp: 'WebP (Best Compression)',
    json: 'JSON (Data Only)',
  };

  const canDownload = availableFormats.includes(selectedFormat) && !disabled;

  if (availableFormats.length === 0) {
    return null;
  }

  return (
    <div className={`download-button-container ${className}`}>
      <div className="download-controls">
        {showFormatSelector && availableFormats.length > 1 && (
          <div className="format-selector">
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value as ExportFormat)}
              disabled={isDownloading}
              className="format-select"
            >
              {availableFormats.map((format) => (
                <option key={format} value={format}>
                  {formatLabels[format]}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={handleDownload}
          disabled={!canDownload || isDownloading}
          className={`download-btn ${isDownloading ? 'downloading' : ''} ${
            !canDownload ? 'disabled' : ''
          }`}
        >
          {isDownloading ? (
            <>
              <span className="spinner"></span>
              Downloading...
            </>
          ) : (
            <>
              <span className="download-icon">⬇</span>
              Download
            </>
          )}
        </button>

        {showFormatSelector && (selectedFormat === 'jpg' || selectedFormat === 'webp' || maxWidth || maxHeight) && (
          <button
            type="button"
            onClick={() => setShowOptions(!showOptions)}
            className="options-toggle"
            disabled={isDownloading}
          >
            ⚙️
          </button>
        )}
      </div>

      {showOptions && (
        <div className="download-options">
          {(selectedFormat === 'jpg' || selectedFormat === 'webp') && (
            <div className="option-group">
              <label htmlFor={`quality-${character.id}`}>
                Quality: {Math.round(quality * 100)}%
              </label>
              <input
                id={`quality-${character.id}`}
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={quality}
                onChange={(e) => setQuality(parseFloat(e.target.value))}
                disabled={isDownloading}
                className="quality-slider"
              />
            </div>
          )}

          <div className="option-group">
            <label htmlFor={`maxWidth-${character.id}`}>Max Width (px):</label>
            <input
              id={`maxWidth-${character.id}`}
              type="number"
              value={maxWidth || ''}
              onChange={(e) => setMaxWidth(e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="Original"
              min="100"
              max="4096"
              disabled={isDownloading}
              className="size-input"
            />
          </div>

          <div className="option-group">
            <label htmlFor={`maxHeight-${character.id}`}>Max Height (px):</label>
            <input
              id={`maxHeight-${character.id}`}
              type="number"
              value={maxHeight || ''}
              onChange={(e) => setMaxHeight(e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="Original"
              min="100"
              max="4096"
              disabled={isDownloading}
              className="size-input"
            />
          </div>
        </div>
      )}

      {downloadProgress && (
        <div className="download-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${downloadProgress.progress}%` }}
            ></div>
          </div>
          <span className="progress-text">
            {downloadProgress.status === 'downloading' && 'Downloading...'}
            {downloadProgress.status === 'processing' && 'Processing...'}
            {downloadProgress.status === 'completed' && 'Complete!'}
            {downloadProgress.status === 'failed' && `Failed: ${downloadProgress.error}`}
          </span>
        </div>
      )}

      {!canDownload && availableFormats.includes(selectedFormat) && (
        <div className="download-message">
          {character.generationStatus !== 'COMPLETED' && (
            <span className="warning">Character generation in progress</span>
          )}
          {!character.s3Url && selectedFormat !== 'json' && (
            <span className="warning">Image not available for download</span>
          )}
        </div>
      )}

      <style jsx>{`
        .download-button-container {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .download-controls {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .format-select {
          padding: 6px 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: white;
          font-size: 14px;
        }

        .format-select:disabled {
          background: #f5f5f5;
          cursor: not-allowed;
        }

        .download-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s ease;
        }

        .download-btn:hover:not(:disabled) {
          background: #0056b3;
          transform: translateY(-1px);
        }

        .download-btn:disabled {
          background: #6c757d;
          cursor: not-allowed;
          transform: none;
        }

        .download-btn.downloading {
          background: #28a745;
        }

        .options-toggle {
          padding: 8px;
          background: #f8f9fa;
          border: 1px solid #ddd;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }

        .options-toggle:hover:not(:disabled) {
          background: #e9ecef;
        }

        .options-toggle:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .spinner {
          width: 12px;
          height: 12px;
          border: 2px solid transparent;
          border-top: 2px solid currentColor;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .download-options {
          background: #f8f9fa;
          border: 1px solid #ddd;
          border-radius: 4px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .option-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .option-group label {
          font-size: 12px;
          font-weight: 500;
          color: #495057;
        }

        .quality-slider {
          width: 100%;
        }

        .size-input {
          padding: 4px 8px;
          border: 1px solid #ddd;
          border-radius: 3px;
          font-size: 12px;
          width: 80px;
        }

        .download-progress {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .progress-bar {
          width: 100%;
          height: 8px;
          background: #e9ecef;
          border-radius: 4px;
          overflow: hidden;
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

        .download-message {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .warning {
          font-size: 12px;
          color: #dc3545;
          background: #f8d7da;
          padding: 4px 8px;
          border-radius: 3px;
          border: 1px solid #f5c6cb;
        }

        .download-icon {
          font-size: 16px;
        }

        @media (max-width: 768px) {
          .download-controls {
            flex-direction: column;
            align-items: stretch;
          }

          .format-select,
          .download-btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default DownloadButton;