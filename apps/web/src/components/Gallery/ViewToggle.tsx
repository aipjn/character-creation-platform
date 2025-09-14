import React, { useCallback } from 'react';
import { GalleryView } from '../../types/gallery';
import '../../styles/gallery.scss';

interface ViewToggleProps {
  currentView: GalleryView;
  onViewChange: (view: GalleryView) => void;
  disabled?: boolean;
  className?: string;
  showLabels?: boolean;
  size?: 'small' | 'medium' | 'large';
}

// View option configuration
interface ViewOption {
  value: GalleryView;
  icon: string;
  label: string;
  description: string;
}

const viewOptions: ViewOption[] = [
  {
    value: 'grid',
    icon: '⊞',
    label: 'Grid',
    description: 'Display characters in a grid layout'
  },
  {
    value: 'list',
    icon: '☰',
    label: 'List',
    description: 'Display characters in a list layout'
  }
];

export const ViewToggle: React.FC<ViewToggleProps> = ({
  currentView,
  onViewChange,
  disabled = false,
  className = '',
  showLabels = false,
  size = 'medium',
}) => {
  // Handle view change
  const handleViewChange = useCallback((view: GalleryView) => {
    if (!disabled && view !== currentView) {
      onViewChange(view);
    }
  }, [currentView, onViewChange, disabled]);

  // Generate toggle classes
  const toggleClasses = [
    'view-toggle',
    `view-toggle--${size}`,
    disabled && 'view-toggle--disabled',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={toggleClasses} role="radiogroup" aria-label="Gallery view options">
      {viewOptions.map((option) => {
        const isActive = option.value === currentView;
        const buttonClasses = [
          'view-toggle__button',
          isActive && 'active',
        ].filter(Boolean).join(' ');

        return (
          <button
            key={option.value}
            type="button"
            className={buttonClasses}
            onClick={() => handleViewChange(option.value)}
            disabled={disabled}
            aria-pressed={isActive}
            aria-label={option.description}
            title={showLabels ? undefined : option.description}
          >
            <span className="view-toggle__icon" aria-hidden="true">
              {option.icon}
            </span>
            {showLabels && (
              <span className="view-toggle__label">
                {option.label}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

// Enhanced ViewToggle with additional features
interface EnhancedViewToggleProps extends ViewToggleProps {
  showCounts?: boolean;
  gridCount?: number;
  listCount?: number;
  onViewOptionSelect?: (view: GalleryView, option: string) => void;
}

export const EnhancedViewToggle: React.FC<EnhancedViewToggleProps> = ({
  showCounts = false,
  gridCount,
  listCount,
  onViewOptionSelect,
  ...props
}) => {
  const handleOptionSelect = useCallback((view: GalleryView) => (e: React.MouseEvent) => {
    e.preventDefault();
    if (e.detail === 2) { // Double click for options
      onViewOptionSelect?.(view, 'configure');
    }
  }, [onViewOptionSelect]);

  return (
    <div className="enhanced-view-toggle">
      <ViewToggle {...props} />
      {showCounts && (
        <div className="view-toggle__counts">
          <span className="view-toggle__count">
            {props.currentView === 'grid' ? gridCount : listCount} items
          </span>
        </div>
      )}
    </div>
  );
};

export default ViewToggle;