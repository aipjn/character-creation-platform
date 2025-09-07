import React, { useState, useCallback } from 'react';
import { BatchGenerationRequest, StyleType } from '../../types';

export interface BatchControlsProps {
  onSubmit: (request: BatchGenerationRequest) => void;
  isGenerating?: boolean;
  maxVariations?: number;
}

export const BatchControls: React.FC<BatchControlsProps> = ({
  onSubmit,
  isGenerating = false,
  maxVariations = 4
}) => {
  const [prompt, setPrompt] = useState('');
  const [styleType, setStyleType] = useState<StyleType>('cartoon');
  const [variations, setVariations] = useState(1);
  const [imageFile, setImageFile] = useState<File | undefined>();
  const [dragActive, setDragActive] = useState(false);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    if (!prompt.trim()) {
      return;
    }

    const request: BatchGenerationRequest = {
      prompt: prompt.trim(),
      styleType,
      variations,
      imageFile
    };

    onSubmit(request);
  }, [prompt, styleType, variations, imageFile, onSubmit]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setImageFile(file);
    }
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragActive(true);
    }
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        setImageFile(file);
      }
    }
  }, []);

  const removeImage = useCallback(() => {
    setImageFile(undefined);
  }, []);

  const isFormValid = prompt.trim().length > 0;

  return (
    <div className="batch-controls">
      <form onSubmit={handleSubmit} className="batch-controls-form">
        {/* Prompt Input */}
        <div className="form-group">
          <label htmlFor="prompt" className="form-label">
            Character Description
          </label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the character you want to generate..."
            className="form-textarea"
            rows={4}
            disabled={isGenerating}
            maxLength={500}
            required
          />
          <div className="form-help">
            {prompt.length}/500 characters
          </div>
        </div>

        {/* Style Selection */}
        <div className="form-group">
          <label className="form-label">Style Type</label>
          <div className="style-selector">
            <label className="radio-option">
              <input
                type="radio"
                name="style"
                value="cartoon"
                checked={styleType === 'cartoon'}
                onChange={(e) => setStyleType(e.target.value as StyleType)}
                disabled={isGenerating}
              />
              <span className="radio-label">Cartoon</span>
            </label>
            <label className="radio-option">
              <input
                type="radio"
                name="style"
                value="realistic"
                checked={styleType === 'realistic'}
                onChange={(e) => setStyleType(e.target.value as StyleType)}
                disabled={isGenerating}
              />
              <span className="radio-label">Realistic</span>
            </label>
          </div>
        </div>

        {/* Variations Count */}
        <div className="form-group">
          <label htmlFor="variations" className="form-label">
            Number of Variations (1-{maxVariations})
          </label>
          <input
            id="variations"
            type="number"
            min="1"
            max={maxVariations}
            value={variations}
            onChange={(e) => setVariations(Math.max(1, Math.min(maxVariations, parseInt(e.target.value) || 1)))}
            className="form-input"
            disabled={isGenerating}
          />
        </div>

        {/* Image Upload */}
        <div className="form-group">
          <label className="form-label">Reference Image (Optional)</label>
          <div
            className={`image-upload ${dragActive ? 'image-upload-active' : ''} ${imageFile ? 'image-upload-has-file' : ''}`}
            onDragEnter={handleDragIn}
            onDragLeave={handleDragOut}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {imageFile ? (
              <div className="image-preview">
                <img
                  src={URL.createObjectURL(imageFile)}
                  alt="Reference"
                  className="image-preview-img"
                />
                <div className="image-preview-info">
                  <span className="image-preview-name">{imageFile.name}</span>
                  <button
                    type="button"
                    onClick={removeImage}
                    className="image-preview-remove"
                    disabled={isGenerating}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="image-upload-icon">📁</div>
                <div className="image-upload-text">
                  <p>Drag and drop an image here, or click to select</p>
                  <p className="image-upload-help">Supported formats: JPG, PNG, WebP</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="image-upload-input"
                  disabled={isGenerating}
                />
              </>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="form-group">
          <button
            type="submit"
            className="btn btn-primary btn-large"
            disabled={!isFormValid || isGenerating}
          >
            {isGenerating ? (
              <>
                <span className="btn-spinner">⟳</span>
                Generating...
              </>
            ) : (
              `Generate ${variations} Variation${variations > 1 ? 's' : ''}`
            )}
          </button>
        </div>
      </form>

    </div>
  );
};

export default BatchControls;