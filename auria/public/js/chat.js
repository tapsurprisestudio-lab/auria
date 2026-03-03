// AURIA - Chat Application

let currentConversationId = null;
let conversations = [];
let isTyping = false;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  const user = await AURIA.auth.requireAuth();
  if (!user) return;
  
  loadConversations();
  setupEventListeners();
  
  // Check for conversation ID in URL
  const urlParams = new URLSearchParams(window.location.search);
  const conversationId = urlParams.get('conversation');
  if (conversationId) {
    loadConversation(conversationId);
  }
});

function setupEventListeners() {
  // Menu toggle
  document.getElementById('menuToggle').addEventListener('click', toggleSidebar);
  document.getElementById('closeSidebar').addEventListener('click', toggleSidebar);
  document.getElementById('sidebarOverlay').addEventListener('click', toggleSidebar);
  
  // New chat
  document.getElementById('newChatBtn').addEventListener('click', newChat);
  
  // Delete chat
  document.getElementById('deleteChatBtn').addEventListener('click', deleteCurrentChat);
  
  // Logout
  document.getElementById('logoutBtn').addEventListener('click', logout);
  
  // Chat form
  document.getElementById('chatForm').addEventListener('submit', handleSubmit);
  
  // Auto-resize textarea
  const messageInput = document.getElementById('messageInput');
  messageInput.addEventListener('input', autoResizeTextarea);
  
  // Enter to send (but Shift+Enter for new line)
  messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  });
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  
  sidebar.classList.toggle('open');
  overlay.classList.toggle('active');
}

function autoResizeTextarea() {
  const textarea = document.getElementById('messageInput');
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
}

// Load conversations list
async function loadConversations() {
  try {
    const data = await AURIA.api('/api/chat/conversations');
    conversations = data.conversations;
    renderConversationsList();
  } catch (error) {
    console.error('Failed to load conversations:', error);
  }
}

function renderConversationsList() {
  const container = document.getElementById('conversationsList');
  
  if (conversations.length === 0) {
    container.innerHTML = `
      <div class="empty-conversations">
        <p>No conversations yet</p>
      </div>
    `;
    return;
  }
  
  container.innerHTML = conversations.map(conv => `
    <div class="conversation-item ${conv.id === currentConversationId ? 'active' : ''}" 
         data-id="${conv.id}">
      <span class="conversation-title">${AURIA.utils.escapeHtml(conv.title)}</span>
      <span class="conversation-date">${AURIA.utils.formatDate(conv.createdAt)}</span>
      <button class="conversation-delete btn btn-icon btn-ghost" data-id="${conv.id}" title="Delete">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
  `).join('');
  
  // Add click handlers
  container.querySelectorAll('.conversation-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (!e.target.closest('.conversation-delete')) {
        loadConversation(item.dataset.id);
        // Close sidebar on mobile
        if (window.innerWidth <= 768) {
          toggleSidebar();
        }
      }
    });
  });
  
  container.querySelectorAll('.conversation-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const confirmed = await AURIA.ui.confirmDelete(
        'Delete Chat',
        'Are you sure you want to delete this conversation? This cannot be undone.'
      );
      if (confirmed) {
        await deleteConversation(btn.dataset.id);
      }
    });
  });
}

// New chat
async function newChat() {
  currentConversationId = null;
  
  // Clear messages
  document.getElementById('messagesContainer').innerHTML = '';
  document.getElementById('welcomeMessage').classList.remove('hidden');
  document.getElementById('chatMessages').scrollTop = 0;
  
  // Clear input
  document.getElementById('messageInput').value = '';
  document.getElementById('messageInput').focus();
  
  // Update active state
  document.querySelectorAll('.conversation-item').forEach(item => {
    item.classList.remove('active');
  });
  
  // Close sidebar on mobile
  if (window.innerWidth <= 768) {
    toggleSidebar();
  }
}

// Load specific conversation
async function loadConversation(id) {
  try {
    const data = await AURIA.api(`/api/chat/conversations/${id}`);
    currentConversationId = id;
    
    // Hide welcome message
    document.getElementById('welcomeMessage').classList.add('hidden');
    
    // Render messages
    renderMessages(data.messages);
    
    // Update active state
    document.querySelectorAll('.conversation-item').forEach(item => {
      item.classList.toggle('active', item.dataset.id === id);
    });
    
    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
      toggleSidebar();
    }
    
    // Update URL
    window.history.replaceState({}, '', `/chat?conversation=${id}`);
  } catch (error) {
    AURIA.ui.showToast('Failed to load conversation', 'error');
    console.error(error);
  }
}

function renderMessages(messages) {
  const container = document.getElementById('messagesContainer');
  
  container.innerHTML = messages.map(msg => createMessageHTML(msg)).join('');
  
  // Scroll to bottom
  scrollToBottom();
}

function createMessageHTML(msg) {
  const isUser = msg.role === 'user';
  const avatar = isUser ? 'U' : '✦';
  const time = AURIA.utils.formatDate(msg.createdAt);
  
  return `
    <div class="message ${msg.role}">
      <div class="message-avatar">${avatar}</div>
      <div class="message-content">
        <div class="message-text">${AURIA.utils.escapeHtml(msg.content)}</div>
        <div class="message-time">${time}</div>
      </div>
    </div>
  `;
}

// Send message
async function handleSubmit(e) {
  e.preventDefault();
  
  if (isTyping) return;
  
  const input = document.getElementById('messageInput');
  const message = input.value.trim();
  
  if (!message) return;
  
  // Clear input
  input.value = '';
  input.style.height = 'auto';
  
  // Hide welcome message if first message
  if (!currentConversationId) {
    document.getElementById('welcomeMessage').classList.add('hidden');
  }
  
  // Add user message to UI immediately
  addMessage('user', message);
  
  // Show typing indicator
  showTyping();
  
  try {
    const data = await AURIA.api('/api/chat/send', {
      method: 'POST',
      body: {
        conversationId: currentConversationId,
        message: message
      }
    });
    
    // Hide typing indicator
    hideTyping();
    
    // Add AURIA response
    addMessage('auria', data.response);
    
    // Update current conversation ID
    currentConversationId = data.conversationId;
    
    // Reload conversations list
    await loadConversations();
    
    // Update URL
    window.history.replaceState({}, '', `/chat?conversation=${data.conversationId}`);
    
  } catch (error) {
    hideTyping();
    AURIA.ui.showToast(error.message || 'Failed to send message', 'error');
  }
}

function addMessage(role, content) {
  const container = document.getElementById('messagesContainer');
  const now = new Date().toISOString();
  
  const html = createMessageHTML({
    role: role,
    content: content,
    createdAt: now
  });
  
  container.insertAdjacentHTML('beforeend', html);
  scrollToBottom();
}

function showTyping() {
  isTyping = true;
  document.getElementById('typingIndicator').style.display = 'flex';
  document.getElementById('sendBtn').disabled = true;
  scrollToBottom();
}

function hideTyping() {
  isTyping = false;
  document.getElementById('typingIndicator').style.display = 'none';
  document.getElementById('sendBtn').disabled = false;
}

function scrollToBottom() {
  const messages = document.getElementById('chatMessages');
  messages.scrollTop = messages.scrollHeight;
}

// Delete current chat
async function deleteCurrentChat() {
  if (!currentConversationId) {
    AURIA.ui.showToast('No chat selected', 'error');
    return;
  }
  
  const confirmed = await AURIA.ui.confirmDelete(
    'Delete Chat',
    'Are you sure you want to delete this conversation? This cannot be undone.'
  );
  
  if (confirmed) {
    await deleteConversation(currentConversationId);
  }
}

// Delete conversation by ID
async function deleteConversation(id) {
  try {
    await AURIA.api(`/api/chat/conversations/${id}`, { method: 'DELETE' });
    
    // Remove from local list
    conversations = conversations.filter(c => c.id != id);
    
    // If deleted current, start new chat
    if (currentConversationId == id) {
      newChat();
      window.history.replaceState({}, '', '/chat');
    }
    
    // Re-render list
    renderConversationsList();
    
    AURIA.ui.showToast('Chat deleted', 'success');
  } catch (error) {
    AURIA.ui.showToast('Failed to delete chat', 'error');
  }
}

// Logout
async function logout() {
  try {
    await AURIA.api('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  } catch (error) {
    // Even if API fails, redirect
    window.location.href = '/';
  }
}
