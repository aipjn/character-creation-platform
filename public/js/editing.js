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
