import React, { useState, useCallback } from 'react';
import { CharacterAttributePresets, PhysicalTraits } from '../../types/character';

export interface CharacterAttributesFormData {
  age?: string;
  gender?: string;
  occupation?: string;
  personality: string[];
  physicalTraits?: PhysicalTraits;
  clothing?: string;
  background?: string;
  referenceImageUrl?: string;
}

export interface CharacterAttributesFormProps {
  value: CharacterAttributesFormData;
  onChange: (data: CharacterAttributesFormData) => void;
  disabled?: boolean;
  presets?: CharacterAttributePresets;
  'data-testid'?: string;
}

const defaultPresets: CharacterAttributePresets = {
  ages: ['Child', 'Teen', 'Young Adult', 'Adult', 'Middle-aged', 'Elder', 'Ancient'],
  genders: ['Male', 'Female', 'Non-binary', 'Other'],
  occupations: [
    'Warrior', 'Mage', 'Rogue', 'Archer', 'Knight', 'Assassin',
    'Healer', 'Scholar', 'Merchant', 'Blacksmith', 'Noble', 'Peasant',
    'Pirate', 'Explorer', 'Artist', 'Musician', 'Chef', 'Engineer'
  ],
  personalityTraits: [
    'Brave', 'Cowardly', 'Kind', 'Cruel', 'Intelligent', 'Simple',
    'Cheerful', 'Melancholy', 'Honest', 'Deceptive', 'Loyal', 'Treacherous',
    'Patient', 'Impulsive', 'Generous', 'Greedy', 'Humble', 'Arrogant',
    'Calm', 'Hot-tempered', 'Curious', 'Indifferent', 'Optimistic', 'Pessimistic'
  ],
  physicalOptions: {
    heights: ['Very Short', 'Short', 'Average', 'Tall', 'Very Tall'],
    builds: ['Slender', 'Athletic', 'Muscular', 'Heavy', 'Stocky'],
    hairColors: ['Black', 'Brown', 'Blonde', 'Red', 'White', 'Silver', 'Blue', 'Green', 'Purple'],
    hairStyles: ['Short', 'Medium', 'Long', 'Curly', 'Straight', 'Wavy', 'Braided', 'Bald'],
    eyeColors: ['Brown', 'Blue', 'Green', 'Hazel', 'Gray', 'Amber', 'Red', 'Purple'],
    skinTones: ['Very Light', 'Light', 'Medium', 'Tan', 'Dark', 'Very Dark', 'Pale', 'Olive']
  },
  clothingStyles: [
    'Casual Modern', 'Formal', 'Medieval', 'Fantasy', 'Steampunk',
    'Cyberpunk', 'Victorian', 'Pirate', 'Noble Robes', 'Armor',
    'Peasant Clothes', 'Wizard Robes', 'Leather Armor', 'Royal Garments'
  ]
};

export const CharacterAttributesForm: React.FC<CharacterAttributesFormProps> = ({
  value,
  onChange,
  disabled = false,
  presets = defaultPresets,
  'data-testid': testId = 'character-attributes-form',
}) => {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    basic: true,
    personality: false,
    physical: false,
    style: false,
    background: false,
  });

  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  }, []);

  const handleInputChange = useCallback((field: keyof CharacterAttributesFormData, newValue: any) => {
    onChange({
      ...value,
      [field]: newValue
    });
  }, [value, onChange]);

  const handlePhysicalTraitChange = useCallback((trait: keyof PhysicalTraits, newValue: any) => {
    const newPhysicalTraits = {
      ...value.physicalTraits,
      [trait]: newValue
    };
    handleInputChange('physicalTraits', newPhysicalTraits);
  }, [value.physicalTraits, handleInputChange]);

  const handlePersonalityToggle = useCallback((trait: string) => {
    const currentPersonality = value.personality || [];
    const newPersonality = currentPersonality.includes(trait)
      ? currentPersonality.filter(t => t !== trait)
      : [...currentPersonality, trait];
    
    handleInputChange('personality', newPersonality);
  }, [value.personality, handleInputChange]);

  const SectionHeader = ({ title, section, count }: { title: string; section: string; count?: number }) => (
    <div
      className="section-header"
      onClick={() => toggleSection(section)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        backgroundColor: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        cursor: 'pointer',
        marginBottom: expandedSections[section] ? '16px' : '8px',
        transition: 'all 0.2s ease',
      }}
    >
      <h3 style={{
        margin: 0,
        fontSize: '16px',
        fontWeight: '600',
        color: '#111827',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        {title}
        {count !== undefined && count > 0 && (
          <span style={{
            backgroundColor: '#3b82f6',
            color: 'white',
            borderRadius: '12px',
            padding: '2px 8px',
            fontSize: '12px',
            fontWeight: '500'
          }}>
            {count}
          </span>
        )}
      </h3>
      <span style={{
        fontSize: '18px',
        color: '#6b7280',
        transform: expandedSections[section] ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: 'transform 0.2s ease'
      }}>
        ▼
      </span>
    </div>
  );

  const DropdownSelect = ({ 
    value: selectValue, 
    options, 
    placeholder, 
    onSelect 
  }: {
    value?: string;
    options: string[];
    placeholder: string;
    onSelect: (value: string) => void;
  }) => (
    <select
      value={selectValue || ''}
      onChange={(e) => onSelect(e.target.value)}
      disabled={disabled}
      style={{
        width: '100%',
        padding: '10px 12px',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        fontSize: '14px',
        color: '#374151',
        backgroundColor: 'white',
        cursor: disabled ? 'not-allowed' : 'pointer'
      }}
    >
      <option value="">{placeholder}</option>
      {options.map(option => (
        <option key={option} value={option}>{option}</option>
      ))}
    </select>
  );

  const TagSelector = ({ 
    selectedTags, 
    availableTags, 
    onToggle,
    maxSelection = 5
  }: {
    selectedTags: string[];
    availableTags: string[];
    onToggle: (tag: string) => void;
    maxSelection?: number;
  }) => (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px'
    }}>
      {availableTags.map(tag => {
        const isSelected = selectedTags.includes(tag);
        const canSelect = selectedTags.length < maxSelection || isSelected;
        
        return (
          <button
            key={tag}
            type="button"
            onClick={() => canSelect && onToggle(tag)}
            disabled={disabled || !canSelect}
            style={{
              padding: '6px 12px',
              border: `1px solid ${isSelected ? '#3b82f6' : '#d1d5db'}`,
              borderRadius: '20px',
              backgroundColor: isSelected ? '#eff6ff' : 'white',
              color: isSelected ? '#1d4ed8' : '#374151',
              fontSize: '12px',
              fontWeight: '500',
              cursor: (disabled || !canSelect) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              opacity: (disabled || !canSelect) ? 0.5 : 1,
            }}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="character-attributes-form" data-testid={testId} style={{
      maxWidth: '800px',
      margin: '0 auto',
      padding: '20px',
      backgroundColor: 'white',
      borderRadius: '12px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
    }}>
      <div className="form-header" style={{ marginBottom: '24px' }}>
        <h2 style={{
          fontSize: '24px',
          fontWeight: '700',
          color: '#111827',
          margin: '0 0 8px 0',
        }}>
          Character Details
        </h2>
        <p style={{
          fontSize: '14px',
          color: '#6b7280',
          margin: 0,
        }}>
          Add detailed attributes to create a more comprehensive character. All fields are optional.
        </p>
      </div>

      {/* Basic Information */}
      <SectionHeader title="Basic Information" section="basic" />
      {expandedSections.basic && (
        <div style={{ marginBottom: '24px', paddingLeft: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                Age Category
              </label>
              <DropdownSelect
                value={value.age}
                options={presets.ages}
                placeholder="Select age..."
                onSelect={(age) => handleInputChange('age', age)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                Gender
              </label>
              <DropdownSelect
                value={value.gender}
                options={presets.genders}
                placeholder="Select gender..."
                onSelect={(gender) => handleInputChange('gender', gender)}
              />
            </div>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
              Occupation/Role
            </label>
            <DropdownSelect
              value={value.occupation}
              options={presets.occupations}
              placeholder="Select occupation..."
              onSelect={(occupation) => handleInputChange('occupation', occupation)}
            />
          </div>
        </div>
      )}

      {/* Personality Traits */}
      <SectionHeader 
        title="Personality Traits" 
        section="personality" 
        count={value.personality?.length || 0}
      />
      {expandedSections.personality && (
        <div style={{ marginBottom: '24px', paddingLeft: '16px' }}>
          <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>
            Select up to 5 personality traits that define your character.
          </p>
          <TagSelector
            selectedTags={value.personality || []}
            availableTags={presets.personalityTraits}
            onToggle={handlePersonalityToggle}
            maxSelection={5}
          />
        </div>
      )}

      {/* Physical Appearance */}
      <SectionHeader title="Physical Appearance" section="physical" />
      {expandedSections.physical && (
        <div style={{ marginBottom: '24px', paddingLeft: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                Height
              </label>
              <DropdownSelect
                value={value.physicalTraits?.height}
                options={presets.physicalOptions.heights}
                placeholder="Select height..."
                onSelect={(height) => handlePhysicalTraitChange('height', height)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                Build
              </label>
              <DropdownSelect
                value={value.physicalTraits?.build}
                options={presets.physicalOptions.builds}
                placeholder="Select build..."
                onSelect={(build) => handlePhysicalTraitChange('build', build)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                Hair Color
              </label>
              <DropdownSelect
                value={value.physicalTraits?.hairColor}
                options={presets.physicalOptions.hairColors}
                placeholder="Select hair color..."
                onSelect={(hairColor) => handlePhysicalTraitChange('hairColor', hairColor)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                Hair Style
              </label>
              <DropdownSelect
                value={value.physicalTraits?.hairStyle}
                options={presets.physicalOptions.hairStyles}
                placeholder="Select hair style..."
                onSelect={(hairStyle) => handlePhysicalTraitChange('hairStyle', hairStyle)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                Eye Color
              </label>
              <DropdownSelect
                value={value.physicalTraits?.eyeColor}
                options={presets.physicalOptions.eyeColors}
                placeholder="Select eye color..."
                onSelect={(eyeColor) => handlePhysicalTraitChange('eyeColor', eyeColor)}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
                Skin Tone
              </label>
              <DropdownSelect
                value={value.physicalTraits?.skinTone}
                options={presets.physicalOptions.skinTones}
                placeholder="Select skin tone..."
                onSelect={(skinTone) => handlePhysicalTraitChange('skinTone', skinTone)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Clothing & Style */}
      <SectionHeader title="Clothing & Style" section="style" />
      {expandedSections.style && (
        <div style={{ marginBottom: '24px', paddingLeft: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
              Clothing Style
            </label>
            <DropdownSelect
              value={value.clothing}
              options={presets.clothingStyles}
              placeholder="Select clothing style..."
              onSelect={(clothing) => handleInputChange('clothing', clothing)}
            />
          </div>
          <div style={{ marginTop: '16px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
              Reference Image URL (Optional)
            </label>
            <input
              type="url"
              value={value.referenceImageUrl || ''}
              onChange={(e) => handleInputChange('referenceImageUrl', e.target.value)}
              disabled={disabled}
              placeholder="https://example.com/image.jpg"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                color: '#374151'
              }}
            />
          </div>
        </div>
      )}

      {/* Background Story */}
      <SectionHeader title="Background Story" section="background" />
      {expandedSections.background && (
        <div style={{ marginBottom: '24px', paddingLeft: '16px' }}>
          <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '6px' }}>
            Character Background
          </label>
          <textarea
            value={value.background || ''}
            onChange={(e) => handleInputChange('background', e.target.value)}
            disabled={disabled}
            placeholder="Describe your character's history, motivations, and story..."
            rows={4}
            style={{
              width: '100%',
              padding: '12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              color: '#374151',
              resize: 'vertical',
              fontFamily: 'inherit'
            }}
          />
        </div>
      )}
    </div>
  );
};

export default CharacterAttributesForm;