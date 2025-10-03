/**
 * Button Credits Display Helper
 * Adds credit cost information to buttons
 */

(function() {
    'use strict';

    /**
     * Update button text to show credit cost
     * @param {string} buttonId - The ID of the button element
     * @param {string} baseText - The base button text (e.g., "Generate")
     * @param {string} apiEndpoint - The API endpoint path (e.g., "/characters/generate-image")
     */
    function updateButtonWithCost(buttonId, baseText, apiEndpoint) {
        const button = document.getElementById(buttonId);
        if (!button || !window.CreditsModule) {
            return;
        }

        const cost = window.CreditsModule.getCostFor(apiEndpoint);
        if (cost > 0) {
            // Extract just the icon if present
            const iconMatch = button.innerHTML.match(/<i[^>]*><\/i>/);
            const icon = iconMatch ? iconMatch[0] + ' ' : '';

            button.innerHTML = `${icon}${baseText} (${cost} credits)`;
        } else {
            button.textContent = baseText;
        }
    }

    /**
     * Initialize all buttons with credit costs
     */
    function initializeButtonCosts() {
        // Wait for costs to be loaded
        if (!window.CreditsModule) {
            console.warn('[ButtonCredits] CreditsModule not available');
            return;
        }

        // Update all cost buttons
        const buttonConfigs = [
            { id: 'optimize-prompt-btn', baseText: 'Optimize Prompt', endpoint: '/characters/optimize-prompt' },
            { id: 'generate-image-btn', baseText: 'Generate Image', endpoint: '/characters/generate-image' },
            { id: 'generate-edited-image-btn', baseText: 'Generate Image', endpoint: '/characters/generate-image' },
            { id: 'generate-variant-btn', baseText: 'Generate Variant', endpoint: '/themes/variants/generate' }
        ];

        buttonConfigs.forEach(config => {
            updateButtonWithCost(config.id, config.baseText, config.endpoint);
        });

        console.log('[ButtonCredits] Initialized button costs');
    }

    // Export functions
    window.ButtonCredits = {
        updateButtonWithCost,
        initializeButtonCosts
    };

    console.log('[ButtonCredits] Module loaded');
})();
