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
        const response = await fetch(`${API_BASE}/themes/character/${characterId}`);
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
            headers: {
                'Content-Type': 'application/json',
            },
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
            headers: {
                'Content-Type': 'application/json',
            },
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
            method: 'DELETE'
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
            method: 'DELETE'
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
        const response = await fetch(`${API_BASE}/characters`);
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
                        Click to manage themes
                    </p>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading characters:', error);
    }
}

/**
 * 选择角色进行编辑 → 进入步骤2
 */
async function selectCharacterForEdit(characterId) {
    try {
        const response = await fetch(`${API_BASE}/characters/${characterId}`);
        const data = await response.json();

        if (data.success) {
            window._themeEditor.currentCharacter = data.data;
            await showEditStep2_SelectTheme(window._themeEditor.currentCharacter);
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
async function showEditStep2_SelectTheme(character) {
    const editPage = document.getElementById('edit-page');

    // Load themes
    const themes = await loadCharacterThemes(character.id);

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
        const response = await fetch(`${API_BASE}/themes/${themeId}`);
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
 * Edit页面 - 步骤3：生成变体
 */
async function showEditStep3_GenerateVariants(character, theme) {
    const editPage = document.getElementById('edit-page');

    editPage.innerHTML = `
        <div style="max-width: 1400px; margin: 0 auto;">
            <!-- Header -->
            <div style="margin-bottom: 2rem;">
                <button class="btn btn-secondary" onclick="showEditStep2_SelectTheme(window._themeEditor.currentCharacter)" style="margin-bottom: 1rem;">
                    <i class="fas fa-arrow-left"></i> Back to Themes
                </button>
                <h2 style="font-size: 1.8rem; font-weight: 700; margin-bottom: 0.5rem;">
                    ${character.name} - ${theme.name}
                </h2>
                <p style="color: var(--text-muted);">${theme.description || 'Generate variations for this theme'}</p>
            </div>

            <!-- Main layout: Generate panel + Variants gallery -->
            <div style="display: grid; grid-template-columns: 350px 1fr; gap: 2rem;">
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
                                ">
                                    <div style="width: 100%; height: 200px; background: var(--background);">
                                        ${variant.imageUrl ?
                                            `<img src="${variant.imageUrl}" alt="Variant" style="width: 100%; height: 100%; object-fit: cover;">` :
                                            `<div style="display: flex; align-items: center; justify-content: center; height: 100%;">
                                                <i class="fas fa-image" style="font-size: 2rem; color: var(--text-muted);"></i>
                                            </div>`
                                        }
                                    </div>
                                    <div style="padding: 0.75rem;">
                                        <p style="margin: 0 0 0.5rem 0; font-size: 13px; color: var(--text-secondary); line-height: 1.4;">
                                            ${variant.prompt.length > 60 ? variant.prompt.substring(0, 60) + '...' : variant.prompt}
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

        // Add to current theme variants
        if (!window._themeEditor.currentTheme.variants) {
            window._themeEditor.currentTheme.variants = [];
        }
        window._themeEditor.currentTheme.variants.unshift(variant);

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

        // Reload theme data
        const response = await fetch(`${API_BASE}/themes/${window._themeEditor.currentTheme.id}`);
        const data = await response.json();

        if (data.success) {
            window._themeEditor.currentTheme = data.data;
            await showEditStep3_GenerateVariants(window._themeEditor.currentCharacter, window._themeEditor.currentTheme);

            if (window.showNotification) {
                window.showNotification('Variant deleted successfully!', 'success');
            }
        }
    } catch (error) {
        if (window.showNotification) {
            window.showNotification('Failed to delete variant', 'error');
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
