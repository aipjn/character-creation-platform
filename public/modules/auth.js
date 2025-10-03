/**
 * Frontend Auth Module
 * Handles authentication, login, register, and token management
 */

class AuthModule {
  constructor() {
    this.token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    this.user = null;

    // Load user from storage if token exists
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        this.user = JSON.parse(storedUser);
      } catch (e) {
        console.error('Failed to parse stored user:', e);
      }
    }
  }

  /**
   * Login with email and password
   */
  async login(email, password, remember = false) {
    try {
      const response = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'Login failed');
      }

      const { user, token } = result.data;

      console.log('Login success, received:', { user, token: token ? 'exists' : 'missing' });

      // Store token
      if (remember) {
        localStorage.setItem('auth_token', token);
        localStorage.setItem('user', JSON.stringify(user));
        console.log('[AUTH] Token saved to localStorage');
        console.log('[AUTH] Verify saved - localStorage.auth_token:', localStorage.getItem('auth_token') ? 'EXISTS' : 'NULL');
      } else {
        sessionStorage.setItem('auth_token', token);
        sessionStorage.setItem('user', JSON.stringify(user));
        console.log('[AUTH] Token saved to sessionStorage');
        console.log('[AUTH] Verify saved - sessionStorage.auth_token:', sessionStorage.getItem('auth_token') ? 'EXISTS' : 'NULL');
      }

      this.token = token;
      this.user = user;

      console.log('After setting, this.token:', !!this.token, 'this.user:', !!this.user);

      // Trigger login event
      window.dispatchEvent(new CustomEvent('auth:login', { detail: user }));

      return { success: true, user };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Register new user
   */
  async register(email, password, name) {
    try {
      const response = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error?.message || 'Registration failed');
      }

      // Registration successful - user needs to verify email
      // Don't auto-login, redirect to verification page instead
      window.dispatchEvent(new CustomEvent('auth:register', {
        detail: { email, needsVerification: true }
      }));

      return { success: true, email, needsVerification: true };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Logout user
   */
  async logout() {
    try {
      if (this.token) {
        await fetch('/api/v1/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.token}`,
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear local state
      this.clearAuth();

      // Trigger logout event
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
  }

  /**
   * Get current user info
   */
  async getCurrentUser() {
    if (!this.token) {
      return null;
    }

    try {
      const response = await fetch('/api/v1/auth/me', {
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });

      const result = await response.json();

      if (!result.success) {
        this.clearAuth();
        return null;
      }

      this.user = result.data.user;

      // Update storage
      if (localStorage.getItem('auth_token')) {
        localStorage.setItem('user', JSON.stringify(this.user));
      } else {
        sessionStorage.setItem('user', JSON.stringify(this.user));
      }

      return this.user;
    } catch (error) {
      console.error('Get current user error:', error);
      this.clearAuth();
      return null;
    }
  }

  /**
   * Verify token
   */
  async verifyToken() {
    if (!this.token) {
      return false;
    }

    try {
      const response = await fetch('/api/v1/auth/verify', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (!result.success) {
        this.clearAuth();
        return false;
      }

      this.user = result.data.user;
      return true;
    } catch (error) {
      console.error('Token verification error:', error);
      this.clearAuth();
      return false;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    console.log('isAuthenticated check:', { token: !!this.token, user: !!this.user, tokenValue: this.token, userValue: this.user });
    return !!this.token && !!this.user;
  }

  /**
   * Get token
   */
  getToken() {
    return this.token;
  }

  /**
   * Get auth headers for API requests
   */
  getAuthHeaders() {
    if (!this.token) {
      return {
        'Content-Type': 'application/json',
      };
    }

    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Clear auth data
   */
  clearAuth() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    sessionStorage.removeItem('auth_token');
    sessionStorage.removeItem('user');
  }

  /**
   * Redirect to login if not authenticated
   */
  requireAuth(redirectUrl = '/login.html') {
    if (!this.isAuthenticated()) {
      window.location.href = redirectUrl;
      return false;
    }
    return true;
  }

  /**
   * Show notification message
   */
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
      ${message}
    `;

    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#6366f1'};
      color: white;
      padding: 1rem 1.5rem;
      border-radius: 12px;
      box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
      z-index: 10000;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 500;
      animation: slideInFromRight 0.3s ease-out;
    `;

    // Add animation styles if not already present
    if (!document.getElementById('notification-styles')) {
      const style = document.createElement('style');
      style.id = 'notification-styles';
      style.textContent = `
        @keyframes slideInFromRight {
          from { opacity: 0; transform: translateX(100%); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideOutToRight {
          from { opacity: 1; transform: translateX(0); }
          to { opacity: 0; transform: translateX(100%); }
        }
      `;
      document.head.appendChild(style);
    }

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

  /**
   * Initialize login page
   */
  initLoginPage() {
    const loginForm = document.getElementById('login-form');
    const loginBtn = document.getElementById('login-btn');
    const loginText = document.getElementById('login-text');
    const loginLoading = document.getElementById('login-loading');

    if (!loginForm) return;

    // Check if already logged in (but don't redirect if we just came from app.html)
    const fromApp = document.referrer.includes('/app.html');
    if (this.token && !fromApp) {
      this.verifyToken().then(valid => {
        if (valid) {
          window.location.href = '/app.html';
        }
      });
    }

    // Form validation
    const validateForm = () => {
      const email = document.getElementById('email');
      const password = document.getElementById('password');

      document.querySelectorAll('.form-group').forEach(group => {
        group.classList.remove('error');
      });

      if (!email.value.trim()) {
        email.parentElement.classList.add('error');
        return false;
      }

      if (!password.value.trim()) {
        password.parentElement.classList.add('error');
        return false;
      }

      return true;
    };

    // Handle form submission
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!validateForm()) return;

      loginBtn.disabled = true;
      loginText.style.display = 'none';
      loginLoading.style.display = 'inline-block';

      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const remember = document.getElementById('remember').checked;

      const result = await this.login(email, password, remember);

      if (result.success) {
        this.showNotification('Login successful!', 'success');
        setTimeout(() => {
          window.location.href = '/app.html';
        }, 500);
      } else {
        this.showNotification(result.error || 'Login failed', 'error');
        loginBtn.disabled = false;
        loginText.style.display = 'inline';
        loginLoading.style.display = 'none';
      }
    });
  }

  /**
   * Initialize register page
   */
  initRegisterPage() {
    const registerForm = document.getElementById('register-form');
    const registerBtn = document.getElementById('register-btn');
    const registerText = document.getElementById('register-text');
    const registerLoading = document.getElementById('register-loading');

    if (!registerForm) return;

    // Password strength checker
    const checkPasswordStrength = (password) => {
      const strengthBar = document.querySelector('.password-strength');
      const strengthText = document.getElementById('strength-text');

      if (!password) {
        strengthBar.className = 'password-strength';
        strengthText.textContent = 'Enter password';
        return 0;
      }

      let score = 0;
      let feedback = [];

      if (password.length >= 8) score += 1;
      else feedback.push('At least 8 characters');

      if (/[a-z]/.test(password)) score += 1;
      else feedback.push('Contains lowercase');

      if (/[A-Z]/.test(password)) score += 1;
      else feedback.push('Contains uppercase');

      if (/\d/.test(password)) score += 1;
      else feedback.push('Contains numbers');

      if (/[^A-Za-z0-9]/.test(password)) score += 1;
      else feedback.push('Contains special characters');

      if (score <= 2) {
        strengthBar.className = 'password-strength strength-weak';
        strengthText.textContent = `Weak - ${feedback.slice(0, 2).join(', ')}`;
      } else if (score <= 3) {
        strengthBar.className = 'password-strength strength-medium';
        strengthText.textContent = `Medium - ${feedback.slice(0, 1).join(', ')}`;
      } else {
        strengthBar.className = 'password-strength strength-strong';
        strengthText.textContent = 'Strong';
      }

      return score;
    };

    // Real-time validation
    document.getElementById('email')?.addEventListener('blur', function() {
      const email = this.value;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const formGroup = this.parentElement;

      formGroup.classList.remove('error', 'success');

      if (email && emailRegex.test(email)) {
        setTimeout(() => {
          formGroup.classList.add('success');
        }, 500);
      } else if (email) {
        formGroup.classList.add('error');
      }
    });

    document.getElementById('password')?.addEventListener('input', function() {
      checkPasswordStrength(this.value);
    });

    document.getElementById('confirm-password')?.addEventListener('blur', function() {
      const password = document.getElementById('password').value;
      const confirmPassword = this.value;
      const formGroup = this.parentElement;

      formGroup.classList.remove('error', 'success');

      if (confirmPassword) {
        if (password === confirmPassword) {
          formGroup.classList.add('success');
        } else {
          formGroup.classList.add('error');
        }
      }
    });

    // Form validation
    const validateForm = () => {
      const email = document.getElementById('email');
      const password = document.getElementById('password');
      const confirmPassword = document.getElementById('confirm-password');
      const terms = document.getElementById('terms');

      document.querySelectorAll('.form-group').forEach(group => {
        group.classList.remove('error');
      });

      let isValid = true;

      if (!email.value.trim()) {
        email.parentElement.classList.add('error');
        isValid = false;
      }

      if (!password.value.trim()) {
        password.parentElement.classList.add('error');
        isValid = false;
      }

      if (password.value !== confirmPassword.value) {
        confirmPassword.parentElement.classList.add('error');
        isValid = false;
      }

      if (!terms.checked) {
        this.showNotification('Please accept the Terms of Service', 'error');
        isValid = false;
      }

      return isValid;
    };

    // Handle form submission
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!validateForm()) return;

      registerBtn.disabled = true;
      registerText.style.display = 'none';
      registerLoading.style.display = 'inline-block';

      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const name = email.split('@')[0]; // Use email prefix as name

      const result = await this.register(email, password, name);

      if (result.success) {
        this.showNotification('Registration successful! Please check your email to verify your account.', 'success');
        setTimeout(() => {
          window.location.href = `/verify-email.html?email=${encodeURIComponent(email)}`;
        }, 1500);
      } else {
        this.showNotification(result.error || 'Registration failed', 'error');
        registerBtn.disabled = false;
        registerText.style.display = 'inline';
        registerLoading.style.display = 'none';
      }
    });
  }

  /**
   * Social login placeholder
   */
  socialLogin(provider) {
    this.showNotification(`${provider} login coming soon`, 'info');
  }
}

// Create and export global instance
window.AuthModule = new AuthModule();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthModule;
}
