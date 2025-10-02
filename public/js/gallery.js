        async function updateCharacterGallery() {
            console.log('[Gallery] updateCharacterGallery called, characters:', characters);
            const gallery = document.getElementById('character-gallery');

            // Ensure characters is an array
            if (!Array.isArray(characters) || characters.length === 0) {
                console.log('[Gallery] No characters to display');
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
            console.log('[Gallery] Rendering', characters.length, 'character cards');
            const renderCards = async () => {
                const cardsHTML = await Promise.all(characters.map(async character => {
                    const themesHTML = await (window.renderCharacterThemes ? window.renderCharacterThemes(character.id) : Promise.resolve(''));

                    return `
                        <div class="character-card" style="cursor: pointer;" onclick="showCharacterModal('${character.id}')">
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
        
        /**
         * Show character detail modal
         */
        async function showCharacterModal(characterId) {
            const character = characters.find(c => c.id === characterId);
            if (!character) return;

            // Load themes for this character
            const themes = await (window.loadCharacterThemes ? window.loadCharacterThemes(characterId) : Promise.resolve([]));

            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                padding: 2rem;
                animation: fadeIn 0.2s ease-out;
            `;

            modal.innerHTML = `
                <div onclick="event.stopPropagation();" style="
                    background: var(--background);
                    border-radius: var(--radius-lg);
                    max-width: 900px;
                    width: 100%;
                    max-height: 90vh;
                    overflow-y: auto;
                    box-shadow: var(--shadow-xl);
                    animation: slideInFromBottom 0.3s ease-out;
                ">
                    <!-- Header -->
                    <div style="
                        background: var(--gradient-primary);
                        color: white;
                        padding: 2rem;
                        border-radius: var(--radius-lg) var(--radius-lg) 0 0;
                        position: relative;
                    ">
                        <button onclick="this.closest('.modal-overlay').remove()" style="
                            position: absolute;
                            top: 1rem;
                            right: 1rem;
                            background: rgba(255, 255, 255, 0.2);
                            border: none;
                            color: white;
                            width: 36px;
                            height: 36px;
                            border-radius: 50%;
                            cursor: pointer;
                            font-size: 20px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            transition: background 0.2s;
                        " onmouseover="this.style.background='rgba(255, 255, 255, 0.3)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.2)'">
                            <i class="fas fa-times"></i>
                        </button>
                        <h2 style="margin: 0 0 0.5rem 0; font-size: 1.8rem; font-weight: 700;">${character.name}</h2>
                        <p style="margin: 0; opacity: 0.9;">${character.description || 'No description'}</p>
                    </div>

                    <!-- Content -->
                    <div style="padding: 2rem;">
                        <!-- Character Image -->
                        <div style="margin-bottom: 2rem;">
                            <h3 style="margin: 0 0 1rem 0; font-size: 1.2rem; color: var(--text-primary);">
                                <i class="fas fa-image"></i> Character Image
                            </h3>
                            <div style="
                                width: 100%;
                                height: 400px;
                                border-radius: var(--radius);
                                overflow: hidden;
                                background: var(--surface);
                                display: flex;
                                align-items: center;
                                justify-content: center;
                            ">
                                ${character.imageUrl ?
                                    `<img src="${character.imageUrl}" alt="${character.name}" style="width: 100%; height: 100%; object-fit: contain;">` :
                                    `<div style="text-align: center; color: var(--text-muted);">
                                        <i class="fas fa-user" style="font-size: 4rem; margin-bottom: 1rem;"></i>
                                        <p>No image available</p>
                                    </div>`
                                }
                            </div>
                        </div>

                        <!-- Themes -->
                        <div>
                            <h3 style="margin: 0 0 1rem 0; font-size: 1.2rem; color: var(--text-primary);">
                                <i class="fas fa-folder"></i> Themes (${themes.length})
                            </h3>
                            ${themes.length > 0 ? `
                                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem;">
                                    ${themes.map(theme => `
                                        <div onclick="showThemeModal('${characterId}', '${theme.id}')" style="
                                            background: var(--surface);
                                            border: 1px solid var(--border);
                                            border-radius: var(--radius);
                                            padding: 1rem;
                                            cursor: pointer;
                                            transition: all 0.2s;
                                        " onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 16px rgba(0,0,0,0.1)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">
                                            <div style="
                                                width: 100%;
                                                height: 150px;
                                                background: var(--background);
                                                border-radius: var(--radius);
                                                overflow: hidden;
                                                margin-bottom: 0.75rem;
                                            ">
                                                ${theme.variants && theme.variants.length > 0 ?
                                                    `<img src="${theme.variants[0].imageUrl}" alt="${theme.name}" style="width: 100%; height: 100%; object-fit: cover;">` :
                                                    `<div style="display: flex; align-items: center; justify-content: center; height: 100%;">
                                                        <i class="fas fa-folder" style="font-size: 2.5rem; color: var(--text-muted);"></i>
                                                    </div>`
                                                }
                                            </div>
                                            <h4 style="margin: 0 0 0.5rem 0; font-size: 1rem;">${theme.name}</h4>
                                            <p style="margin: 0; font-size: 14px; color: var(--text-muted);">
                                                ${theme.variants?.length || 0} ${theme.variants?.length === 1 ? 'variant' : 'variants'}
                                            </p>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : `
                                <div style="
                                    text-align: center;
                                    padding: 3rem;
                                    background: var(--surface);
                                    border-radius: var(--radius);
                                    color: var(--text-muted);
                                ">
                                    <i class="fas fa-folder-open" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                                    <p>No themes yet</p>
                                </div>
                            `}
                        </div>
                    </div>
                </div>
            `;

            // Close on overlay click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                }
            });

            document.body.appendChild(modal);
        }

        /**
         * Show theme variants modal
         */
        async function showThemeModal(characterId, themeId) {
            try {
                const response = await fetch(`${API_BASE}/themes/${themeId}`);
                const data = await response.json();

                if (!data.success) {
                    throw new Error('Failed to load theme');
                }

                const theme = data.data;
                const character = characters.find(c => c.id === characterId);

                const modal = document.createElement('div');
                modal.className = 'modal-overlay';
                modal.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 10001;
                    padding: 2rem;
                    animation: fadeIn 0.2s ease-out;
                `;

                modal.innerHTML = `
                    <div onclick="event.stopPropagation();" style="
                        background: var(--background);
                        border-radius: var(--radius-lg);
                        max-width: 1200px;
                        width: 100%;
                        max-height: 90vh;
                        overflow-y: auto;
                        box-shadow: var(--shadow-xl);
                        animation: slideInFromBottom 0.3s ease-out;
                    ">
                        <!-- Header -->
                        <div style="
                            background: var(--gradient-primary);
                            color: white;
                            padding: 2rem;
                            border-radius: var(--radius-lg) var(--radius-lg) 0 0;
                            position: relative;
                        ">
                            <button onclick="this.closest('.modal-overlay').remove()" style="
                                position: absolute;
                                top: 1rem;
                                right: 1rem;
                                background: rgba(255, 255, 255, 0.2);
                                border: none;
                                color: white;
                                width: 36px;
                                height: 36px;
                                border-radius: 50%;
                                cursor: pointer;
                                font-size: 20px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                transition: background 0.2s;
                            " onmouseover="this.style.background='rgba(255, 255, 255, 0.3)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.2)'">
                                <i class="fas fa-times"></i>
                            </button>
                            <h2 style="margin: 0 0 0.5rem 0; font-size: 1.8rem; font-weight: 700;">${theme.name}</h2>
                            <p style="margin: 0; opacity: 0.9;">
                                ${character ? character.name : 'Character'} - ${theme.variants?.length || 0} ${theme.variants?.length === 1 ? 'variant' : 'variants'}
                            </p>
                        </div>

                        <!-- Content -->
                        <div style="padding: 2rem;">
                            <h3 style="margin: 0 0 1.5rem 0; font-size: 1.2rem; color: var(--text-primary);">
                                <i class="fas fa-images"></i> Variants
                            </h3>
                            ${theme.variants && theme.variants.length > 0 ? `
                                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1.5rem;">
                                    ${theme.variants.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(variant => `
                                        <div style="
                                            background: var(--surface);
                                            border: 1px solid var(--border);
                                            border-radius: var(--radius);
                                            overflow: hidden;
                                            transition: all 0.2s;
                                        " onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 16px rgba(0,0,0,0.1)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">
                                            <div style="
                                                width: 100%;
                                                height: 250px;
                                                background: var(--background);
                                                display: flex;
                                                align-items: center;
                                                justify-content: center;
                                            ">
                                                ${variant.imageUrl ?
                                                    `<img src="${variant.imageUrl}" alt="Variant" style="width: 100%; height: 100%; object-fit: cover;">` :
                                                    `<div style="text-align: center; color: var(--text-muted);">
                                                        <i class="fas fa-image" style="font-size: 2rem; margin-bottom: 0.5rem;"></i>
                                                        <p style="margin: 0; font-size: 12px;">No image</p>
                                                    </div>`
                                                }
                                            </div>
                                            <div style="padding: 1rem;">
                                                <p style="margin: 0 0 0.5rem 0; font-size: 14px; color: var(--text-secondary); line-height: 1.4;" title="${variant.prompt}">
                                                    ${variant.prompt.length > 60 ? variant.prompt.substring(0, 60) + '...' : variant.prompt}
                                                </p>
                                                <p style="margin: 0; font-size: 12px; color: var(--text-muted);">
                                                    ${new Date(variant.createdAt).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            ` : `
                                <div style="
                                    text-align: center;
                                    padding: 3rem;
                                    background: var(--surface);
                                    border-radius: var(--radius);
                                    color: var(--text-muted);
                                ">
                                    <i class="fas fa-images" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                                    <p>No variants yet</p>
                                </div>
                            `}
                        </div>
                    </div>
                `;

                // Close on overlay click
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        modal.remove();
                    }
                });

                document.body.appendChild(modal);
            } catch (error) {
                console.error('Error loading theme:', error);
                if (window.showNotification) {
                    window.showNotification('Failed to load theme details', 'error');
                }
            }
        }

        // Export functions
        window.showCharacterModal = showCharacterModal;
        window.showThemeModal = showThemeModal;

        // Clear create form
