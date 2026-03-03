const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../core/auth');

const router = express.Router();

// Middleware to check admin role
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Get all users
router.get('/users', authenticateToken, requireAdmin, (req, res) => {
  try {
    const users = db.prepare(`
      SELECT id, name, email, role, createdAt,
        (SELECT COUNT(*) FROM conversations WHERE userId = users.id) as conversationCount
      FROM users
      ORDER BY createdAt DESC
    `).all();

    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's conversations
router.get('/users/:id/conversations', authenticateToken, requireAdmin, (req, res) => {
  try {
    const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(req.params.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const conversations = db.prepare(`
      SELECT * FROM conversations WHERE userId = ? ORDER BY createdAt DESC
    `).all(req.params.id);

    res.json({ user, conversations });
  } catch (error) {
    console.error('Get user conversations error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get conversation messages
router.get('/conversations/:id/messages', authenticateToken, requireAdmin, (req, res) => {
  try {
    const conversation = db.prepare(`
      SELECT c.*, u.name as userName, u.email as userEmail
      FROM conversations c
      JOIN users u ON c.userId = u.id
      WHERE c.id = ?
    `).get(req.params.id);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const messages = db.prepare(`
      SELECT * FROM messages WHERE conversationId = ? ORDER BY createdAt ASC
    `).all(req.params.id);

    res.json({ conversation, messages });
  } catch (error) {
    console.error('Get conversation messages error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Search messages
router.get('/search', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ error: 'Search query too short' });
    }

    const messages = db.prepare(`
      SELECT m.*, c.title as conversationTitle, u.name as userName, u.email as userEmail
      FROM messages m
      JOIN conversations c ON m.conversationId = c.id
      JOIN users u ON c.userId = u.id
      WHERE m.content LIKE ?
      ORDER BY m.createdAt DESC
      LIMIT 50
    `).all(`%${q}%`);

    res.json({ messages });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
