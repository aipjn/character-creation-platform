import React, { useState, useCallback } from 'react';
import { Character } from '@prisma/client';
import {
  shareService,
  SharePlatform,
  ShareOptions,
  ShareResult,
} from '../../services/shareService';

export interface ShareButtonProps {
  character: Character;
  className?: string;
  disabled?: boolean;
  showPlatformSelector?: boolean;
  defaultPlatform?: SharePlatform;
  customMessage?: string;
  includeCredit?: boolean;
  hashtags?: string[];
  onShareStart?: (character: Character, platform: SharePlatform) => void;
  onShareComplete?: (character: Character, result: ShareResult) => void;
}

interface PlatformInfo {
  name: string;
  icon: string;
  color: string;
  requiresImage: boolean;
}

const platformInfo: Record<SharePlatform, PlatformInfo> = {
  twitter: { name: 'Twitter', icon: '🐦', color: '#1DA1F2', requiresImage: false },
  facebook: { name: 'Facebook', icon: '📘', color: '#4267B2', requiresImage: false },
  instagram: { name: 'Instagram', icon: '📷', color: '#E4405F', requiresImage: true },
  pinterest: { name: 'Pinterest', icon: '📌', color: '#BD081C', requiresImage: true },
  reddit: { name: 'Reddit', icon: '🔗', color: '#FF4500', requiresImage: false },
  discord: { name: 'Discord', icon: '💬', color: '#7289DA', requiresImage: false },
  direct: { name: 'Copy Link', icon: '🔗', color: '#6c757d', requiresImage: false },
};

export const ShareButton: React.FC<ShareButtonProps> = ({
  character,
  className = '',
  disabled = false,
  showPlatformSelector = true,
  defaultPlatform = 'twitter',
  customMessage,
  includeCredit = true,
  hashtags = [],
  onShareStart,
  onShareComplete,
}) => {
  const [selectedPlatform, setSelectedPlatform] = useState<SharePlatform>(defaultPlatform);
  const [isSharing, setIsSharing] = useState(false);
  const [shareResult, setShareResult] = useState<ShareResult | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [localCustomMessage, setLocalCustomMessage] = useState(customMessage || '');
  const [localIncludeCredit, setLocalIncludeCredit] = useState(includeCredit);
  const [localHashtags, setLocalHashtags] = useState(hashtags.join(', '));

  const availablePlatforms = shareService.getAvailableSharePlatforms(character);
  const { canShare, reasons } = shareService.canShare(character);

  const handleShare = useCallback(async () => {
    if (isSharing || !canShare) return;

    setIsSharing(true);
    setShareResult(null);
    onShareStart?.(character, selectedPlatform);

    const options: ShareOptions = {
      platform: selectedPlatform,
      customMessage: localCustomMessage || undefined,
      includeCredit: localIncludeCredit,
      hashtags: localHashtags.split(',').map(tag => tag.trim()).filter(Boolean),
    };

    try {
      let result: ShareResult;

      // Handle platforms that require copying to clipboard
      if (['discord', 'instagram', 'direct'].includes(selectedPlatform)) {
        result = await shareService.copyToClipboard(character, options);
      } else {
        result = await shareService.shareCharacter(character, options);
      }

      setShareResult(result);
      onShareComplete?.(character, result);

      // Auto-clear success message after 3 seconds
      if (result.success) {
        setTimeout(() => setShareResult(null), 3000);
      }

      // Track the share
      if (result.success) {
        await shareService.trackShare(character, selectedPlatform);
      }
    } catch (error) {
      const errorResult: ShareResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Share failed',
        platform: selectedPlatform,
      };
      setShareResult(errorResult);
      onShareComplete?.(character, errorResult);
    } finally {
      setIsSharing(false);
    }
  }, [
    character,
    selectedPlatform,
    localCustomMessage,
    localIncludeCredit,
    localHashtags,
    isSharing,
    canShare,
    onShareStart,
    onShareComplete,
  ]);

  const platformSupported = availablePlatforms.includes(selectedPlatform);
  const platformRequiresImage = platformInfo[selectedPlatform]?.requiresImage;
  const hasImage = character.s3Url && character.generationStatus === 'COMPLETED';

  if (!canShare && reasons.length > 0) {
    return (
      <div className={`share-button-container disabled ${className}`}>
        <div className="share-message warning">
          {reasons.map((reason, index) => (
            <div key={index}>{reason}</div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`share-button-container ${className}`}>
      <div className="share-controls">
        {showPlatformSelector && availablePlatforms.length > 1 && (
          <div className="platform-selector">
            <select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value as SharePlatform)}
              disabled={isSharing}
              className="platform-select"
            >
              {availablePlatforms.map((platform) => (
                <option key={platform} value={platform}>
                  {platformInfo[platform].icon} {platformInfo[platform].name}
                </option>
              ))}
            </select>
          </div>
        )}

        <button
          onClick={handleShare}
          disabled={disabled || isSharing || !platformSupported || (platformRequiresImage && !hasImage)}
          className={`share-btn ${isSharing ? 'sharing' : ''}`}
          style={{ 
            backgroundColor: platformSupported ? platformInfo[selectedPlatform].color : '#6c757d' 
          }}
        >
          {isSharing ? (
            <>
              <span className="spinner"></span>
              Sharing...
            </>
          ) : (
            <>
              <span className="share-icon">{platformInfo[selectedPlatform].icon}</span>
              Share
            </>
          )}
        </button>

        {showPlatformSelector && (
          <button
            type="button"
            onClick={() => setShowOptions(!showOptions)}
            className="options-toggle"
            disabled={isSharing}
          >
            ⚙️
          </button>
        )}
      </div>

      {showOptions && (
        <div className="share-options">
          <div className="option-group">
            <label htmlFor={`message-${character.id}`}>Custom Message:</label>
            <textarea
              id={`message-${character.id}`}
              value={localCustomMessage}
              onChange={(e) => setLocalCustomMessage(e.target.value)}
              placeholder={`Check out my character: ${character.name}`}
              disabled={isSharing}
              className="message-input"
              rows={2}
            />
          </div>

          <div className="option-group">
            <label htmlFor={`hashtags-${character.id}`}>Hashtags (comma-separated):</label>
            <input
              id={`hashtags-${character.id}`}
              type="text"
              value={localHashtags}
              onChange={(e) => setLocalHashtags(e.target.value)}
              placeholder="AI, characterart, digitalart"
              disabled={isSharing}
              className="hashtags-input"
            />
          </div>

          <div className="option-group checkbox-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={localIncludeCredit}
                onChange={(e) => setLocalIncludeCredit(e.target.checked)}
                disabled={isSharing}
              />
              Include app credit
            </label>
          </div>
        </div>
      )}

      {shareResult && (
        <div className={`share-result ${shareResult.success ? 'success' : 'error'}`}>
          {shareResult.success ? (
            <div>
              {['discord', 'instagram', 'direct'].includes(shareResult.platform) ? (
                <span>✅ Copied to clipboard!</span>
              ) : (
                <span>✅ Shared successfully!</span>
              )}
            </div>
          ) : (
            <div>❌ {shareResult.error}</div>
          )}
        </div>
      )}

      {platformRequiresImage && !hasImage && (
        <div className="share-message warning">
          <span>⚠️ {platformInfo[selectedPlatform].name} requires an image</span>
        </div>
      )}

      {!platformSupported && (
        <div className="share-message warning">
          <span>⚠️ Platform not available for this character</span>
        </div>
      )}

      <style jsx>{`
        .share-button-container {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .share-button-container.disabled {
          opacity: 0.6;
        }

        .share-controls {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .platform-select {
          padding: 6px 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: white;
          font-size: 14px;
        }

        .platform-select:disabled {
          background: #f5f5f5;
          cursor: not-allowed;
        }

        .share-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s ease;
          min-width: 90px;
          justify-content: center;
        }

        .share-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          filter: brightness(1.1);
        }

        .share-btn:disabled {
          background: #6c757d !important;
          cursor: not-allowed;
          transform: none;
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

        .share-options {
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

        .message-input,
        .hashtags-input {
          padding: 6px 8px;
          border: 1px solid #ddd;
          border-radius: 3px;
          font-size: 14px;
          font-family: inherit;
        }

        .message-input {
          resize: vertical;
          min-height: 40px;
        }

        .checkbox-group {
          flex-direction: row;
          align-items: center;
          gap: 8px;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 14px;
          cursor: pointer;
        }

        .checkbox-label input {
          margin: 0;
        }

        .share-result {
          padding: 8px 12px;
          border-radius: 4px;
          font-size: 14px;
          text-align: center;
          font-weight: 500;
        }

        .share-result.success {
          background: #d4edda;
          color: #155724;
          border: 1px solid #c3e6cb;
        }

        .share-result.error {
          background: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }

        .share-message {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .share-message.warning {
          font-size: 12px;
          color: #856404;
          background: #fff3cd;
          padding: 6px 8px;
          border-radius: 3px;
          border: 1px solid #ffeaa7;
        }

        .share-icon {
          font-size: 16px;
        }

        @media (max-width: 768px) {
          .share-controls {
            flex-direction: column;
            align-items: stretch;
          }

          .platform-select,
          .share-btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};

export default ShareButton;