import React, { useCallback, useState } from 'react';
import { UploadValidator, ValidationResult, defaultValidator } from './UploadValidator';

export interface DropZoneProps {
  onFilesSelected: (files: File[]) => void;
  onValidationError: (error: string) => void;
  validator?: UploadValidator;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const DropZone: React.FC<DropZoneProps> = ({
  onFilesSelected,
  onValidationError,
  validator = defaultValidator,
  multiple = false,
  disabled = false,
  className = '',
  children
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const processFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsProcessing(true);
    const fileArray = Array.from(files);

    // Validate files
    const validationResult: ValidationResult = validator.validateFiles(fileArray);
    if (!validationResult.isValid) {
      onValidationError(validationResult.error || 'Invalid file');
      setIsProcessing(false);
      return;
    }

    // If not multiple, take only the first file
    const finalFiles = multiple ? fileArray : [fileArray[0]];

    // Additional image validation for each file
    try {
      for (const file of finalFiles) {
        const imageValidation = await validator.validateImageFile(file);
        if (!imageValidation.isValid) {
          onValidationError(imageValidation.error || 'Invalid image file');
          setIsProcessing(false);
          return;
        }
      }
      
      onFilesSelected(finalFiles);
    } catch (error) {
      onValidationError('Error processing files');
    } finally {
      setIsProcessing(false);
    }
  }, [validator, multiple, onFilesSelected, onValidationError]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (disabled || isProcessing) return;

    processFiles(e.dataTransfer.files);
  }, [disabled, isProcessing, processFiles]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (disabled || isProcessing) return;
    
    setIsDragOver(true);
  }, [disabled, isProcessing]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only set drag over to false if we're leaving the dropzone entirely
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    
    setIsDragOver(false);
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
    // Reset input to allow selecting the same file again
    e.target.value = '';
  }, [processFiles]);

  const handleClick = useCallback(() => {
    if (disabled || isProcessing) return;
    
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = multiple;
    input.accept = 'image/*';
    input.style.display = 'none';
    
    input.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      processFiles(target.files);
    });
    
    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  }, [disabled, isProcessing, multiple, processFiles]);

  const dropZoneClasses = [
    'dropzone',
    isDragOver && !disabled ? 'dropzone--drag-over' : '',
    disabled ? 'dropzone--disabled' : '',
    isProcessing ? 'dropzone--processing' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div
      className={dropZoneClasses}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={multiple ? 'Upload multiple images' : 'Upload image'}
      style={{
        border: '2px dashed #ccc',
        borderRadius: '8px',
        padding: '2rem',
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        backgroundColor: isDragOver && !disabled ? '#f0f8ff' : '#fafafa',
        borderColor: isDragOver && !disabled ? '#007bff' : '#ccc',
        opacity: disabled ? 0.6 : 1,
        transition: 'all 0.2s ease-in-out',
        minHeight: '120px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '0.5rem'
      }}
    >
      {children || (
        <>
          <div style={{ fontSize: '1.2rem', color: '#666' }}>
            {isProcessing ? (
              'Processing files...'
            ) : isDragOver ? (
              'Drop files here'
            ) : (
              <>
                <div>📁 Drop {multiple ? 'images' : 'an image'} here or click to browse</div>
                <div style={{ fontSize: '0.9rem', color: '#999', marginTop: '0.5rem' }}>
                  Supported formats: JPG, PNG, WebP (max 5MB)
                </div>
              </>
            )}
          </div>
        </>
      )}
      
      {/* Hidden file input for accessibility */}
      <input
        type="file"
        multiple={multiple}
        accept="image/*"
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
        disabled={disabled}
        aria-hidden="true"
      />
    </div>
  );
};

export default DropZone;