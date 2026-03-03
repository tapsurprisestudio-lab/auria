// AURIA - JavaScript Utilities

const API_BASE = '';

// Utility functions
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

function formatFullDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// API helpers
async function apiRequest(endpoint, options = {}) {
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    credentials: 'include',
    ...options
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, config);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

// Auth helpers
async function checkAuth() {
  try {
    const data = await apiRequest('/api/auth/me');
    return data.user;
  } catch (error) {
    return null;
  }
}

async function requireAuth() {
  const user = await checkAuth();
  if (!user) {
    window.location.href = '/login';
    return null;
  }
  return user;
}

// Toast notifications
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Modal helpers
function showModal(title, content, buttons = []) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h3 class="modal-title">${escapeHtml(title)}</h3>
      <div class="modal-content">${content}</div>
      <div class="modal-actions flex gap-md mt-lg">
        ${buttons.map(btn => `
          <button class="btn ${btn.class || 'btn-secondary'}" data-action="${btn.action}">
            ${btn.label}
          </button>
        `).join('')}
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(overlay);
  });
  
  setTimeout(() => overlay.classList.add('active'), 10);
  
  return overlay;
}

function closeModal(overlay) {
  overlay.classList.remove('active');
  setTimeout(() => overlay.remove(), 300);
}

// Confirm dialog
function confirmDelete(title, message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <h3 class="modal-title">${escapeHtml(title)}</h3>
        <p>${escapeHtml(message)}</p>
        <div class="modal-actions flex gap-md mt-lg">
          <button class="btn btn-secondary" data-action="cancel">Cancel</button>
          <button class="btn btn-danger" data-action="confirm">Delete</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add('active'), 10);
    
    const handleAction = (e) => {
      const action = e.target.dataset.action;
      overlay.classList.remove('active');
      setTimeout(() => overlay.remove(), 300);
      resolve(action === 'confirm');
    };
    
    overlay.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', handleAction);
    });
  });
}

// Loading state
function showLoading(element) {
  const loader = document.createElement('div');
  loader.className = 'spinner';
  loader.style.margin = '20px auto';
  element.innerHTML = '';
  element.appendChild(loader);
  return loader;
}

// Debounce
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Export utilities
window.AURIA = {
  api: apiRequest,
  auth: { checkAuth, requireAuth },
  ui: { showToast, showModal, confirmDelete, showLoading },
  utils: { escapeHtml, formatDate, formatFullDate, debounce }
};
