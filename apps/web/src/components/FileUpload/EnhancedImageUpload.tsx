import React, { useState, useCallback, useRef, useMemo } from 'react';

export interface UploadedImage {
  id: string;
  file: File;
  url: string;
  name: string;
  size: number;
  type: string;
  width?: number;
  height?: number;
}

export interface EnhancedImageUploadProps {
  onUpload?: (images: UploadedImage[]) => void;
  onRemove?: (imageId: string) => void;
  onUrlAdd?: (url: string) => void;
  maxFiles?: number;
  maxFileSize?: number; // in bytes
  acceptedTypes?: string[];
  existingImages?: UploadedImage[];
  disabled?: boolean;
  showUrlInput?: boolean;
  showPreview?: boolean;
  'data-testid'?: string;
}

const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp'
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_FILES = 5;

export const EnhancedImageUpload: React.FC<EnhancedImageUploadProps> = ({
  onUpload,
  onRemove,
  onUrlAdd,
  maxFiles = MAX_FILES,
  maxFileSize = MAX_FILE_SIZE,
  acceptedTypes = ACCEPTED_IMAGE_TYPES,
  existingImages = [],
  disabled = false,
  showUrlInput = true,
  showPreview = true,
  'data-testid': testId = 'enhanced-image-upload',
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [urlInput, setUrlInput] = useState('');
  const [previewUrls, setPreviewUrls] = useState<Map<string, string>>(new Map());
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canAddMore = useMemo(() => {
    return existingImages.length < maxFiles;
  }, [existingImages.length, maxFiles]);

  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  const validateFile = useCallback((file: File): string | null => {
    if (!acceptedTypes.includes(file.type)) {
      return `File type ${file.type} is not supported`;
    }
    if (file.size > maxFileSize) {
      return `File size ${formatFileSize(file.size)} exceeds limit of ${formatFileSize(maxFileSize)}`;
    }
    return null;
  }, [acceptedTypes, maxFileSize, formatFileSize]);

  const getImageDimensions = useCallback((file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ width: 0, height: 0 });
      };
      img.src = url;
    });
  }, []);

  const processFiles = useCallback(async (files: File[]) => {
    if (disabled || !canAddMore) return;

    setIsUploading(true);
    setErrors([]);

    const newImages: UploadedImage[] = [];
    const newErrors: string[] = [];

    const remainingSlots = maxFiles - existingImages.length;
    const filesToProcess = files.slice(0, remainingSlots);

    for (const file of filesToProcess) {
      const error = validateFile(file);
      if (error) {
        newErrors.push(`${file.name}: ${error}`);
        continue;
      }

      try {
        const dimensions = await getImageDimensions(file);
        const imageId = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const url = URL.createObjectURL(file);
        
        const uploadedImage: UploadedImage = {
          id: imageId,
          file,
          url,
          name: file.name,
          size: file.size,
          type: file.type,
          width: dimensions.width,
          height: dimensions.height,
        };

        newImages.push(uploadedImage);
        setPreviewUrls(prev => new Map(prev).set(imageId, url));
      } catch (error) {
        newErrors.push(`${file.name}: Failed to process image`);
      }
    }

    if (newErrors.length > 0) {
      setErrors(newErrors);
    }

    if (newImages.length > 0 && onUpload) {
      onUpload(newImages);
    }

    setIsUploading(false);
  }, [disabled, canAddMore, maxFiles, existingImages.length, validateFile, getImageDimensions, onUpload]);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0) {
      processFiles(files);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [processFiles]);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(event.dataTransfer.files);
    if (files.length > 0) {
      processFiles(files);
    }
  }, [processFiles]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    if (!disabled && canAddMore) {
      setIsDragOver(true);
    }
  }, [disabled, canAddMore]);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleRemoveImage = useCallback((imageId: string) => {
    const url = previewUrls.get(imageId);
    if (url) {
      URL.revokeObjectURL(url);
      setPreviewUrls(prev => {
        const newMap = new Map(prev);
        newMap.delete(imageId);
        return newMap;
      });
    }
    onRemove?.(imageId);
  }, [previewUrls, onRemove]);

  const handleUrlSubmit = useCallback(() => {
    if (!urlInput.trim() || disabled) return;

    const url = urlInput.trim();
    
    // Basic URL validation
    try {
      new URL(url);
    } catch {
      setErrors(['Please enter a valid URL']);
      return;
    }

    // Check if it's likely an image URL
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const hasImageExtension = imageExtensions.some(ext => 
      url.toLowerCase().includes(`.${ext}`)
    );

    if (!hasImageExtension) {
      setErrors(['URL does not appear to be an image. Please check the URL.']);
      return;
    }

    setErrors([]);
    onUrlAdd?.(url);
    setUrlInput('');
  }, [urlInput, disabled, onUrlAdd]);

  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleUrlSubmit();
    }
  }, [handleUrlSubmit]);

  return (
    <div className="enhanced-image-upload" data-testid={testId} style={{
      width: '100%'
    }}>
      {/* Upload Area */}
      <div
        className={`upload-area ${isDragOver ? 'drag-over' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && canAddMore && fileInputRef.current?.click()}
        style={{
          border: `2px dashed ${
            isDragOver ? '#3b82f6' : 
            disabled || !canAddMore ? '#d1d5db' : '#9ca3af'
          }`,
          borderRadius: '12px',
          padding: '32px',
          textAlign: 'center',
          backgroundColor: isDragOver ? '#eff6ff' : 
            disabled || !canAddMore ? '#f9fafb' : 'white',
          cursor: disabled || !canAddMore ? 'not-allowed' : 'pointer',
          transition: 'all 0.3s ease',
          marginBottom: '16px',
          opacity: disabled || !canAddMore ? 0.6 : 1,
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes.join(',')}
          multiple={maxFiles > 1}
          onChange={handleFileSelect}
          disabled={disabled || !canAddMore}
          style={{ display: 'none' }}
        />
        
        {isUploading ? (
          <div>
            <div style={{
              width: '40px',
              height: '40px',
              border: '3px solid #e5e7eb',
              borderTop: '3px solid #3b82f6',
              borderRadius: '50%',
              margin: '0 auto 16px',
              animation: 'spin 1s linear infinite',
            }} />
            <p style={{ fontSize: '14px', color: '#6b7280', margin: 0 }}>
              Processing images...
            </p>
          </div>
        ) : (
          <div>
            <div style={{
              fontSize: '48px',
              marginBottom: '16px',
              opacity: disabled || !canAddMore ? 0.5 : 1,
            }}>
              📸
            </div>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '600',
              color: disabled || !canAddMore ? '#9ca3af' : '#111827',
              margin: '0 0 8px 0'
            }}>
              {!canAddMore ? 'Maximum files reached' : 'Drop images here or click to browse'}
            </h3>
            <p style={{
              fontSize: '14px',
              color: '#6b7280',
              margin: '0 0 8px 0'
            }}>
              Support: {acceptedTypes.join(', ').replace(/image\//g, '').toUpperCase()}
            </p>
            <p style={{
              fontSize: '12px',
              color: '#9ca3af',
              margin: 0
            }}>
              Max {maxFiles} files, {formatFileSize(maxFileSize)} each
            </p>
          </div>
        )}
      </div>

      {/* URL Input */}
      {showUrlInput && (
        <div style={{
          marginBottom: '16px',
          padding: '16px',
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          border: '1px solid #e5e7eb'
        }}>
          <h4 style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#111827',
            margin: '0 0 8px 0'
          }}>
            Or add from URL
          </h4>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="url"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={disabled || !canAddMore}
              placeholder="https://example.com/image.jpg"
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                color: '#374151'
              }}
            />
            <button
              onClick={handleUrlSubmit}
              disabled={!urlInput.trim() || disabled || !canAddMore}
              style={{
                padding: '8px 16px',
                backgroundColor: (!urlInput.trim() || disabled || !canAddMore) ? '#9ca3af' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: (!urlInput.trim() || disabled || !canAddMore) ? 'not-allowed' : 'pointer'
              }}
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* Errors */}
      {errors.length > 0 && (
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '6px',
          padding: '12px',
          marginBottom: '16px'
        }}>
          <h4 style={{ fontSize: '14px', fontWeight: '600', color: '#dc2626', margin: '0 0 8px 0' }}>
            Upload Errors:
          </h4>
          <ul style={{ fontSize: '12px', color: '#991b1b', margin: 0, paddingLeft: '16px' }}>
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Image Previews */}
      {showPreview && existingImages.length > 0 && (
        <div>
          <h4 style={{
            fontSize: '14px',
            fontWeight: '600',
            color: '#111827',
            margin: '0 0 12px 0'
          }}>
            Reference Images ({existingImages.length}/{maxFiles})
          </h4>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: '12px'
          }}>
            {existingImages.map(image => (
              <div
                key={image.id}
                style={{
                  position: 'relative',
                  backgroundColor: '#f3f4f6',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  border: '1px solid #e5e7eb'
                }}
              >
                <img
                  src={image.url}
                  alt={image.name}
                  style={{
                    width: '100%',
                    height: '120px',
                    objectFit: 'cover'
                  }}
                  loading="lazy"
                />
                
                {/* Remove button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveImage(image.id);
                  }}
                  disabled={disabled}
                  style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    width: '24px',
                    height: '24px',
                    backgroundColor: 'rgba(239, 68, 68, 0.9)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '12px',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: disabled ? 0.5 : 1,
                  }}
                >
                  ✕
                </button>

                {/* Image info */}
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.7)',
                  color: 'white',
                  padding: '4px 6px',
                  fontSize: '10px'
                }}>
                  <div style={{ fontWeight: '500', marginBottom: '2px' }}>
                    {image.name.length > 15 ? `${image.name.slice(0, 15)}...` : image.name}
                  </div>
                  <div style={{ opacity: 0.8 }}>
                    {formatFileSize(image.size)}
                    {image.width && image.height && ` • ${image.width}×${image.height}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default EnhancedImageUpload;