/**
 * Frontend Credits Module
 * Handles credit balance, history, and display
 */

class CreditsModule {
  constructor() {
    this.balance = 0;
    this.totalEarned = 0;
    this.totalSpent = 0;
    this.lastTransaction = null;
    this.listeners = [];
    this.pollingInterval = null;
  }

  /**
   * Get credit balance
   */
  async getBalance() {
    const token = window.AuthModule?.getToken();
    if (!token) {
      console.warn('No auth token available');
      return null;
    }

    try {
      const response = await fetch('/api/v1/credits', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to get credits');
      }

      const data = result.data;
      this.balance = data.balance;
      this.totalEarned = data.totalEarned;
      this.totalSpent = data.totalSpent;
      this.lastTransaction = data.lastTransaction;

      // Notify listeners
      this.notifyListeners(data);

      return data;
    } catch (error) {
      console.error('Get balance error:', error);
      return null;
    }
  }

  /**
   * Get credit history
   */
  async getHistory(page = 1, limit = 20) {
    const token = window.AuthModule?.getToken();
    if (!token) {
      console.warn('No auth token available');
      return null;
    }

    try {
      const response = await fetch(
        `/api/v1/credits/history?page=${page}&limit=${limit}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to get history');
      }

      return result.data;
    } catch (error) {
      console.error('Get history error:', error);
      return null;
    }
  }

  /**
   * Start polling for credit updates
   */
  startPolling(interval = 30000) {
    // Stop existing polling
    this.stopPolling();

    // Immediate fetch
    this.getBalance();

    // Set up interval
    this.pollingInterval = setInterval(() => {
      this.getBalance();
    }, interval);

    console.log(`Credits polling started (interval: ${interval}ms)`);
  }

  /**
   * Stop polling
   */
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      console.log('Credits polling stopped');
    }
  }

  /**
   * Add balance change listener
   */
  onBalanceChange(callback) {
    this.listeners.push(callback);

    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  /**
   * Notify all listeners of balance change
   */
  notifyListeners(data) {
    this.listeners.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error('Listener callback error:', error);
      }
    });
  }

  /**
   * Show insufficient credits error
   */
  showInsufficientCreditsError(required, available) {
    const message = `Insufficient credits! Required: ${required}, Available: ${available}`;

    // Use built-in notification system if available
    if (typeof showNotification === 'function') {
      showNotification(message, 'error');
    } else {
      alert(message);
    }
  }

  /**
   * Update credit display in UI
   */
  updateDisplay(selector = '.credits-display') {
    const elements = document.querySelectorAll(selector);

    elements.forEach((element) => {
      element.textContent = this.balance.toString();

      // Add visual feedback if balance is low
      if (this.balance < 10) {
        element.classList.add('low-credits');
      } else {
        element.classList.remove('low-credits');
      }
    });
  }

  /**
   * Create credit display widget
   */
  createWidget(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
      console.error(`Container #${containerId} not found`);
      return;
    }

    const widget = document.createElement('div');
    widget.className = 'credits-widget';
    widget.innerHTML = `
      <div class="credits-widget-header">
        <i class="fas fa-coins"></i>
        <span>Credits</span>
      </div>
      <div class="credits-widget-balance">
        <span class="balance-amount">${this.balance}</span>
        <span class="balance-label">Available</span>
      </div>
      <div class="credits-widget-stats">
        <div class="stat">
          <span class="stat-label">Earned</span>
          <span class="stat-value">${this.totalEarned}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Spent</span>
          <span class="stat-value">${this.totalSpent}</span>
        </div>
      </div>
      <button class="credits-widget-button" onclick="window.CreditsModule.showHistory()">
        View History
      </button>
    `;

    container.appendChild(widget);

    // Listen for balance changes
    this.onBalanceChange((data) => {
      widget.querySelector('.balance-amount').textContent = data.balance;
      widget.querySelector('.stat-value:nth-of-type(1)').textContent = data.totalEarned;
      widget.querySelector('.stat-value:nth-of-type(2)').textContent = data.totalSpent;
    });
  }

  /**
   * Show credit history modal
   */
  async showHistory() {
    const history = await this.getHistory();

    if (!history) {
      alert('Failed to load credit history');
      return;
    }

    // Create modal (basic implementation, can be enhanced)
    const modal = document.createElement('div');
    modal.className = 'credits-history-modal';
    modal.innerHTML = `
      <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
      <div class="modal-content">
        <div class="modal-header">
          <h2>Credit History</h2>
          <button class="modal-close" onclick="this.closest('.credits-history-modal').remove()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body">
          <table class="history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              ${history.items
                .map(
                  (item) => `
                <tr>
                  <td>${new Date(item.createdAt).toLocaleString()}</td>
                  <td><span class="type-badge ${item.type.toLowerCase()}">${item.type}</span></td>
                  <td class="${item.amount > 0 ? 'positive' : 'negative'}">${item.amount > 0 ? '+' : ''}${item.amount}</td>
                  <td>${item.reason || '-'}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  }
}

// Create and export global instance
window.CreditsModule = new CreditsModule();

// Listen to auth events
window.addEventListener('auth:login', () => {
  console.log('User logged in, starting credits polling');
  window.CreditsModule.startPolling();
});

window.addEventListener('auth:logout', () => {
  console.log('User logged out, stopping credits polling');
  window.CreditsModule.stopPolling();
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CreditsModule;
}
