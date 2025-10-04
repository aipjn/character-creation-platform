/**
 * Character Themes and Variants Management
 * 角色主题和变体管理逻辑
 */

// Use window object to avoid conflicts with app.html
// Global state will be stored in window._themeEditor
if (!window._themeEditor) {
    window._themeEditor = {
        currentCharacter: null,
        currentTheme: null,
        characterThemes: {}
    };
}

/**
 * 渲染角色的主题HTML（用于Gallery页面）
 */
async function renderCharacterThemes(characterId) {
    const themes = await loadCharacterThemes(characterId);

    if (!themes || themes.length === 0) {
        return `<p style="font-size: 14px; color: var(--text-muted); margin: 1rem 0;">No themes yet. Click Edit to create themes.</p>`;
    }

    return `
        <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border);">
            <h5 style="font-size: 14px; font-weight: 600; margin-bottom: 0.75rem; color: var(--text-secondary);">
                Themes (${themes.length})
            </h5>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 0.5rem;">
                ${themes.map(theme => `
                    <div style="
                        background: var(--background);
                        border: 1px solid var(--border);
                        border-radius: var(--radius);
                        padding: 0.5rem;
                        font-size: 12px;
                    ">
                        <div style="
                            width: 100%;
                            height: 80px;
                            background: var(--surface);
                            border-radius: 4px;
                            overflow: hidden;
                            margin-bottom: 0.5rem;
                        ">
                            ${theme.variants && theme.variants.length > 0 ?
                                `<img src="${theme.variants[0].imageUrl}" alt="${theme.name}" style="width: 100%; height: 100%; object-fit: cover;">` :
                                `<div style="display: flex; align-items: center; justify-content: center; height: 100%;">
                                    <i class="fas fa-folder" style="font-size: 1.5rem; color: var(--text-muted);"></i>
                                </div>`
                            }
                        </div>
                        <div style="font-weight: 500; margin-bottom: 0.25rem;">${theme.name}</div>
                        <div style="color: var(--text-muted);">
                            ${theme.variants?.length || 0} ${theme.variants?.length === 1 ? 'variant' : 'variants'}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * 加载角色的所有主题
 */
async function loadCharacterThemes(characterId) {
    try {
        const response = await fetch(`${API_BASE}/themes/character/${characterId}`, {
            headers: window.AuthModule.getAuthHeaders()
        });
        const data = await response.json();

        if (data.success) {
            window._themeEditor.characterThemes[characterId] = data.data || [];
            return data.data;
        } else {
            console.error('Failed to load themes:', data.error);
            return [];
        }
    } catch (error) {
        console.error('Error loading themes:', error);
        return [];
    }
}

/**
 * 创建新主题
 */
async function createTheme(characterId, name, description = '') {
    try {
        const response = await fetch(`${API_BASE}/themes`, {
            method: 'POST',
            headers: window.AuthModule.getAuthHeaders(),
            body: JSON.stringify({
                characterId,
                name,
                description
            })
        });

        const data = await response.json();

        if (data.success) {
            // 重新加载该角色的主题
            await loadCharacterThemes(characterId);
            return data.data;
        } else {
            throw new Error(data.error?.message || 'Failed to create theme');
        }
    } catch (error) {
        console.error('Error creating theme:', error);
        throw error;
    }
}

/**
 * 生成变体图像
 */
async function generateVariant(themeId, prompt, metadata = {}) {
    try {
        const response = await fetch(`${API_BASE}/themes/${themeId}/variants/generate`, {
            method: 'POST',
            headers: window.AuthModule.getAuthHeaders(),
            body: JSON.stringify({
                prompt,
                metadata
            })
        });

        const data = await response.json();

        if (data.success) {
            return data.data;
        } else {
            throw new Error(data.error?.message || 'Failed to generate variant');
        }
    } catch (error) {
        console.error('Error generating variant:', error);
        throw error;
    }
}

/**
 * 删除主题
 */
async function deleteTheme(themeId) {
    try {
        const response = await fetch(`${API_BASE}/themes/${themeId}`, {
            method: 'DELETE',
            headers: window.AuthModule.getAuthHeaders()
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error?.message || 'Failed to delete theme');
        }

        return true;
    } catch (error) {
        console.error('Error deleting theme:', error);
        throw error;
    }
}

/**
 * 删除变体
 */
async function deleteVariant(variantId) {
    try {
        const response = await fetch(`${API_BASE}/themes/variants/${variantId}`, {
            method: 'DELETE',
            headers: window.AuthModule.getAuthHeaders()
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error?.message || 'Failed to delete variant');
        }

        return true;
    } catch (error) {
        console.error('Error deleting variant:', error);
        throw error;
    }
}

/**
 * Edit页面 - 步骤1：选择角色
 */
function showEditStep1_SelectCharacter() {
    const editPage = document.getElementById('edit-page');

    editPage.innerHTML = `
        <div style="max-width: 1200px; margin: 0 auto;">
            <div style="margin-bottom: 2rem;">
                <h2 style="font-size: 1.8rem; font-weight: 700; margin-bottom: 0.5rem;">
                    <i class="fas fa-edit" style="color: var(--primary); margin-right: 0.5rem;"></i>
                    Character Editor
                </h2>
                <p style="color: var(--text-muted);">Select a character to create themed variations</p>
            </div>

            <h3 style="font-size: 1.2rem; font-weight: 600; margin-bottom: 1rem;">Your Characters</h3>
            <div id="edit-characters-grid" style="
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                gap: 1.5rem;
            ">
                <!-- Characters will be loaded here -->
            </div>
        </div>
    `;

    // Load characters
    loadEditCharacters();
}

/**
 * 加载可编辑的角色列表
 */
async function loadEditCharacters() {
    try {
        const response = await fetch(`${API_BASE}/characters`, {
            headers: window.AuthModule.getAuthHeaders()
        });
        const data = await response.json();

        if (data.success) {
            const characters = data.data.items;
            const grid = document.getElementById('edit-characters-grid');

            if (characters.length === 0) {
                grid.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                        <i class="fas fa-user-plus" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                        <h3 style="color: var(--text-secondary);">No Characters Yet</h3>
                        <p style="color: var(--text-muted);">Create your first character to get started</p>
                        <button class="btn btn-primary" onclick="switchPage('create')" style="margin-top: 1rem;">
                            <i class="fas fa-plus"></i> Create Character
                        </button>
                    </div>
                `;
                return;
            }

            grid.innerHTML = characters.map(char => `
                <div class="character-card" onclick="selectCharacterForEdit('${char.id}')" style="cursor: pointer; transition: transform 0.2s;">
                    <div style="
                        width: 100%;
                        height: 250px;
                        background: var(--surface);
                        border-radius: var(--radius);
                        overflow: hidden;
                        margin-bottom: 1rem;
                    ">
                        ${char.imageUrl ?
                            `<img src="${char.imageUrl}" alt="${char.name}" style="width: 100%; height: 100%; object-fit: cover;">` :
                            `<div style="display: flex; align-items: center; justify-content: center; height: 100%;">
                                <i class="fas fa-user" style="font-size: 3rem; color: var(--text-muted);"></i>
                            </div>`
                        }
                    </div>
                    <h4 style="margin: 0 0 0.5rem 0;">${char.name}</h4>
                    <p style="font-size: 14px; color: var(--text-secondary); margin: 0;">
                        Click to edit character
                    </p>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading characters:', error);
    }
}

/**
 * 选择角色进行编辑 → 直接进入生成页面
 */
async function selectCharacterForEdit(characterId) {
    try {
        const response = await fetch(`${API_BASE}/characters/${characterId}`, {
            headers: window.AuthModule.getAuthHeaders()
        });
        const data = await response.json();

        if (data.success) {
            window._themeEditor.currentCharacter = data.data;

            // Load themes for this character
            const themes = await loadCharacterThemes(characterId);

            // Always go to generate page, theme will be selected via dropdown
            await showGenerateVariantsPage(window._themeEditor.currentCharacter, themes);
        }
    } catch (error) {
        console.error('Error loading character:', error);
        if (window.showNotification) {
            window.showNotification('Failed to load character', 'error');
        }
    }
}

/**
 * Edit页面 - 步骤2：选择或创建主题
 */
async function showEditStep2_SelectTheme(character, themes) {
    const editPage = document.getElementById('edit-page');

    editPage.innerHTML = `
        <div style="max-width: 1200px; margin: 0 auto;">
            <!-- Header with back button -->
            <div style="margin-bottom: 2rem;">
                <button class="btn btn-secondary" onclick="showEditStep1_SelectCharacter()" style="margin-bottom: 1rem;">
                    <i class="fas fa-arrow-left"></i> Back to Characters
                </button>
                <h2 style="font-size: 1.8rem; font-weight: 700; margin-bottom: 0.5rem;">
                    Editing: ${character.name}
                </h2>
                <p style="color: var(--text-muted);">Select a theme or create a new one to generate variations</p>
            </div>

            <!-- Character preview -->
            <div style="
                background: var(--surface);
                border: 1px solid var(--border);
                border-radius: var(--radius-lg);
                padding: 1.5rem;
                margin-bottom: 2rem;
                display: flex;
                align-items: center;
                gap: 1.5rem;
            ">
                <div style="
                    width: 120px;
                    height: 120px;
                    border-radius: var(--radius);
                    overflow: hidden;
                    flex-shrink: 0;
                ">
                    ${character.imageUrl ?
                        `<img src="${character.imageUrl}" alt="${character.name}" style="width: 100%; height: 100%; object-fit: cover;">` :
                        `<div style="display: flex; align-items: center; justify-content: center; height: 100%; background: var(--background);">
                            <i class="fas fa-user" style="font-size: 2rem; color: var(--text-muted);"></i>
                        </div>`
                    }
                </div>
                <div>
                    <h3 style="margin: 0 0 0.5rem 0;">${character.name}</h3>
                    <p style="margin: 0; color: var(--text-secondary); font-size: 14px;">${character.description || 'No description'}</p>
                </div>
            </div>

            <!-- Create new theme button -->
            <button class="btn btn-primary" onclick="showCreateThemeDialog('${character.id}')" style="width: 100%; margin-bottom: 2rem; padding: 1rem;">
                <i class="fas fa-plus"></i> Create New Theme
            </button>

            <!-- Existing themes -->
            <h3 style="font-size: 1.2rem; font-weight: 600; margin-bottom: 1rem;">Themes (${themes.length})</h3>
            <div id="themes-grid" style="
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                gap: 1.5rem;
            ">
                ${themes.length === 0 ? `
                    <div style="grid-column: 1/-1; text-align: center; padding: 3rem; background: var(--surface); border-radius: var(--radius-lg);">
                        <i class="fas fa-folder-open" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                        <h3 style="color: var(--text-secondary);">No Themes Yet</h3>
                        <p style="color: var(--text-muted);">Create your first theme to organize character variations</p>
                    </div>
                ` : themes.map(theme => `
                    <div class="theme-card" onclick="selectThemeForEdit('${theme.id}')" style="
                        background: var(--surface);
                        border: 1px solid var(--border);
                        border-radius: var(--radius-lg);
                        padding: 1.5rem;
                        cursor: pointer;
                        transition: all 0.2s;
                    ">
                        <div style="margin-bottom: 1rem;">
                            ${theme.coverImageUrl ?
                                `<img src="${theme.coverImageUrl}" alt="${theme.name}" style="width: 100%; height: 150px; object-fit: cover; border-radius: var(--radius);">` :
                                theme.variants && theme.variants.length > 0 ?
                                    `<img src="${theme.variants[0].imageUrl}" alt="${theme.name}" style="width: 100%; height: 150px; object-fit: cover; border-radius: var(--radius);">` :
                                    `<div style="width: 100%; height: 150px; background: var(--background); border-radius: var(--radius); display: flex; align-items: center; justify-content: center;">
                                        <i class="fas fa-images" style="font-size: 2rem; color: var(--text-muted);"></i>
                                    </div>`
                            }
                        </div>
                        <h4 style="margin: 0 0 0.5rem 0;">${theme.name}</h4>
                        <p style="font-size: 14px; color: var(--text-secondary); margin: 0 0 1rem 0;">
                            ${theme.description || 'No description'}
                        </p>
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <span style="font-size: 14px; color: var(--text-muted);">
                                <i class="fas fa-image"></i> ${theme.variants?.length || 0} variants
                            </span>
                            <button class="btn btn-sm btn-outline" onclick="event.stopPropagation(); deleteThemeWithConfirm('${theme.id}', '${character.id}')">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

/**
 * 显示创建主题对话框
 */
function showCreateThemeDialog(characterId) {
    const name = prompt('Enter theme name:', '');
    if (!name) return;

    const description = prompt('Enter theme description (optional):', '');

    createThemeAndRefresh(characterId, name, description);
}

/**
 * 创建主题并刷新
 */
async function createThemeAndRefresh(characterId, name, description) {
    try {
        if (window.showNotification) {
            window.showNotification('Creating theme...', 'info');
        }

        await createTheme(characterId, name, description);

        // Refresh step 2
        await showEditStep2_SelectTheme(window._themeEditor.currentCharacter);

        if (window.showNotification) {
            window.showNotification('Theme created successfully!', 'success');
        }
    } catch (error) {
        if (window.showNotification) {
            window.showNotification('Failed to create theme', 'error');
        }
    }
}

/**
 * 删除主题（带确认）
 */
async function deleteThemeWithConfirm(themeId, characterId) {
    if (!confirm('Are you sure you want to delete this theme? All variants will also be deleted.')) {
        return;
    }

    try {
        if (window.showNotification) {
            window.showNotification('Deleting theme...', 'info');
        }

        await deleteTheme(themeId);

        // Refresh step 2
        await showEditStep2_SelectTheme(window._themeEditor.currentCharacter);

        if (window.showNotification) {
            window.showNotification('Theme deleted successfully!', 'success');
        }
    } catch (error) {
        if (window.showNotification) {
            window.showNotification('Failed to delete theme', 'error');
        }
    }
}

/**
 * 选择主题进行编辑 → 进入步骤3
 */
async function selectThemeForEdit(themeId) {
    try {
        const response = await fetch(`${API_BASE}/themes/${themeId}`, {
            headers: window.AuthModule.getAuthHeaders()
        });
        const data = await response.json();

        if (data.success) {
            window._themeEditor.currentTheme = data.data;
            await showEditStep3_GenerateVariants(window._themeEditor.currentCharacter, window._themeEditor.currentTheme);
        }
    } catch (error) {
        console.error('Error loading theme:', error);
        if (window.showNotification) {
            window.showNotification('Failed to load theme', 'error');
        }
    }
}

/**
 * 显示生成变体页面（带theme下拉框）
 */
async function showGenerateVariantsPage(character, themes) {
    const editPage = document.getElementById('edit-page');

    window._themeEditor.availableThemes = themes || [];
    window._themeEditor.pendingThemes = []; // Store pending themes created in UI

    // Check if there's already a "Default Theme" in saved themes
    const existingDefaultTheme = themes.find(t => t.name === 'Default Theme');

    let initialTheme;
    if (existingDefaultTheme) {
        // Use existing Default Theme
        initialTheme = existingDefaultTheme;
        window._themeEditor.currentTheme = existingDefaultTheme;
    } else {
        // Create pending Default Theme
        initialTheme = {
            id: null,
            name: 'Default Theme',
            isPending: true,
            characterId: character.id
        };
        window._themeEditor.currentTheme = initialTheme;
    }

    editPage.innerHTML = `
        <div style="width: 100%; padding: 0 2rem;">
            <!-- Header -->
            <div style="margin-bottom: 2rem;">
                <button class="btn btn-secondary" onclick="showEditStep1_SelectCharacter()" style="margin-bottom: 1rem;">
                    <i class="fas fa-arrow-left"></i> Back
                </button>
                <h2 style="font-size: 1.8rem; font-weight: 700; margin-bottom: 0.5rem;">
                    ${character.name}
                </h2>
                <p style="color: var(--text-muted);">Generate variations for this character</p>
            </div>

            <!-- Main layout: Generate panel + Variants gallery -->
            <div style="display: grid; grid-template-columns: 400px 1fr; gap: 2rem;">
                <!-- Left: Generate panel -->
                <div style="
                    background: var(--surface);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    padding: 1.5rem;
                    height: fit-content;
                    position: sticky;
                    top: 2rem;
                ">
                    <h3 style="margin: 0 0 1rem 0; font-size: 1.1rem;">
                        <i class="fas fa-wand-magic-sparkles"></i> Generate Variant
                    </h3>

                    <!-- Theme selector and New Theme button -->
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; font-size: 14px; font-weight: 600; margin-bottom: 0.5rem;">Theme:</label>
                        <div style="display: flex; gap: 0.5rem;">
                            <select id="theme-selector" onchange="onThemeChange()" style="
                                flex: 1;
                                padding: 0.5rem;
                                border: 2px solid var(--border);
                                border-radius: var(--radius);
                                font-size: 14px;
                                background: var(--background);
                            ">
                                ${existingDefaultTheme ?
                                    `<option value="${existingDefaultTheme.id}" selected>Default Theme</option>
                                     ${themes.filter(t => t.id !== existingDefaultTheme.id).map(t => `<option value="${t.id}">${t.name}</option>`).join('')}` :
                                    `<option value="default" selected>Default Theme</option>
                                     ${themes.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}`
                                }
                            </select>
                            <button class="btn btn-sm btn-outline" onclick="createNewThemeInUI()" title="Create new theme" style="flex-shrink: 0;">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                    </div>

                    <!-- Base character preview -->
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; font-size: 12px; color: var(--text-muted); margin-bottom: 0.5rem;">Base Character:</label>
                        <div style="
                            width: 100%;
                            height: 150px;
                            border-radius: var(--radius);
                            overflow: hidden;
                            background: var(--background);
                        ">
                            ${character.imageUrl ?
                                `<img src="${character.imageUrl}" alt="${character.name}" style="width: 100%; height: 100%; object-fit: cover;">` :
                                `<div style="display: flex; align-items: center; justify-content: center; height: 100%;">
                                    <i class="fas fa-user" style="font-size: 2rem; color: var(--text-muted);"></i>
                                </div>`
                            }
                        </div>
                    </div>

                    <!-- Prompt input -->
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; font-size: 14px;">
                            Describe the variant:
                        </label>
                        <textarea
                            id="variant-prompt"
                            placeholder="E.g., 'wearing a red dress', 'in a park setting', 'smiling happily'..."
                            style="
                                width: 100%;
                                min-height: 100px;
                                padding: 0.75rem;
                                border: 2px solid var(--border);
                                border-radius: var(--radius);
                                font-size: 14px;
                                font-family: inherit;
                                resize: vertical;
                            "
                        ></textarea>
                    </div>

                    <!-- Quick options -->
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; font-size: 12px; color: var(--text-muted); margin-bottom: 0.5rem;">Quick Options:</label>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                            <button class="btn btn-sm btn-outline" onclick="addToVariantPrompt('different outfit')">
                                <i class="fas fa-tshirt"></i> Outfit
                            </button>
                            <button class="btn btn-sm btn-outline" onclick="addToVariantPrompt('different pose')">
                                <i class="fas fa-running"></i> Pose
                            </button>
                            <button class="btn btn-sm btn-outline" onclick="addToVariantPrompt('different expression')">
                                <i class="fas fa-smile"></i> Expression
                            </button>
                            <button class="btn btn-sm btn-outline" onclick="addToVariantPrompt('different scene')">
                                <i class="fas fa-image"></i> Scene
                            </button>
                        </div>
                    </div>

                    <!-- Generate button -->
                    <button id="generate-variant-btn" class="btn btn-primary" onclick="generateVariantWithTheme()" style="width: 100%; padding: 0.75rem;">
                        <i class="fas fa-sparkles"></i> Generate Variant
                    </button>
                </div>

                <!-- Right: Variants gallery -->
                <div>
                    <h3 style="margin: 0 0 1rem 0; font-size: 1.1rem;" id="variants-title">
                        Generated Variants (0)
                    </h3>
                    <div id="variants-gallery" style="
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
                        gap: 1rem;
                    ">
                        <div style="grid-column: 1/-1; text-align: center; padding: 3rem; background: var(--surface); border-radius: var(--radius-lg);">
                            <i class="fas fa-images" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                            <h3 style="color: var(--text-secondary);">No Variants Yet</h3>
                            <p style="color: var(--text-muted);">Generate your first variant using the panel on the left</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Display initial variants if Default Theme exists
    if (existingDefaultTheme && existingDefaultTheme.variants) {
        updateVariantsDisplay(existingDefaultTheme.variants);
    }

    // Update button with credit cost
    if (window.ButtonCredits) {
        window.ButtonCredits.updateButtonWithCost('generate-variant-btn', 'Generate Variant', '/themes/variants/generate');
    }
}

/**
 * 在UI中创建新theme (不调用后台)
 */
function createNewThemeInUI() {
    const themeName = prompt('Enter theme name:', '');
    if (!themeName || !themeName.trim()) {
        return;
    }

    const selector = document.getElementById('theme-selector');

    // Create a temporary ID for the pending theme
    const tempId = `pending_${Date.now()}`;

    // Create pending theme object
    const pendingTheme = {
        id: tempId,
        name: themeName.trim(),
        isPending: true,
        characterId: window._themeEditor.currentCharacter.id,
        variants: []
    };

    // Add to pending themes
    window._themeEditor.pendingThemes.push(pendingTheme);

    // Add option to dropdown
    const option = document.createElement('option');
    option.value = tempId;
    option.textContent = pendingTheme.name;
    selector.appendChild(option);

    // Select the new theme
    selector.value = tempId;
    window._themeEditor.currentTheme = pendingTheme;

    // Clear variants display
    updateVariantsDisplay([]);

    if (window.showNotification) {
        window.showNotification(`Theme "${themeName.trim()}" created. Generate a variant to save it.`, 'info');
    }
}

/**
 * Theme下拉框变化时
 */
async function onThemeChange() {
    const selector = document.getElementById('theme-selector');
    const themeId = selector.value;

    if (themeId === 'default') {
        // Default theme selected
        window._themeEditor.currentTheme = {
            id: null,
            name: 'Default Theme',
            isPending: true,
            characterId: window._themeEditor.currentCharacter.id
        };
        // Clear variants display (default theme has no variants until generated)
        updateVariantsDisplay([]);
    } else if (themeId.startsWith('pending_')) {
        // Pending theme (created in UI but not saved)
        const pendingTheme = window._themeEditor.pendingThemes.find(t => t.id === themeId);
        if (pendingTheme) {
            window._themeEditor.currentTheme = pendingTheme;
            updateVariantsDisplay(pendingTheme.variants || []);
        }
    } else {
        // Existing theme selected, load its variants
        try {
            const response = await fetch(`${API_BASE}/themes/${themeId}`, {
                headers: window.AuthModule.getAuthHeaders()
            });
            const data = await response.json();

            if (data.success) {
                window._themeEditor.currentTheme = data.data;
                updateVariantsDisplay(data.data.variants || []);
            }
        } catch (error) {
            console.error('Error loading theme:', error);
        }
    }
}

/**
 * 更新variants展示
 */
function updateVariantsDisplay(variants) {
    const gallery = document.getElementById('variants-gallery');
    const title = document.getElementById('variants-title');

    title.textContent = `Generated Variants (${variants.length})`;

    if (!variants || variants.length === 0) {
        gallery.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem; background: var(--surface); border-radius: var(--radius-lg);">
                <i class="fas fa-images" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                <h3 style="color: var(--text-secondary);">No Variants Yet</h3>
                <p style="color: var(--text-muted);">Generate your first variant using the panel on the left</p>
            </div>
        `;
        return;
    }

    // Render variants (newest first)
    const sortedVariants = [...variants].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    gallery.innerHTML = sortedVariants.map(variant => `
        <div class="variant-card" style="
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            overflow: hidden;
            position: relative;
            transition: transform 0.2s, box-shadow 0.2s;
            cursor: pointer;
        " onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 16px rgba(0,0,0,0.1)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">
            <div style="width: 100%; height: 200px; background: var(--background); display: flex; align-items: center; justify-content: center;">
                ${variant.imageUrl ?
                    `<img src="${variant.imageUrl}" alt="Variant" style="width: 100%; height: 100%; object-fit: cover;" onerror="console.error('Failed to load variant image:', '${variant.imageUrl}')">` :
                    `<div style="text-align: center; color: var(--text-muted);">
                        <i class="fas fa-image" style="font-size: 2rem; margin-bottom: 0.5rem;"></i>
                        <p style="margin: 0; font-size: 12px;">No image</p>
                    </div>`
                }
            </div>
            <div style="padding: 0.75rem;">
                <p style="margin: 0; font-size: 12px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${variant.prompt}">
                    ${variant.prompt}
                </p>
                <p style="font-size: 11px; color: var(--text-muted); margin: 0.25rem 0 0.5rem 0;">
                    ${new Date(variant.createdAt).toLocaleString()}
                </p>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-sm btn-outline" onclick="deleteVariantWithConfirm('${variant.id}')" style="flex: 1;">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * Edit页面 - 步骤3：生成变体（旧版，保留向后兼容）
 */
async function showEditStep3_GenerateVariants(character, theme) {
    const editPage = document.getElementById('edit-page');

    editPage.innerHTML = `
        <div style="width: 100%; padding: 0 2rem;">
            <!-- Header -->
            <div style="margin-bottom: 2rem;">
                <button class="btn btn-secondary" onclick="showEditStep1_SelectCharacter()" style="margin-bottom: 1rem;">
                    <i class="fas fa-arrow-left"></i> Back
                </button>
                <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem;">
                    <h2 style="font-size: 1.8rem; font-weight: 700; margin: 0;">
                        ${character.name} - ${theme.name}
                    </h2>
                    <button class="btn btn-sm btn-outline" onclick="renameTheme('${theme.id}', '${character.id}')" title="Rename theme">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
                <p style="color: var(--text-muted);">${theme.description || 'Generate variations for this theme'}</p>
            </div>

            <!-- Main layout: Generate panel + Variants gallery -->
            <div style="display: grid; grid-template-columns: 400px 1fr; gap: 2rem;">
                <!-- Left: Generate panel -->
                <div style="
                    background: var(--surface);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    padding: 1.5rem;
                    height: fit-content;
                    position: sticky;
                    top: 2rem;
                ">
                    <h3 style="margin: 0 0 1rem 0; font-size: 1.1rem;">
                        <i class="fas fa-wand-magic-sparkles"></i> Generate Variant
                    </h3>

                    <!-- Base character preview -->
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; font-size: 12px; color: var(--text-muted); margin-bottom: 0.5rem;">Base Character:</label>
                        <div style="
                            width: 100%;
                            height: 150px;
                            border-radius: var(--radius);
                            overflow: hidden;
                            background: var(--background);
                        ">
                            ${character.imageUrl ?
                                `<img src="${character.imageUrl}" alt="${character.name}" style="width: 100%; height: 100%; object-fit: cover;">` :
                                `<div style="display: flex; align-items: center; justify-content: center; height: 100%;">
                                    <i class="fas fa-user" style="font-size: 2rem; color: var(--text-muted);"></i>
                                </div>`
                            }
                        </div>
                    </div>

                    <!-- Prompt input -->
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; font-weight: 600; margin-bottom: 0.5rem; font-size: 14px;">
                            Describe the variant:
                        </label>
                        <textarea
                            id="variant-prompt"
                            placeholder="E.g., 'wearing a red dress', 'in a park setting', 'smiling happily'..."
                            style="
                                width: 100%;
                                min-height: 100px;
                                padding: 0.75rem;
                                border: 2px solid var(--border);
                                border-radius: var(--radius);
                                font-size: 14px;
                                font-family: inherit;
                                resize: vertical;
                            "
                        ></textarea>
                    </div>

                    <!-- Quick options -->
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; font-size: 12px; color: var(--text-muted); margin-bottom: 0.5rem;">Quick Options:</label>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                            <button class="btn btn-sm btn-outline" onclick="addToVariantPrompt('different outfit')">
                                <i class="fas fa-tshirt"></i> Outfit
                            </button>
                            <button class="btn btn-sm btn-outline" onclick="addToVariantPrompt('different pose')">
                                <i class="fas fa-running"></i> Pose
                            </button>
                            <button class="btn btn-sm btn-outline" onclick="addToVariantPrompt('different expression')">
                                <i class="fas fa-smile"></i> Expression
                            </button>
                            <button class="btn btn-sm btn-outline" onclick="addToVariantPrompt('different scene')">
                                <i class="fas fa-image"></i> Scene
                            </button>
                        </div>
                    </div>

                    <!-- Generate button -->
                    <button id="generate-variant-btn" class="btn btn-primary" onclick="generateVariantImage()" style="width: 100%; padding: 0.75rem;">
                        <i class="fas fa-sparkles"></i> Generate Variant
                    </button>
                </div>

                <!-- Right: Variants gallery -->
                <div>
                    <h3 style="margin: 0 0 1rem 0; font-size: 1.1rem;">
                        Generated Variants (${theme.variants?.length || 0})
                    </h3>
                    <div id="variants-gallery" style="
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
                        gap: 1rem;
                    ">
                        ${theme.variants && theme.variants.length > 0 ?
                            theme.variants.map(variant => `
                                <div class="variant-card" style="
                                    background: var(--surface);
                                    border: 1px solid var(--border);
                                    border-radius: var(--radius);
                                    overflow: hidden;
                                    position: relative;
                                    transition: transform 0.2s, box-shadow 0.2s;
                                    cursor: pointer;
                                " onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 8px 16px rgba(0,0,0,0.1)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">
                                    <div style="width: 100%; height: 200px; background: var(--background); display: flex; align-items: center; justify-content: center;">
                                        ${variant.imageUrl ?
                                            `<img src="${variant.imageUrl}" alt="Variant" style="width: 100%; height: 100%; object-fit: cover;" onerror="console.error('Failed to load variant image:', '${variant.imageUrl}')">` :
                                            `<div style="text-align: center; color: var(--text-muted);">
                                                <i class="fas fa-image" style="font-size: 2rem; margin-bottom: 0.5rem;"></i>
                                                <p style="margin: 0; font-size: 12px;">No image</p>
                                            </div>`
                                        }
                                    </div>
                                    <div style="padding: 0.75rem;">
                                        <p style="margin: 0; font-size: 12px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${variant.prompt}">
                                            ${variant.prompt}
                                        </p>
                                        <p style="font-size: 11px; color: var(--text-muted); margin: 0.25rem 0 0.5rem 0;">
                                            ${new Date(variant.createdAt).toLocaleString()}
                                        </p>
                                        <div style="display: flex; gap: 0.5rem;">
                                            <button class="btn btn-sm btn-outline" onclick="deleteVariantWithConfirm('${variant.id}')" style="flex: 1;">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            `).join('') :
                            `<div style="grid-column: 1/-1; text-align: center; padding: 3rem; background: var(--surface); border-radius: var(--radius-lg);">
                                <i class="fas fa-images" style="font-size: 3rem; color: var(--text-muted); margin-bottom: 1rem;"></i>
                                <h3 style="color: var(--text-secondary);">No Variants Yet</h3>
                                <p style="color: var(--text-muted);">Generate your first variant using the panel on the left</p>
                            </div>`
                        }
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * 添加快捷选项到提示词
 */
function addToVariantPrompt(text) {
    const textarea = document.getElementById('variant-prompt');
    if (textarea) {
        const currentValue = textarea.value.trim();
        textarea.value = currentValue ? `${currentValue}, ${text}` : text;
    }
}

/**
 * 生成变体图像
 */
async function generateVariantImage() {
    const promptTextarea = document.getElementById('variant-prompt');
    const prompt = promptTextarea?.value.trim();

    if (!prompt) {
        if (window.showNotification) {
            window.showNotification('Please describe the variant', 'error');
        }
        return;
    }

    if (!window._themeEditor.currentTheme) {
        if (window.showNotification) {
            window.showNotification('No theme selected', 'error');
        }
        return;
    }

    const generateBtn = document.getElementById('generate-variant-btn');
    if (generateBtn) {
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
    }

    try {
        if (window.showNotification) {
            window.showNotification('Generating variant...', 'info');
        }

        const variant = await generateVariant(window._themeEditor.currentTheme.id, prompt);
        console.log('[Variant] Generated variant data:', variant);

        // Add to current theme variants
        if (!window._themeEditor.currentTheme.variants) {
            window._themeEditor.currentTheme.variants = [];
        }
        window._themeEditor.currentTheme.variants.unshift(variant);
        console.log('[Variant] Current theme variants:', window._themeEditor.currentTheme.variants);

        // Refresh step 3
        await showEditStep3_GenerateVariants(window._themeEditor.currentCharacter, window._themeEditor.currentTheme);

        if (window.showNotification) {
            window.showNotification('Variant generated successfully!', 'success');
        }
    } catch (error) {
        if (window.showNotification) {
            window.showNotification('Failed to generate variant: ' + error.message, 'error');
        }

        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<i class="fas fa-sparkles"></i> Generate Variant';
        }
    }
}

/**
 * 重命名主题
 */
async function renameTheme(themeId, characterId) {
    const newName = prompt('Enter new theme name:');

    if (!newName || !newName.trim()) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/themes/${themeId}`, {
            method: 'PUT',
            headers: window.AuthModule.getAuthHeaders(),
            body: JSON.stringify({
                name: newName.trim()
            })
        });

        const data = await response.json();

        if (data.success) {
            window._themeEditor.currentTheme = data.data;
            await showEditStep3_GenerateVariants(window._themeEditor.currentCharacter, window._themeEditor.currentTheme);

            if (window.showNotification) {
                window.showNotification('Theme renamed successfully!', 'success');
            }
        } else {
            throw new Error(data.error?.message || 'Failed to rename theme');
        }
    } catch (error) {
        console.error('Error renaming theme:', error);
        if (window.showNotification) {
            window.showNotification('Failed to rename theme', 'error');
        }
    }
}

/**
 * 删除变体（带确认）
 */
async function deleteVariantWithConfirm(variantId) {
    if (!confirm('Are you sure you want to delete this variant?')) {
        return;
    }

    try {
        if (window.showNotification) {
            window.showNotification('Deleting variant...', 'info');
        }

        await deleteVariant(variantId);

        // If we're in the new combined page
        const selector = document.getElementById('theme-selector');
        if (selector) {
            // Reload current theme's variants
            await onThemeChange();
        } else {
            // Old page flow - reload theme data
            const response = await fetch(`${API_BASE}/themes/${window._themeEditor.currentTheme.id}`, {
                headers: window.AuthModule.getAuthHeaders()
            });
            const data = await response.json();

            if (data.success) {
                window._themeEditor.currentTheme = data.data;
                await showEditStep3_GenerateVariants(window._themeEditor.currentCharacter, window._themeEditor.currentTheme);
            }
        }

        if (window.showNotification) {
            window.showNotification('Variant deleted successfully!', 'success');
        }
    } catch (error) {
        if (window.showNotification) {
            window.showNotification('Failed to delete variant', 'error');
        }
    }
}

/**
 * 生成变体（带theme处理逻辑）
 */
async function generateVariantWithTheme() {
    const promptTextarea = document.getElementById('variant-prompt');
    const prompt = promptTextarea?.value.trim();

    if (!prompt) {
        if (window.showNotification) {
            window.showNotification('Please describe the variant', 'error');
        }
        return;
    }

    if (!window._themeEditor.currentTheme) {
        if (window.showNotification) {
            window.showNotification('No theme selected', 'error');
        }
        return;
    }

    const generateBtn = document.getElementById('generate-variant-btn');
    if (generateBtn) {
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
    }

    try {
        let targetThemeId = window._themeEditor.currentTheme.id;
        const currentTheme = window._themeEditor.currentTheme;

        // If theme is pending (not saved to backend), create it first
        if (currentTheme.isPending) {
            if (window.showNotification) {
                window.showNotification('Creating theme...', 'info');
            }

            const newTheme = await createTheme(
                window._themeEditor.currentCharacter.id,
                currentTheme.name,
                ''
            );
            targetThemeId = newTheme.id;

            // Update current theme to saved theme
            window._themeEditor.currentTheme = newTheme;

            // Update dropdown
            const selector = document.getElementById('theme-selector');
            const currentValue = selector.value;

            // If it was a pending theme, remove the old option and add the real one
            if (currentValue.startsWith('pending_')) {
                const oldOption = selector.querySelector(`option[value="${currentValue}"]`);
                if (oldOption) {
                    oldOption.remove();
                }
                // Remove from pending themes
                window._themeEditor.pendingThemes = window._themeEditor.pendingThemes.filter(t => t.id !== currentValue);

                // Add new option with real theme ID
                const newOption = document.createElement('option');
                newOption.value = newTheme.id;
                newOption.textContent = newTheme.name;
                newOption.selected = true;
                selector.appendChild(newOption);
            } else if (currentValue === 'default') {
                // Default theme becomes a real theme, update the option
                const defaultOption = selector.querySelector('option[value="default"]');
                if (defaultOption) {
                    defaultOption.value = newTheme.id;
                    defaultOption.textContent = newTheme.name;
                }
            }

            // Add to available themes
            window._themeEditor.availableThemes.push(newTheme);

            // Update selector value
            selector.value = newTheme.id;
        }

        // Generate variant under the theme
        if (window.showNotification) {
            window.showNotification('Generating variant...', 'info');
        }

        const variant = await generateVariant(targetThemeId, prompt);
        console.log('[Variant] Generated variant data:', variant);

        // Clear the prompt textarea
        if (promptTextarea) {
            promptTextarea.value = '';
        }

        // Reload the theme to get updated variants
        const response = await fetch(`${API_BASE}/themes/${targetThemeId}`, {
            headers: window.AuthModule.getAuthHeaders()
        });
        const data = await response.json();

        if (data.success) {
            window._themeEditor.currentTheme = data.data;
            updateVariantsDisplay(data.data.variants || []);
        }

        if (window.showNotification) {
            window.showNotification('Variant generated successfully!', 'success');
        }
    } catch (error) {
        console.error('Error generating variant:', error);
        if (window.showNotification) {
            window.showNotification('Failed to generate variant: ' + error.message, 'error');
        }
    } finally {
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<i class="fas fa-sparkles"></i> Generate Variant';
        }
    }
}

// 导出函数供HTML调用
window.renderCharacterThemes = renderCharacterThemes;
window.loadCharacterThemes = loadCharacterThemes;
window.showEditStep1_SelectCharacter = showEditStep1_SelectCharacter;
window.selectCharacterForEdit = selectCharacterForEdit;
window.showEditStep2_SelectTheme = showEditStep2_SelectTheme;
window.showCreateThemeDialog = showCreateThemeDialog;
window.deleteThemeWithConfirm = deleteThemeWithConfirm;
window.selectThemeForEdit = selectThemeForEdit;
window.showEditStep3_GenerateVariants = showEditStep3_GenerateVariants;
window.addToVariantPrompt = addToVariantPrompt;
window.generateVariantImage = generateVariantImage;
window.deleteVariantWithConfirm = deleteVariantWithConfirm;
window.renameTheme = renameTheme;
window.showGenerateVariantsPage = showGenerateVariantsPage;
window.onThemeChange = onThemeChange;
window.updateVariantsDisplay = updateVariantsDisplay;
window.generateVariantWithTheme = generateVariantWithTheme;
window.createNewThemeInUI = createNewThemeInUI;
