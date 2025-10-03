/**
 * Credits Module
 * Manages credit balance display and updates
 */

(function() {
    'use strict';

    const API_BASE = '/api/v1';
    let pollingInterval = null;
    let balanceChangeCallbacks = [];
    let currentBalance = 0;
    let apiCosts = {}; // Store API costs

    /**
     * Load API costs from server
     */
    async function loadCosts() {
        const costs = await getCosts();
        apiCosts = costs;
        return costs;
    }

    /**
     * Get cost for a specific API endpoint
     */
    function getCostFor(endpoint) {
        return apiCosts[endpoint] || 0;
    }

    /**
     * Get user's current credit balance
     */
    async function getBalance() {
        try {
            const response = await fetch(`${API_BASE}/credits`, {
                headers: window.AuthModule.getAuthHeaders()
            });

            if (response.status === 401) {
                console.warn('[Credits] Unauthorized - user may need to login');
                return null;
            }

            const data = await response.json();

            if (data.success) {
                currentBalance = data.data.balance;
                notifyBalanceChange(data.data);
                return data.data;
            } else {
                console.error('[Credits] Failed to get balance:', data.error);
                return null;
            }
        } catch (error) {
            console.error('[Credits] Error getting balance:', error);
            return null;
        }
    }

    /**
     * Register a callback for balance changes
     */
    function onBalanceChange(callback) {
        if (typeof callback === 'function') {
            balanceChangeCallbacks.push(callback);
        }
    }

    /**
     * Notify all registered callbacks of balance change
     */
    function notifyBalanceChange(data) {
        balanceChangeCallbacks.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error('[Credits] Error in balance change callback:', error);
            }
        });
    }

    /**
     * Start polling for credit updates
     */
    function startPolling(intervalMs = 30000) {
        if (pollingInterval) {
            clearInterval(pollingInterval);
        }

        // Initial fetch
        getBalance();

        // Poll periodically
        pollingInterval = setInterval(() => {
            getBalance();
        }, intervalMs);

        console.log(`[Credits] Started polling every ${intervalMs}ms`);
    }

    /**
     * Stop polling for credit updates
     */
    function stopPolling() {
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
            console.log('[Credits] Stopped polling');
        }
    }

    /**
     * Update balance display after credit deduction
     */
    function handleCreditDeduction(creditInfo) {
        if (creditInfo && creditInfo.newBalance !== undefined) {
            currentBalance = creditInfo.newBalance;
            notifyBalanceChange({ balance: creditInfo.newBalance });
            // Credit cost is now shown on buttons, no need for notification
        }
    }

    /**
     * Handle insufficient credits error (402)
     */
    function handleInsufficientCredits(errorData) {
        const message = errorData?.error?.message || 'Insufficient credits';
        const required = errorData?.error?.required || '?';
        const balance = errorData?.error?.balance || 0;

        if (window.showNotification) {
            window.showNotification(
                `${message}. You need ${required} credits but only have ${balance}.`,
                'error'
            );
        }

        // Update balance display
        if (balance !== undefined) {
            currentBalance = balance;
            notifyBalanceChange({ balance });
        }
    }

    /**
     * Get current balance (cached)
     */
    function getCurrentBalance() {
        return currentBalance;
    }

    /**
     * Get API cost configuration
     */
    async function getCosts() {
        try {
            const response = await fetch(`${API_BASE}/credits/costs`, {
                headers: window.AuthModule.getAuthHeaders()
            });

            if (!response.ok) {
                console.warn('[Credits] Failed to get costs');
                return {};
            }

            const data = await response.json();

            if (data.success) {
                return data.data.costs || {};
            } else {
                console.error('[Credits] Failed to get costs:', data.error);
                return {};
            }
        } catch (error) {
            console.error('[Credits] Error getting costs:', error);
            return {};
        }
    }

    // Export module
    window.CreditsModule = {
        getBalance,
        onBalanceChange,
        startPolling,
        stopPolling,
        handleCreditDeduction,
        handleInsufficientCredits,
        getCurrentBalance,
        getCosts,
        loadCosts,
        getCostFor
    };

    console.log('[Credits] Module loaded');
})();
