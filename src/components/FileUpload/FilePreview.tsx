import React, { useState, useEffect } from 'react';
import { UploadValidator } from './UploadValidator';

export interface FilePreviewProps {
  file: File;
  onRemove?: () => void;
  showDetails?: boolean;
  className?: string;
  maxWidth?: number;
  maxHeight?: number;
}

export const FilePreview: React.FC<FilePreviewProps> = ({
  file,
  onRemove,
  showDetails = true,
  className = '',
  maxWidth = 200,
  maxHeight = 200
}) => {
  const [imageUrl, setImageUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!file) return;

    // Create object URL for image preview
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    setLoading(false);

    // Cleanup function to revoke URL
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const handleImageError = () => {
    setError('Failed to load image preview');
    setLoading(false);
  };

  const handleImageLoad = () => {
    setError('');
    setLoading(false);
  };

  const formatFileSize = (bytes: number): string => {
    return UploadValidator.formatFileSize(bytes);
  };

  const getFileExtension = (filename: string): string => {
    return filename.split('.').pop()?.toUpperCase() || '';
  };

  const previewClasses = [
    'file-preview',
    error ? 'file-preview--error' : '',
    loading ? 'file-preview--loading' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div 
      className={previewClasses}
      style={{
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '1rem',
        backgroundColor: '#fff',
        position: 'relative',
        maxWidth: '250px'
      }}
    >
      {/* Remove button */}
      {onRemove && (
        <button
          onClick={onRemove}
          className="file-preview__remove"
          aria-label="Remove file"
          style={{
            position: 'absolute',
            top: '0.5rem',
            right: '0.5rem',
            background: '#ff4757',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '24px',
            height: '24px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: 'bold',
            zIndex: 1
          }}
        >
          ×
        </button>
      )}

      {/* Image preview */}
      <div 
        className="file-preview__image"
        style={{
          marginBottom: showDetails ? '0.75rem' : 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: loading ? '100px' : 'auto'
        }}
      >
        {loading && (
          <div style={{ color: '#666' }}>Loading preview...</div>
        )}
        
        {error && (
          <div 
            style={{ 
              color: '#ff4757',
              textAlign: 'center',
              fontSize: '0.9rem'
            }}
          >
            {error}
          </div>
        )}
        
        {!loading && !error && imageUrl && (
          <img
            src={imageUrl}
            alt={`Preview of ${file.name}`}
            onLoad={handleImageLoad}
            onError={handleImageError}
            style={{
              maxWidth: `${maxWidth}px`,
              maxHeight: `${maxHeight}px`,
              width: 'auto',
              height: 'auto',
              borderRadius: '4px',
              display: 'block'
            }}
          />
        )}
      </div>

      {/* File details */}
      {showDetails && (
        <div className="file-preview__details">
          <div 
            className="file-preview__filename"
            style={{
              fontSize: '0.9rem',
              fontWeight: '500',
              marginBottom: '0.25rem',
              wordBreak: 'break-all',
              lineHeight: '1.3'
            }}
            title={file.name}
          >
            {file.name.length > 30 
              ? `${file.name.substring(0, 30)}...` 
              : file.name
            }
          </div>
          
          <div 
            className="file-preview__metadata"
            style={{
              fontSize: '0.8rem',
              color: '#666',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <span>{getFileExtension(file.name)}</span>
            <span>{formatFileSize(file.size)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export interface FilePreviewListProps {
  files: File[];
  onRemoveFile?: (index: number) => void;
  showDetails?: boolean;
  className?: string;
  maxWidth?: number;
  maxHeight?: number;
}

export const FilePreviewList: React.FC<FilePreviewListProps> = ({
  files,
  onRemoveFile,
  showDetails = true,
  className = '',
  maxWidth = 150,
  maxHeight = 150
}) => {
  if (files.length === 0) {
    return null;
  }

  return (
    <div 
      className={`file-preview-list ${className}`}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: '1rem',
        marginTop: '1rem'
      }}
    >
      {files.map((file, index) => (
        <FilePreview
          key={`${file.name}-${file.size}-${index}`}
          file={file}
          onRemove={onRemoveFile ? () => onRemoveFile(index) : undefined}
          showDetails={showDetails}
          maxWidth={maxWidth}
          maxHeight={maxHeight}
        />
      ))}
    </div>
  );
};

export default FilePreview;