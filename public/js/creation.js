        async function generateCharacter() {
            const name = document.getElementById('character-name').value.trim();
            const style = document.getElementById('character-style').value;
            const gender = document.getElementById('character-gender').value;
            const description = document.getElementById('character-description').value.trim();
            
            if (!name) {
                showNotification('Please enter a character name', 'error');
                return;
            }
            
            if (!description) {
                showNotification('Please provide a character description', 'error');
                return;
            }
            
            // Show loading
            document.getElementById('loading-overlay').style.display = 'flex';
            
            try {
                // Step 1: Optimize prompt with Gemini
                const response = await fetch('/api/v1/characters/optimize-prompt', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        userDescription: description,
                        style: style,
                        gender: gender
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    currentOptimizedPrompt = result.data;
                    currentConversationId = result.data.conversationId;
                    showPromptOptimization(result.data);
                } else {
                    throw new Error(result.error?.message || 'Failed to optimize prompt');
                }
                
            } catch (error) {
                console.error('Error optimizing prompt:', error);
                showNotification('Failed to optimize prompt. Generating with original description.', 'warning');
                
                // Fallback to direct generation
                generateCharacterDirect(name, style, gender, description);
            } finally {
                // Hide loading
                document.getElementById('loading-overlay').style.display = 'none';
            }
        }
        
        function generateCharacterDirect(name, style, gender, description) {
            // Build enhanced description from all fields
            let enhancedDescription = description;
            const traits = [];
            
            if (gender) traits.push(`${gender}`);
            if (style) traits.push(`${style} art style`);
            
            if (traits.length > 0) {
                enhancedDescription = `${description} (${traits.join(', ')})`;
            }
            
            const character = {
                id: Date.now(),
                name: name,
                style: style || 'realistic',
                description: description,
                enhancedDescription: enhancedDescription,
                imageUrl: null,
                createdAt: new Date().toISOString(),
                tags: [
                    style || 'generated',
                    gender,
                    'ai-generated'
                ].filter(tag => tag && tag.trim() !== ''),
                metadata: {
                    gender: gender,
                    artStyle: style
                }
            };
            
            currentGeneratedCharacter = character;
            showCharacterPreview(character);
            showNotification('Character generated successfully!', 'success');
        }
        
        // Show prompt optimization results
        function showPromptOptimization(optimizationData) {
            // Hide empty state and other sections
            document.getElementById('preview-empty').style.display = 'none';
            document.getElementById('preview-character').style.display = 'none';

            // Show prompt optimization
            document.getElementById('prompt-optimization').style.display = 'block';

            // Update content - now it's a textarea
            document.getElementById('optimized-prompt').value = optimizationData.optimizedPrompt;
            document.getElementById('prompt-reasoning').textContent = optimizationData.reasoning;

            // Note: Back button visibility is controlled by caller (regenerateCharacter shows it, first generation doesn't)

            showNotification('Prompt optimized successfully! Edit if needed.', 'success');
        }
        
        // Generate character with optimized prompt
        async function generateWithOptimizedPrompt() {
            // Get the current prompt value from textarea (user may have edited it)
            const promptTextarea = document.getElementById('optimized-prompt');
            const editedPrompt = promptTextarea.value.trim();

            if (!editedPrompt) {
                showNotification('Prompt cannot be empty', 'error');
                return;
            }

            const name = document.getElementById('character-name').value.trim() || `Character ${characterCounter}`;
            const style = document.getElementById('character-style').value;
            const gender = document.getElementById('character-gender').value;

            try {
                // Show loading
                document.getElementById('loading-overlay').style.display = 'flex';

                // Call real image generation API with the edited prompt
                const imageResponse = await fetch('/api/v1/characters/generate-image', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${getAuthToken()}`
                    },
                    body: JSON.stringify({
                        prompt: editedPrompt,
                        style: style
                    })
                });

                console.log('Image generation response status:', imageResponse.status);
                console.log('Image generation response headers:', Object.fromEntries(imageResponse.headers.entries()));
                
                if (!imageResponse.ok) {
                    const errorText = await imageResponse.text();
                    console.error('Image generation HTTP error:', errorText);
                    throw new Error(`HTTP ${imageResponse.status}: ${imageResponse.statusText} - ${errorText}`);
                }

                const imageResult = await imageResponse.json();
                console.log('Image generation result:', imageResult);

                // Check if image generation actually succeeded
                if (!imageResult.success) {
                    throw new Error(imageResult.error?.message || 'Image generation failed');
                }

                const character = {
                    id: Date.now(),
                    name: name,
                    style: style || 'realistic',
                    description: currentOptimizedPrompt?.originalInput || editedPrompt,
                    enhancedDescription: editedPrompt,
                    imageUrl: imageResult.data?.imageUrl || null,
                    thumbnailUrl: imageResult.data?.thumbnailUrl || null,
                    createdAt: new Date().toISOString(),
                    tags: [
                        style || 'generated',
                        gender,
                        'ai-generated'
                    ].filter(tag => tag && tag.trim() !== ''),
                    metadata: {
                        gender: gender,
                        artStyle: style,
                        optimizedPrompt: editedPrompt,
                        conversationId: currentConversationId
                    }
                };

                currentGeneratedCharacter = character;
                showCharacterPreview(character);

                showNotification('Character generated successfully!', 'success');

            } catch (error) {
                console.error('Error generating character:', error);
                console.error('Error name:', error.name);
                console.error('Error message:', error.message);
                console.error('Error stack:', error.stack);

                // Only show error if character wasn't successfully created
                if (!currentGeneratedCharacter || !currentGeneratedCharacter.imageUrl) {
                    showNotification(`Failed to generate character image: ${error.message}`, 'error');
                }
            } finally {
                // Hide loading
                document.getElementById('loading-overlay').style.display = 'none';
            }
        }
        
        // Show modification options
        function showModificationOptions() {
            document.getElementById('prompt-optimization').style.display = 'none';
            document.getElementById('direct-prompt-editing').style.display = 'block';
            
            // Pre-fill the editor with current optimized prompt
            if (currentOptimizedPrompt && currentOptimizedPrompt.optimizedPrompt) {
                document.getElementById('direct-prompt-editor').value = currentOptimizedPrompt.optimizedPrompt;
            }
        }
        
        // Generate with edited prompt
        async function generateWithEditedPrompt() {
            const editedPrompt = document.getElementById('direct-prompt-editor').value.trim();
            
            if (!editedPrompt) {
                showNotification('Please provide a prompt', 'error');
                return;
            }
            
            // Hide direct editing section
            document.getElementById('direct-prompt-editing').style.display = 'none';
            document.getElementById('prompt-optimization').style.display = 'block';
            
            // Update the optimized prompt display with edited content
            document.getElementById('optimized-prompt-text').textContent = editedPrompt;
            
            // Generate image with the edited prompt
            generateCharacterWithPrompt(editedPrompt);
        }
        
        // Helper function to generate character with specific prompt
        async function generateCharacterWithPrompt(prompt) {
            if (!prompt) {
                showNotification('No prompt provided', 'error');
                return;
            }
            
            const name = document.getElementById('character-name').value.trim() || `Character ${characterCounter}`;
            const style = document.getElementById('character-style').value;
            
            try {
                // Show loading
                document.getElementById('loading-overlay').style.display = 'flex';
                
                // Call real image generation API
                const imageResponse = await fetch('/api/v1/characters/generate-image', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${getAuthToken()}`
                    },
                    body: JSON.stringify({
                        prompt: prompt,
                        style: style
                    })
                });

                if (!imageResponse.ok) {
                    throw new Error(`Image generation failed: ${imageResponse.status}`);
                }

                const imageResult = await imageResponse.json();
                
                if (!imageResult.success) {
                    throw new Error(imageResult.error?.message || 'Image generation failed');
                }

                // Create character data with generated image
                const character = {
                    id: Date.now(),
                    name: name,
                    style: style,
                    description: document.getElementById('character-description').value.trim(),
                    enhancedDescription: prompt,
                    imageUrl: imageResult.data.result.imageUrl,
                    createdAt: new Date().toISOString(),
                    tags: ['ai-generated'],
                    metadata: {
                        artStyle: style,
                        optimizedPrompt: prompt
                    }
                };

                // Show character preview
                showCharacterPreview(character);
                showNotification('Character generated successfully!', 'success');
                
            } catch (error) {
                console.error('Error generating character image:', error);
                showNotification(`Failed to generate character image: ${error.message}`, 'error');
            } finally {
                document.getElementById('loading-overlay').style.display = 'none';
            }
        }
        
        // Cancel direct editing
        function cancelDirectEditing() {
            document.getElementById('direct-prompt-editing').style.display = 'none';
            document.getElementById('prompt-optimization').style.display = 'block';
        }
        
        // Show character in preview area
        function showCharacterPreview(character) {
            // Hide other sections
            document.getElementById('preview-empty').style.display = 'none';
            document.getElementById('prompt-optimization').style.display = 'none';

            // Show character preview
            document.getElementById('preview-character').style.display = 'block';
            
            // Update image container
            const imageContainer = document.getElementById('character-image-container');
            console.log('Updating image container with imageUrl:', character.imageUrl);
            
            if (character.imageUrl) {
                // Clear existing styles and content
                imageContainer.style.background = 'transparent';
                imageContainer.innerHTML = `
                    <img src="${character.imageUrl}" alt="${character.name}" style="
                        width: 100%;
                        height: auto;
                        max-height: 600px;
                        object-fit: contain;
                        border-radius: 12px;
                        display: block;
                    " loading="lazy" onload="console.log('Image loaded successfully')" onerror="console.error('Image failed to load:', this.src)">
                `;
            } else {
                // Restore gradient background for placeholder
                imageContainer.style.background = 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)';
                imageContainer.innerHTML = `
                    <div style="color: white; font-size: 1.1rem; font-weight: 600; text-align: center;">
                        <i class="fas fa-user" style="font-size: 1.8rem; display: block; margin-bottom: 0.5rem;"></i>
                        Generated Character
                    </div>
                `;
            }
            
            // Update preview content
            document.getElementById('preview-name').textContent = character.name;
            document.getElementById('preview-description').textContent = character.description;
            
            // Update tags
            const styleTag = document.getElementById('preview-style');
            const genderTag = document.getElementById('preview-gender');
            
            if (character.style) {
                styleTag.textContent = character.style;
                styleTag.style.display = 'inline-block';
            } else {
                styleTag.style.display = 'none';
            }
            
            if (character.metadata && character.metadata.gender) {
                genderTag.textContent = character.metadata.gender;
                genderTag.style.display = 'inline-block';
            } else {
                genderTag.style.display = 'none';
            }
        }
        
        // Modify character (return to prompt optimization)
        function modifyCharacter() {
            if (currentOptimizedPrompt) {
                showModificationOptions();
            } else {
                showNotification('No prompt available for modification', 'error');
            }
        }
        
        // Abandon character creation
        function abandonCharacter() {
            if (confirm('Are you sure you want to abandon this character? All progress will be lost.')) {
                resetCreationWorkflow();
                showNotification('Character creation abandoned', 'info');
            }
        }
        
        // Reset the entire creation workflow
        function resetCreationWorkflow() {
            // Reset state
            currentGeneratedCharacter = null;
            currentOptimizedPrompt = null;
            currentConversationId = null;
            
            // Hide all preview sections
            document.getElementById('preview-character').style.display = 'none';
            document.getElementById('prompt-optimization').style.display = 'none';
            document.getElementById('modification-options').style.display = 'none';
            
            // Show empty state
            document.getElementById('preview-empty').style.display = 'block';
            
            // Clear form
            clearCreateForm();
        }
        
        // Regenerate current character
        function regenerateCharacter() {
            if (!currentGeneratedCharacter || !currentOptimizedPrompt) return;

            // Go back to prompt optimization view
            // Hide character preview
            document.getElementById('preview-character').style.display = 'none';
            document.getElementById('preview-empty').style.display = 'none';

            // Show prompt optimization
            showPromptOptimization(currentOptimizedPrompt);

            // Show the back button since user might want to return to preview
            document.getElementById('back-to-preview-btn').style.display = 'inline-block';

            showNotification('Edit the prompt and generate a new image', 'info');
        }

        // Back to character preview (cancel regeneration)
        function backToCharacterPreview() {
            if (!currentGeneratedCharacter) return;

            // Hide prompt optimization
            document.getElementById('prompt-optimization').style.display = 'none';
            document.getElementById('preview-empty').style.display = 'none';

            // Show character preview
            showCharacterPreview(currentGeneratedCharacter);

            // Hide the back button
            document.getElementById('back-to-preview-btn').style.display = 'none';

            showNotification('Returned to character preview', 'info');
        }
        
        // Save character to gallery
        async function saveCharacter() {
            if (!currentGeneratedCharacter) {
                showNotification('No character to save', 'error');
                return;
            }
            
            // Allow user to modify the name before saving
            const currentName = currentGeneratedCharacter.name;
            const newName = prompt('Enter character name:', currentName);
            
            if (newName === null) {
                // User cancelled
                return;
            }
            
            // Update character name
            if (newName.trim()) {
                currentGeneratedCharacter.name = newName.trim();
            } else {
                // Generate default name if empty
                currentGeneratedCharacter.name = `Character ${characterCounter}`;
                characterCounter++;
            }
            
            try {
                // Show loading
                document.getElementById('loading-overlay').style.display = 'flex';
                
                // Save to API
                const response = await fetch(`${API_BASE}/characters`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: currentGeneratedCharacter.name,
                        description: currentGeneratedCharacter.description,
                        enhancedDescription: currentGeneratedCharacter.enhancedDescription,
                        imageUrl: currentGeneratedCharacter.imageUrl,
                        thumbnailUrl: currentGeneratedCharacter.thumbnailUrl,
                        style: currentGeneratedCharacter.style,
                        tags: currentGeneratedCharacter.tags,
                        metadata: currentGeneratedCharacter.metadata
                    })
                });
                
                const result = await response.json();

                if (result.success) {
                    showNotification('Character saved to gallery!', 'success');
                } else {
                    throw new Error(result.error?.message || 'Failed to save character');
                }

            } catch (error) {
                console.error('Error saving character:', error);
                showNotification('Failed to save character', 'error');
            } finally {
                // Hide loading
                document.getElementById('loading-overlay').style.display = 'none';
            }
        }
        
        // Update character gallery
