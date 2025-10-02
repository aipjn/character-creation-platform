        // Global state
        let characters = [];
        let currentUser = null;
        const API_BASE = '/api/v1';
        
        // Get authentication token from storage
        function getAuthToken() {
            return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
        }
        
        // Check authentication
        async function checkAuth() {
            const token = getAuthToken();
            if (!token) {
                window.location.href = '/login.html';
                return false;
            }
            
            // Verify token with server
            try {
                const response = await fetch('/api/v1/auth/verify', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    const result = await response.json();
                    if (result.success) {
                        currentUser = result.data.user;
                        updateUserUI();
                        return true;
                    }
                } else {
                    console.warn('Auth verification failed, continuing without auth');
                    // Create a demo user for testing
                    currentUser = {
                        id: 'demo-user',
                        name: 'Demo User',
                        email: 'demo@example.com',
                        credits: 10
                    };
                    updateUserUI();
                    return true;
                }
            } catch (error) {
                console.error('Token verification failed:', error);
                // Create a demo user for testing
                currentUser = {
                    id: 'demo-user',
                    name: 'Demo User',
                    email: 'demo@example.com', 
                    credits: 10
                };
                updateUserUI();
                return true;
            }
            
            // Token invalid, clear it
            localStorage.removeItem('auth_token');
            sessionStorage.removeItem('auth_token');
            return false;
        }
        
        // Update user interface
        function updateUserUI() {
            if (!currentUser) return;
            
            const userInitial = currentUser.name.charAt(0).toUpperCase();
            document.getElementById('user-initial').textContent = userInitial;
            document.getElementById('profile-initial').textContent = userInitial;
            document.getElementById('user-name').textContent = currentUser.name;
            document.getElementById('profile-name').textContent = currentUser.name;
            document.getElementById('user-email').textContent = currentUser.email;
            document.getElementById('profile-email').textContent = currentUser.email;
            document.getElementById('credits-count').textContent = currentUser.credits;
            document.getElementById('total-credits').textContent = currentUser.credits;
            document.getElementById('total-characters').textContent = characters.length;
        }
        
        // Navigation
        function switchPage(pageId) {
            // Update active nav item
            document.querySelectorAll('.nav-item').forEach(item => {
                item.classList.remove('active');
                if (item.dataset.page === pageId) {
                    item.classList.add('active');
                }
            });

            // Update page content
            document.querySelectorAll('.page-content').forEach(page => {
                page.classList.remove('active');
            });
            document.getElementById(pageId + '-page').classList.add('active');

            // Update page title
            const titles = {
                library: 'Character Gallery',
                create: 'Character Creation',
                edit: 'Character Editing',
                scenes: 'Scene Builder',
                profile: 'Profile',
                settings: 'Settings'
            };
            document.getElementById('page-title').textContent = titles[pageId] || 'App';

            // Load data when switching to specific pages
            if (pageId === 'edit') {
                loadEditCharacters();
            } else if (pageId === 'library') {
                loadCharacters();
            }
        }
        
        // Navigation event listeners
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', function(e) {
                e.preventDefault();
                switchPage(this.dataset.page);
            });
        });
        
        // Mobile menu toggle
        document.getElementById('menu-toggle').addEventListener('click', function() {
            const sidebar = document.getElementById('sidebar');
            sidebar.classList.toggle('open');
        });
        
        // Character generation with multi-step workflow
        let currentGeneratedCharacter = null;
        let currentOptimizedPrompt = null;
        let currentConversationId = null;
        let characterCounter = 1;
        
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
                showNotification(`Failed to generate character image: ${error.message}`, 'error');
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
                    // Refresh gallery data
                    await loadCharacters();
                    
                    // Reset workflow
                    resetCreationWorkflow();
                    
                    // Switch to library
                    switchPage('library');
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
        async function updateCharacterGallery() {
            const gallery = document.getElementById('character-gallery');
            
            if (characters.length === 0) {
                gallery.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-magic"></i>
                        <h3>Ready to Create Your First Character?</h3>
                        <p>Bring your imagination to life with AI-powered character generation. Start by describing your character idea and watch it come to life!</p>
                        <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                            <button class="btn btn-primary" onclick="switchPage('create')" style="padding: 1rem 2rem; font-size: 16px;">
                                <i class="fas fa-plus"></i>
                                Create Your First Character
                            </button>
                        </div>
                        <div style="margin-top: 2rem; padding: 1.5rem; background: rgba(var(--primary-rgb), 0.1); border-radius: var(--radius); border-left: 4px solid var(--primary);">
                            <h4 style="margin: 0 0 0.5rem 0; color: var(--primary); font-size: 16px;">
                                <i class="fas fa-lightbulb"></i> Quick Start Tips
                            </h4>
                            <ul style="text-align: left; margin: 0; padding-left: 1.5rem; color: var(--text-secondary); font-size: 14px; line-height: 1.6;">
                                <li>Describe your character's appearance, personality, or setting</li>
                                <li>Choose from various art styles like realistic, anime, or cartoon</li>
                                <li>Use our AI-powered prompt optimization for better results</li>
                                <li>Create variants of your characters with different poses or expressions</li>
                            </ul>
                        </div>
                    </div>
                `;
                return;
            }
            
            // Render character cards with themes
            const renderCards = async () => {
                const cardsHTML = await Promise.all(characters.map(async character => {
                    const themesHTML = await (window.renderCharacterThemes ? window.renderCharacterThemes(character.id) : Promise.resolve(''));

                    return `
                        <div class="character-card" style="cursor: auto;">
                            <div class="character-image">
                                ${character.thumbnailUrl || character.imageUrl ?
                                    `<img src="${character.thumbnailUrl || character.imageUrl}" alt="${character.name}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover; border-radius: 8px;">` :
                                    `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; background: var(--surface); border-radius: 8px;">
                                        <i class="fas fa-user" style="font-size: 3rem; opacity: 0.5; color: var(--text-muted);"></i>
                                        <span style="font-size: 12px; color: var(--text-muted); margin-top: 0.5rem;">AI Generated</span>
                                    </div>`
                                }
                            </div>
                            <div class="character-info">
                                <h4>${character.name}</h4>
                                <div class="character-meta">
                                    ${character.tags && character.tags.length > 0 ?
                                        character.tags.map(tag => `<span class="character-tag">${tag}</span>`).join('') :
                                        '<span class="character-tag">character</span>'
                                    }
                                </div>
                                <p>${character.description && character.description.length > 100 ?
                                    character.description.substring(0, 100) + '...' :
                                    character.description || 'No description available'
                                }</p>
                                <div id="themes-${character.id}">
                                    ${themesHTML}
                                </div>
                                <div class="character-actions" style="margin-top: 1rem;">
                                    <button class="btn btn-secondary btn-sm" onclick="deleteCharacter('${character.id}')">
                                        <i class="fas fa-trash"></i> Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;
                }));

                gallery.innerHTML = cardsHTML.join('');
            };

            renderCards();
        }
        
        // View character detail
        function viewCharacterDetail(id) {
            const character = characters.find(c => c.id === id);
            if (character) {
                currentCharacterDetail = character;
                showCharacterDetail(character);
                switchPage('edit'); // Using edit page as detail view for now
            }
        }
        
        let currentCharacterDetail = null;
        
        // Show character detail
        function showCharacterDetail(character) {
            const editPage = document.getElementById('edit-page');
            editPage.innerHTML = `
                <div style="max-width: 800px; margin: 0 auto;">
                    <!-- Character Header -->
                    <div style="
                        background: var(--gradient-primary);
                        color: white;
                        padding: 2rem;
                        border-radius: var(--radius-lg);
                        margin-bottom: 2rem;
                        text-align: center;
                        position: relative;
                        overflow: hidden;
                    ">
                        <div style="
                            position: absolute;
                            top: 0;
                            left: 0;
                            right: 0;
                            bottom: 0;
                            background: radial-gradient(circle at 70% 30%, rgba(255,255,255,0.1) 0%, transparent 50%);
                        "></div>
                        <div style="position: relative; z-index: 1;">
                            <h1 style="font-size: 2rem; font-weight: 700; margin-bottom: 0.5rem;">${character.name}</h1>
                            <div style="display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; margin-bottom: 1rem;">
                                ${character.tags && character.tags.length > 0 ? 
                                    character.tags.map(tag => `<span style="background: rgba(255,255,255,0.2); padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 14px;">${tag}</span>`).join('') : 
                                    ''
                                }
                            </div>
                            <p style="opacity: 0.9; font-size: 1.1rem;">${character.description || 'No description available'}</p>
                        </div>
                    </div>
                    
                    <!-- Character Image and Info -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2rem;">
                        <!-- Image -->
                        <div style="
                            background: var(--background);
                            border-radius: var(--radius-lg);
                            padding: 1.5rem;
                            border: 1px solid var(--border);
                            box-shadow: var(--shadow);
                        ">
                            <h3 style="margin-bottom: 1rem; color: var(--text-primary);">Character Image</h3>
                            <div style="
                                width: 100%;
                                height: 300px;
                                border-radius: var(--radius);
                                overflow: hidden;
                                background: var(--surface);
                                display: flex;
                                align-items: center;
                                justify-content: center;
                            ">
                                ${character.imageUrl ? 
                                    `<img src="${character.imageUrl}" alt="${character.name}" style="width: 100%; height: 100%; object-fit: cover;">` :
                                    `<div style="text-align: center; color: var(--text-muted);">
                                        <i class="fas fa-user" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                                        <p>No image available</p>
                                    </div>`
                                }
                            </div>
                        </div>
                        
                        <!-- Character Info -->
                        <div style="
                            background: var(--background);
                            border-radius: var(--radius-lg);
                            padding: 1.5rem;
                            border: 1px solid var(--border);
                            box-shadow: var(--shadow);
                        ">
                            <h3 style="margin-bottom: 1rem; color: var(--text-primary);">Character Details</h3>
                            <div style="space-y: 1rem;">
                                <div style="margin-bottom: 1rem;">
                                    <label style="font-weight: 600; color: var(--text-secondary); font-size: 14px;">ID</label>
                                    <p style="margin: 0.25rem 0 0 0; padding: 0.5rem; background: var(--surface); border-radius: 6px; font-family: monospace; font-size: 12px;">${character.id}</p>
                                </div>
                                <div style="margin-bottom: 1rem;">
                                    <label style="font-weight: 600; color: var(--text-secondary); font-size: 14px;">Created</label>
                                    <p style="margin: 0.25rem 0 0 0;">${new Date(character.createdAt).toLocaleDateString()}</p>
                                </div>
                                ${character.metadata ? `
                                    <div style="margin-bottom: 1rem;">
                                        <label style="font-weight: 600; color: var(--text-secondary); font-size: 14px;">Generated By</label>
                                        <p style="margin: 0.25rem 0 0 0;">${character.metadata.generatedBy || 'Unknown'}</p>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                    
                    <!-- Actions -->
                    <div style="
                        background: var(--background);
                        border-radius: var(--radius-lg);
                        padding: 1.5rem;
                        border: 1px solid var(--border);
                        box-shadow: var(--shadow);
                        text-align: center;
                    ">
                        <h3 style="margin-bottom: 1rem; color: var(--text-primary);">Character Variants & Editing</h3>
                        <p style="color: var(--text-secondary); margin-bottom: 2rem;">Generate variations of this character with different poses, expressions, or settings.</p>
                        
                        <div style="display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap;">
                            <button class="btn btn-primary" onclick="editCharacter('${character.id}')">
                                <i class="fas fa-edit"></i> Create Variants
                            </button>
                            <button class="btn btn-secondary" onclick="switchPage('library')">
                                <i class="fas fa-arrow-left"></i> Back to Gallery
                            </button>
                            <button class="btn btn-outline" onclick="deleteCharacter('${character.id}')">
                                <i class="fas fa-trash"></i> Delete Character
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Mobile responsive styles -->
                <style>
                    @media (max-width: 768px) {
                        #edit-page > div > div[style*="grid-template-columns"] {
                            grid-template-columns: 1fr !important;
                            gap: 1rem !important;
                        }
                        #edit-page > div > div[style*="grid-template-columns"] > div:first-child img {
                            height: 250px !important;
                        }
                    }
                </style>
            `;
        }

        async function deleteCharacter(id) {
            if (confirm('Are you sure you want to delete this character?')) {
                try {
                    const response = await fetch(`/api/v1/characters/${id}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${getAuthToken()}`
                        }
                    });

                    if (response.ok) {
                        // Refresh from real API
                        await loadCharacters();
                        showNotification('Character deleted successfully', 'success');
                        
                        // If we're viewing this character, go back to gallery
                        if (currentCharacterDetail && currentCharacterDetail.id === id) {
                            switchPage('library');
                        }
                    } else {
                        const error = await response.json();
                        throw new Error(error.error?.message || 'Failed to delete character');
                    }
                } catch (error) {
                    console.error('Error deleting character:', error);
                    showNotification('Failed to delete character: ' + error.message, 'error');
                }
            }
        }
        
        // Clear create form
        function clearCreateForm() {
            document.getElementById('character-name').value = '';
            document.getElementById('character-style').selectedIndex = 0;
            document.getElementById('character-gender').selectedIndex = 0;
            document.getElementById('character-description').value = '';
            updateCharacterCount();
        }
        
        // Character count functionality
        function updateCharacterCount() {
            const textarea = document.getElementById('character-description');
            const counter = document.getElementById('char-count');
            if (textarea && counter) {
                const count = textarea.value.length;
                counter.textContent = `${count} characters`;
            }
        }
        
        // Logout
        function logout() {
            if (confirm('Are you sure you want to logout?')) {
                localStorage.removeItem('auth_token');
                sessionStorage.removeItem('auth_token');
                window.location.href = '/login.html';
            }
        }
        
        // Notification system
        function showNotification(message, type = 'info') {
            const notification = document.createElement('div');
            notification.innerHTML = `
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                ${message}
            `;
            
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--error)' : 'var(--primary)'};
                color: white;
                padding: 1rem 1.5rem;
                border-radius: var(--radius);
                box-shadow: var(--shadow-lg);
                z-index: 10000;
                display: flex;
                align-items: center;
                gap: 0.5rem;
                font-weight: 500;
                animation: slideInFromRight 0.3s ease-out;
            `;
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.style.animation = 'slideOutToRight 0.3s ease-out';
                setTimeout(() => {
                    if (notification.parentNode) {
                        document.body.removeChild(notification);
                    }
                }, 300);
            }, 3000);
        }
        
        // Add notification animations
        const notificationStyles = document.createElement('style');
        notificationStyles.textContent = `
            @keyframes slideInFromRight {
                from { opacity: 0; transform: translateX(100%); }
                to { opacity: 1; transform: translateX(0); }
            }
            @keyframes slideOutToRight {
                from { opacity: 1; transform: translateX(0); }
                to { opacity: 0; transform: translateX(100%); }
            }
        `;
        document.head.appendChild(notificationStyles);
        
        // Load characters from API
        async function loadCharacters() {
            try {
                const response = await fetch('/api/v1/characters');
                const data = await response.json();
                
                if (data.success) {
                    characters = data.data.items.map(char => ({
                        id: char.id,
                        name: char.name,
                        style: char.tags?.[0] || 'generated',
                        description: char.description,
                        imageUrl: char.imageUrl,
                        thumbnailUrl: char.thumbnailUrl,
                        createdAt: char.createdAt,
                        tags: char.tags || []
                    }));
                    updateCharacterGallery();
                    updateUserUI(); // Update character count and other UI elements
                } else {
                    console.error('Failed to load characters:', data.error);
                    showNotification('Failed to load characters', 'error');
                }
            } catch (error) {
                console.error('Error loading characters:', error);
                showNotification('Error loading characters: ' + error.message, 'error');
                // Keep empty array if API fails
                characters = [];
                updateCharacterGallery();
                updateUserUI(); // Update character count even when empty
            }
        }

        // Initialize app
        document.addEventListener('DOMContentLoaded', async function() {
            // Set a default token for testing if none exists
            if (!getAuthToken()) {
                localStorage.setItem('auth_token', 'test-token-123');
            }
            
            if (await checkAuth()) {
                loadCharacters();
                updateUserUI();
            }
            
            // Add character counter event listener
            const descriptionTextarea = document.getElementById('character-description');
            if (descriptionTextarea) {
                descriptionTextarea.addEventListener('input', updateCharacterCount);
                updateCharacterCount(); // Initialize counter
            }
        });
        
        // Close mobile menu when clicking outside
        document.addEventListener('click', function(e) {
            const sidebar = document.getElementById('sidebar');
            const menuToggle = document.getElementById('menu-toggle');
            
            if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                sidebar.classList.remove('open');
            }
        });

        // ===== CHARACTER VARIANT GENERATION FUNCTIONS =====

        // Set variant description from quick options
        function setVariantDescription(description) {
            document.getElementById('variant-description').value = description;
        }

        // Generate variant prompt using Gemini
        async function generateVariantPrompt() {
            const description = document.getElementById('variant-description').value.trim();
            
            if (!description) {
                showNotification('Please describe the changes you want to make', 'error');
                return;
            }

            if (!currentCharacterForVariant) {
                showNotification('No character selected for variant generation', 'error');
                return;
            }

            // Show loading
            document.getElementById('loading-overlay').style.display = 'flex';

            try {
                // Build the variant prompt that includes original character info
                const variantPrompt = `Create a variant of the character "${currentCharacterForVariant.name}" with the following changes: ${description}

Original character description: ${currentCharacterForVariant.description || 'No description'}
Original character style: ${currentCharacterForVariant.style || 'Not specified'}
Changes requested: ${description}

Please optimize this into a detailed prompt for generating a character variant that maintains the character's core identity while incorporating the requested changes.`;

                const response = await fetch('/api/v1/characters/optimize-prompt', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        userDescription: variantPrompt,
                        style: currentCharacterForVariant.style,
                        gender: currentCharacterForVariant.metadata?.gender
                    })
                });

                const result = await response.json();

                if (result.success) {
                    currentVariantPrompt = result.data;
                    currentVariantConversationId = result.data.conversationId;
                    showVariantPromptOptimization(result.data);
                } else {
                    throw new Error(result.error?.message || 'Failed to optimize variant prompt');
                }

            } catch (error) {
                console.error('Error generating variant prompt:', error);
                showNotification('Failed to generate variant prompt', 'error');
            } finally {
                // Hide loading
                document.getElementById('loading-overlay').style.display = 'none';
            }
        }

        // Show variant prompt optimization results
        function showVariantPromptOptimization(optimizationData) {
            // Hide empty state
            document.getElementById('variant-empty').style.display = 'none';
            document.getElementById('variant-modification-options').style.display = 'none';
            document.getElementById('variant-preview').style.display = 'none';
            
            // Show prompt optimization
            document.getElementById('variant-prompt-optimization').style.display = 'block';
            
            // Update content
            document.getElementById('variant-optimized-prompt').textContent = optimizationData.optimizedPrompt;
            document.getElementById('variant-prompt-reasoning').textContent = optimizationData.reasoning;
            
            showNotification('Variant prompt optimized successfully!', 'success');
        }

        // Show variant direct editing options
        function showVariantModificationOptions() {
            document.getElementById('variant-prompt-optimization').style.display = 'none';
            document.getElementById('variant-direct-editing').style.display = 'block';
            
            // Pre-fill the editor with current variant prompt
            if (currentVariantPrompt && currentVariantPrompt.optimizedPrompt) {
                document.getElementById('variant-direct-prompt-editor').value = currentVariantPrompt.optimizedPrompt;
            }
        }

        // Generate variant with edited prompt
        async function generateVariantWithEditedPrompt() {
            const editedPrompt = document.getElementById('variant-direct-prompt-editor').value.trim();
            
            if (!editedPrompt) {
                showNotification('Please provide a prompt', 'error');
                return;
            }
            
            // Hide direct editing section
            document.getElementById('variant-direct-editing').style.display = 'none';
            document.getElementById('variant-prompt-optimization').style.display = 'block';
            
            // Update the variant prompt display with edited content
            document.getElementById('variant-optimized-prompt').textContent = editedPrompt;
            
            // Update current variant prompt data
            if (currentVariantPrompt) {
                currentVariantPrompt.optimizedPrompt = editedPrompt;
            }
            
            // Generate variant image with the edited prompt
            generateCharacterVariant();
        }

        // Cancel variant direct editing
        function cancelVariantDirectEditing() {
            document.getElementById('variant-direct-editing').style.display = 'none';
            document.getElementById('variant-prompt-optimization').style.display = 'block';
        }

        // Generate character variant with optimized prompt
        async function generateCharacterVariant() {
            if (!currentVariantPrompt) {
                showNotification('No optimized prompt available', 'error');
                return;
            }

            if (!currentSelectedTheme) {
                showNotification('Please select a theme first', 'error');
                return;
            }

            // Show loading
            document.getElementById('loading-overlay').style.display = 'flex';

            try {
                // Call themes API to generate variant
                const response = await fetch(`${API_BASE}/themes/${currentSelectedTheme.id}/variants/generate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        prompt: currentVariantPrompt.optimizedPrompt,
                        metadata: {
                            originalInput: currentVariantPrompt.originalInput,
                            reasoning: currentVariantPrompt.reasoning,
                            conversationId: currentVariantConversationId
                        }
                    })
                });

                const result = await response.json();

                if (result.success && result.data) {
                    const variant = result.data;

                    // Create variant character for display
                    const variantCharacter = {
                        id: variant.id,
                        name: `${currentCharacterForVariant.name} - Variant ${Date.now()}`,
                        imageUrl: variant.imageUrl,
                        thumbnailUrl: variant.thumbnailUrl,
                        description: variant.prompt,
                        metadata: variant.metadata
                    };

                    currentGeneratedVariant = variantCharacter;
                    showVariantPreview(variantCharacter);

                    // Update theme info to show new variant count
                    if (currentSelectedTheme.variants) {
                        currentSelectedTheme.variants.push(variant);
                    } else {
                        currentSelectedTheme.variants = [variant];
                    }
                    updateThemeInfo();

                } else {
                    throw new Error(result.error?.message || 'Failed to generate variant');
                }

            } catch (error) {
                console.error('Error generating character variant:', error);
                showNotification(error.message || 'Failed to generate character variant', 'error');
            } finally {
                // Hide loading
                document.getElementById('loading-overlay').style.display = 'none';
            }
        }

        let currentGeneratedVariant = null;

        // Show variant preview
        function showVariantPreview(variant) {
            // Hide other sections
            document.getElementById('variant-empty').style.display = 'none';
            document.getElementById('variant-prompt-optimization').style.display = 'none';
            document.getElementById('variant-modification-options').style.display = 'none';
            
            // Show variant preview
            document.getElementById('variant-preview').style.display = 'block';
            
            // Set default variant name
            document.getElementById('variant-name').value = variant.name;
            
            // Update image container
            const imageContainer = document.getElementById('variant-image-container');
            if (variant.imageUrl) {
                imageContainer.innerHTML = `<img src="${variant.imageUrl}" alt="${variant.name}" style="width: 100%; height: 100%; object-fit: cover;">`;
            } else {
                imageContainer.innerHTML = `
                    <div style="text-align: center; color: var(--text-muted);">
                        <i class="fas fa-user" style="font-size: 3rem; margin-bottom: 1rem;"></i>
                        <p>Generated Variant</p>
                        <p style="font-size: 12px; opacity: 0.7;">Image generation ready</p>
                    </div>
                `;
            }
            
            showNotification('Character variant generated successfully!', 'success');
        }

        // Save character variant
        async function saveCharacterVariant() {
            if (!currentGeneratedVariant) {
                showNotification('No variant to save', 'error');
                return;
            }

            const variantName = document.getElementById('variant-name').value.trim();
            if (!variantName) {
                showNotification('Please enter a name for the variant', 'error');
                return;
            }

            // Update variant name
            currentGeneratedVariant.name = variantName;

            try {
                // Save to API
                const response = await fetch('/api/v1/characters', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${getAuthToken()}`
                    },
                    body: JSON.stringify(currentGeneratedVariant)
                });

                const result = await response.json();

                if (result.success) {
                    // Reload characters from real API
                    await loadCharacters();
                    
                    showNotification(`Character variant "${variantName}" saved successfully!`, 'success');
                    
                    // Reset and return to character detail
                    resetVariantWorkflow();
                    showCharacterDetail(currentCharacterForVariant);
                } else {
                    throw new Error(result.error?.message || 'Failed to save character variant');
                }

            } catch (error) {
                console.error('Error saving character variant:', error);
                showNotification('Failed to save character variant', 'error');
            }
        }

        // Modify variant (return to prompt optimization)
        function modifyVariant() {
            if (currentVariantPrompt) {
                showVariantModificationOptions();
            } else {
                showNotification('No prompt available for modification', 'error');
            }
        }

        // Abandon variant creation
        function abandonVariant() {
            if (confirm('Are you sure you want to abandon this variant? All progress will be lost.')) {
                resetVariantWorkflow();
                showNotification('Variant creation abandoned', 'info');
            }
        }

        // Reset variant workflow
        function resetVariantWorkflow() {
            currentVariantPrompt = null;
            currentVariantConversationId = null;
            currentGeneratedVariant = null;
            
            // Reset form
            document.getElementById('variant-description').value = '';
            
            // Show empty state
            document.getElementById('variant-empty').style.display = 'block';
            document.getElementById('variant-prompt-optimization').style.display = 'none';
            document.getElementById('variant-modification-options').style.display = 'none';
            document.getElementById('variant-preview').style.display = 'none';
        }

        // ===== END CHARACTER VARIANT GENERATION FUNCTIONS =====

        // ===== CHARACTER EDIT PAGE FUNCTIONS =====

        let currentEditCharacter = null;
        let currentEditedImage = null;

        // Load characters for editing
        async function loadEditCharacters() {
            try {
                console.log('[Edit Page] Loading characters...');
                const response = await fetch(`${API_BASE}/characters`);
                const result = await response.json();

                console.log('[Edit Page] API response:', result);

                if (result.success && result.data.items) {
                    const characters = result.data.items;
                    console.log('[Edit Page] Found characters:', characters.length);
                    displayEditCharacterGallery(characters);
                } else {
                    console.warn('[Edit Page] No characters found or API error');
                }
            } catch (error) {
                console.error('[Edit Page] Error loading characters:', error);
                showNotification('Failed to load characters', 'error');
            }
        }

        // Display characters in edit gallery
        function displayEditCharacterGallery(characters) {
            console.log('[Edit Page] displayEditCharacterGallery called with', characters.length, 'characters');
            const gallery = document.getElementById('edit-character-gallery');

            if (!gallery) {
                console.error('[Edit Page] Gallery element not found!');
                return;
            }

            gallery.innerHTML = '';

            if (characters.length === 0) {
                gallery.innerHTML = `
                    <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                        <p>No characters yet. Create some characters first!</p>
                    </div>
                `;
                return;
            }

            console.log('[Edit Page] Creating', characters.length, 'character cards');

            characters.forEach((character, index) => {
                console.log(`[Edit Page] Creating card ${index} for`, character.name);

                const card = document.createElement('div');
                card.className = 'character-card';
                card.style.cursor = 'pointer';
                card.onclick = () => selectCharacterForEdit(character);

                const imageHtml = character.imageUrl
                    ? `<img src="${character.imageUrl}" alt="${character.name}" style="width: 100%; height: 100%; object-fit: cover;" />`
                    : `<div style="display: flex; align-items: center; justify-content: center; height: 100%;"><i class="fas fa-user" style="font-size: 2rem; color: white;"></i></div>`;

                card.innerHTML = `
                    <div class="character-image">
                        ${imageHtml}
                    </div>
                    <div class="character-info">
                        <h4>${character.name}</h4>
                        <p>${character.description.substring(0, 80)}${character.description.length > 80 ? '...' : ''}</p>
                    </div>
                `;

                gallery.appendChild(card);
            });

            console.log('[Edit Page] Gallery populated with', gallery.children.length, 'cards');
        }

        // Select character for editing
        async function selectCharacterForEdit(character) {
            currentEditCharacter = character;
            currentEditedImage = null;

            // Hide empty state, show edit panel
            document.getElementById('edit-empty-state').style.display = 'none';
            document.getElementById('edit-panel').style.display = 'block';
            document.getElementById('edit-result').style.display = 'none';

            // Update UI with character info
            document.getElementById('edit-character-image').src = character.imageUrl;
            document.getElementById('edit-character-name').textContent = character.name;
            document.getElementById('edit-character-description').textContent = character.description;

            // Clear edit prompt
            document.getElementById('edit-prompt').value = '';

            // Load themes for this character
            await loadEditCharacterThemes(character.id);

            showNotification(`Selected "${character.name}" for editing`, 'success');
        }

        // ===== EDIT PAGE THEME MANAGEMENT =====
        let editCurrentTheme = null;
        let editCharacterThemes = [];

        async function loadEditCharacterThemes(characterId) {
            try {
                const response = await fetch(`${API_BASE}/themes/character/${characterId}`);
                const data = await response.json();

                if (data.success) {
                    editCharacterThemes = data.data || [];
                    const themeSelector = document.getElementById('edit-theme-selector');

                    if (!themeSelector) return;

                    themeSelector.innerHTML = '';

                    if (editCharacterThemes.length === 0) {
                        await createEditDefaultTheme(characterId);
                        return;
                    }

                    editCharacterThemes.forEach((theme, index) => {
                        const option = document.createElement('option');
                        option.value = theme.id;
                        option.textContent = theme.name || `Theme ${index + 1}`;
                        themeSelector.appendChild(option);
                    });

                    if (editCharacterThemes.length > 0) {
                        themeSelector.value = editCharacterThemes[0].id;
                        editCurrentTheme = editCharacterThemes[0];
                        updateEditThemeInfo();
                    }
                } else {
                    await createEditDefaultTheme(characterId);
                }
            } catch (error) {
                console.error('Error loading themes:', error);
                await createEditDefaultTheme(characterId);
            }
        }

        async function createEditDefaultTheme(characterId) {
            const themeName = `Theme ${Date.now()}`;
            const theme = await createTheme(characterId, themeName);
            if (theme) {
                editCharacterThemes = [theme];
                editCurrentTheme = theme;

                const themeSelector = document.getElementById('edit-theme-selector');
                if (themeSelector) {
                    themeSelector.innerHTML = '';
                    const option = document.createElement('option');
                    option.value = theme.id;
                    option.textContent = theme.name;
                    themeSelector.appendChild(option);
                    themeSelector.value = theme.id;
                }

                updateEditThemeInfo();
            }
        }

        function onEditThemeSelected() {
            const themeSelector = document.getElementById('edit-theme-selector');
            const selectedThemeId = themeSelector.value;
            editCurrentTheme = editCharacterThemes.find(t => t.id === selectedThemeId);
            updateEditThemeInfo();

            // Load existing variants for this theme
            loadThemeVariants();
        }

        // Load and display existing variants for current theme
        function loadThemeVariants() {
            const grid = document.getElementById('variants-grid');
            grid.innerHTML = ''; // Clear existing variants

            if (editCurrentTheme && editCurrentTheme.variants) {
                // Sort by creation date (newest first)
                const sortedVariants = [...editCurrentTheme.variants].sort((a, b) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );

                // Add each variant to grid
                sortedVariants.forEach(variant => {
                    addVariantToGrid(variant);
                });

                // Show result section if there are variants
                if (sortedVariants.length > 0) {
                    document.getElementById('edit-result').style.display = 'block';
                }
            }

            // Update theme name display
            const themeNameSpan = document.getElementById('save-theme-name');
            if (themeNameSpan && editCurrentTheme) {
                themeNameSpan.textContent = editCurrentTheme.name;
            }

            updateVariantCount();
        }

        function updateEditThemeInfo() {
            const infoDiv = document.getElementById('edit-theme-info');
            const countSpan = document.getElementById('edit-theme-variant-count');

            if (editCurrentTheme && infoDiv && countSpan) {
                const variantCount = editCurrentTheme.variants ? editCurrentTheme.variants.length : 0;
                countSpan.textContent = `${variantCount} variant${variantCount !== 1 ? 's' : ''} in this theme`;
                infoDiv.style.display = 'block';
            }
        }

        function showEditCreateThemeDialog() {
            const themeName = prompt('Enter theme name:', `Theme ${Date.now()}`);
            if (themeName && currentEditCharacter) {
                createEditThemeAndSelect(currentEditCharacter.id, themeName);
            }
        }

        async function createEditThemeAndSelect(characterId, themeName) {
            const theme = await createTheme(characterId, themeName);
            if (theme) {
                editCharacterThemes.push(theme);

                const themeSelector = document.getElementById('edit-theme-selector');
                if (themeSelector) {
                    const option = document.createElement('option');
                    option.value = theme.id;
                    option.textContent = theme.name;
                    themeSelector.appendChild(option);
                    themeSelector.value = theme.id;

                    editCurrentTheme = theme;
                    updateEditThemeInfo();
                }

                showNotification(`Theme "${themeName}" created successfully!`, 'success');
            }
        }

        function editEditTheme() {
            if (!editCurrentTheme) return;

            const newName = prompt('Enter new theme name:', editCurrentTheme.name);
            if (newName && newName !== editCurrentTheme.name) {
                updateEditThemeName(editCurrentTheme.id, newName);
            }
        }

        async function updateEditThemeName(themeId, newName) {
            try {
                const response = await fetch(`${API_BASE}/themes/${themeId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: newName })
                });

                const data = await response.json();
                if (data.success) {
                    const theme = editCharacterThemes.find(t => t.id === themeId);
                    if (theme) {
                        theme.name = newName;
                    }
                    if (editCurrentTheme && editCurrentTheme.id === themeId) {
                        editCurrentTheme.name = newName;
                    }

                    const themeSelector = document.getElementById('edit-theme-selector');
                    if (themeSelector) {
                        const option = themeSelector.querySelector(`option[value="${themeId}"]`);
                        if (option) {
                            option.textContent = newName;
                        }
                    }

                    showNotification('Theme name updated!', 'success');
                }
            } catch (error) {
                console.error('Error updating theme name:', error);
                showNotification('Failed to update theme name', 'error');
            }
        }

        // Apply character edit
        async function applyCharacterEdit() {
            if (!currentEditCharacter) {
                showNotification('No character selected', 'error');
                return;
            }

            if (!editCurrentTheme) {
                showNotification('Please select a theme first', 'error');
                return;
            }

            const prompt = document.getElementById('edit-prompt').value.trim();
            if (!prompt) {
                showNotification('Please describe the changes you want to make', 'error');
                return;
            }

            try {
                // Show loading
                document.getElementById('loading-overlay').style.display = 'flex';

                console.log('Generating variant for theme:', editCurrentTheme.name);
                console.log('Character:', currentEditCharacter.name);
                console.log('Prompt:', prompt);

                // Call themes API to generate variant
                const response = await fetch(`${API_BASE}/themes/${editCurrentTheme.id}/variants/generate`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        prompt: prompt,
                        metadata: {
                            originalCharacterId: currentEditCharacter.id,
                            originalCharacterName: currentEditCharacter.name
                        }
                    })
                });

                const result = await response.json();

                if (result.success && result.data) {
                    const variant = result.data;

                    currentEditedImage = {
                        editedImageUrl: variant.imageUrl,
                        thumbnailUrl: variant.thumbnailUrl,
                        prompt: variant.prompt,
                        variantId: variant.id
                    };

                    // Update theme variant count and add to list
                    if (editCurrentTheme.variants) {
                        editCurrentTheme.variants.push(variant);
                    } else {
                        editCurrentTheme.variants = [variant];
                    }
                    updateEditThemeInfo();

                    // Add variant card to grid (prepend to show newest first)
                    addVariantToGrid(variant);

                    // Show result section if first variant
                    document.getElementById('edit-result').style.display = 'block';

                    // Update theme name display
                    const themeNameSpan = document.getElementById('save-theme-name');
                    if (themeNameSpan) {
                        themeNameSpan.textContent = editCurrentTheme.name;
                    }

                    // Clear prompt for next generation
                    document.getElementById('edit-prompt').value = '';

                    showNotification('Variant generated and saved to theme!', 'success');
                } else {
                    throw new Error(result.error?.message || 'Failed to generate variant');
                }

            } catch (error) {
                console.error('Error generating variant:', error);
                showNotification(`Failed to generate variant: ${error.message}`, 'error');
            } finally {
                document.getElementById('loading-overlay').style.display = 'none';
            }
        }

        // Add variant card to grid
        function addVariantToGrid(variant) {
            const grid = document.getElementById('variants-grid');

            // Create variant card
            const card = document.createElement('div');
            card.style.cssText = `
                background: var(--background);
                border: 1px solid var(--border);
                border-radius: var(--radius);
                overflow: hidden;
                transition: transform 0.2s, box-shadow 0.2s;
                cursor: pointer;
            `;
            card.onmouseover = () => {
                card.style.transform = 'translateY(-4px)';
                card.style.boxShadow = '0 8px 16px rgba(0,0,0,0.1)';
            };
            card.onmouseout = () => {
                card.style.transform = 'translateY(0)';
                card.style.boxShadow = 'none';
            };

            card.innerHTML = `
                <div style="
                    width: 100%;
                    height: 200px;
                    background: var(--surface);
                    overflow: hidden;
                ">
                    <img src="${variant.imageUrl}"
                         alt="${variant.prompt}"
                         style="width: 100%; height: 100%; object-fit: cover;" />
                </div>
                <div style="padding: 0.75rem;">
                    <p style="
                        font-size: 12px;
                        color: var(--text-muted);
                        margin: 0;
                        overflow: hidden;
                        text-overflow: ellipsis;
                        white-space: nowrap;
                    " title="${variant.prompt}">
                        ${variant.prompt}
                    </p>
                    <p style="
                        font-size: 11px;
                        color: var(--text-muted);
                        margin: 0.25rem 0 0 0;
                    ">
                        ${new Date(variant.createdAt).toLocaleString()}
                    </p>
                </div>
            `;

            // Prepend to show newest first
            grid.insertBefore(card, grid.firstChild);

            // Update variant count
            updateVariantCount();
        }

        // Update variant count display
        function updateVariantCount() {
            const grid = document.getElementById('variants-grid');
            const count = grid.children.length;
            document.getElementById('variant-count').textContent = `${count} variant${count !== 1 ? 's' : ''}`;
        }

        // Save edited character as new
        async function saveEditedCharacter() {
            if (!currentEditedImage || !currentEditCharacter) {
                showNotification('No edited character to save', 'error');
                return;
            }

            try {
                // Show loading
                document.getElementById('loading-overlay').style.display = 'flex';

                const newName = prompt('Enter name for the new character:', `${currentEditCharacter.name} (Edited)`);
                if (!newName) {
                    document.getElementById('loading-overlay').style.display = 'none';
                    return;
                }

                // Create new character with edited image
                const response = await fetch(`${API_BASE}/characters`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: newName,
                        description: `${currentEditCharacter.description}\n\nEdit: ${currentEditedImage.prompt}`,
                        imageUrl: currentEditedImage.editedImageUrl,
                        thumbnailUrl: currentEditedImage.thumbnailUrl,
                        tags: [...(currentEditCharacter.tags || []), 'edited', 'variation'],
                        metadata: {
                            ...currentEditCharacter.metadata,
                            originalCharacterId: currentEditCharacter.id,
                            editPrompt: currentEditedImage.prompt,
                            editedAt: new Date().toISOString()
                        }
                    })
                });

                const result = await response.json();

                if (result.success) {
                    showNotification('New character saved successfully!', 'success');

                    // Reload characters
                    await loadEditCharacters();
                    await loadCharacters(); // Also reload gallery page

                    // Clear edit state
                    discardEdit();
                } else {
                    throw new Error(result.error?.message || 'Failed to save character');
                }

            } catch (error) {
                console.error('Error saving edited character:', error);
                showNotification(`Failed to save: ${error.message}`, 'error');
            } finally {
                document.getElementById('loading-overlay').style.display = 'none';
            }
        }

        // Replace original character
        async function replaceCharacter() {
            if (!currentEditedImage || !currentEditCharacter) {
                showNotification('No edited character to replace', 'error');
                return;
            }

            if (!confirm(`Are you sure you want to replace "${currentEditCharacter.name}" with the edited version? This cannot be undone.`)) {
                return;
            }

            try {
                // Show loading
                document.getElementById('loading-overlay').style.display = 'flex';

                // Update existing character
                const response = await fetch(`${API_BASE}/characters/${currentEditCharacter.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        ...currentEditCharacter,
                        imageUrl: currentEditedImage.editedImageUrl,
                        thumbnailUrl: currentEditedImage.thumbnailUrl,
                        description: `${currentEditCharacter.description}\n\nLast edit: ${currentEditedImage.prompt}`,
                        updatedAt: new Date().toISOString(),
                        metadata: {
                            ...currentEditCharacter.metadata,
                            lastEditPrompt: currentEditedImage.prompt,
                            lastEditedAt: new Date().toISOString()
                        }
                    })
                });

                const result = await response.json();

                if (result.success) {
                    showNotification('Character replaced successfully!', 'success');

                    // Reload characters
                    await loadEditCharacters();
                    await loadCharacters();

                    // Clear edit state
                    discardEdit();
                } else {
                    throw new Error(result.error?.message || 'Failed to replace character');
                }

            } catch (error) {
                console.error('Error replacing character:', error);
                showNotification(`Failed to replace: ${error.message}`, 'error');
            } finally {
                document.getElementById('loading-overlay').style.display = 'none';
            }
        }

        // Discard edit

        // ===== END CHARACTER EDIT PAGE FUNCTIONS =====


