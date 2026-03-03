const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../core/auth');
const { sendToGemini } = require('../core/gemini');

const router = express.Router();

// Get all conversations for user
router.get('/conversations', authenticateToken, (req, res) => {
  try {
    const conversations = db.prepare(`
      SELECT c.*, 
        (SELECT content FROM messages WHERE conversationId = c.id ORDER BY createdAt DESC LIMIT 1) as lastMessage
      FROM conversations c
      WHERE c.userId = ?
      ORDER BY c.createdAt DESC
    `).all(req.user.id);

    res.json({ conversations });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single conversation with messages
router.get('/conversations/:id', authenticateToken, (req, res) => {
  try {
    const conversation = db.prepare(`
      SELECT * FROM conversations WHERE id = ? AND userId = ?
    `).get(req.params.id, req.user.id);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const messages = db.prepare(`
      SELECT * FROM messages WHERE conversationId = ? ORDER BY createdAt ASC
    `).all(req.params.id);

    res.json({ conversation, messages });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ✅ FIXED: Create new conversation (added async)
router.post('/conversations', authenticateToken, async (req, res) => {
  try {
    const { title, firstMessage } = req.body;

    const result = db.prepare(`
      INSERT INTO conversations (userId, title)
      VALUES (?, ?)
    `).run(req.user.id, title || 'New Conversation');

    const conversationId = result.lastInsertRowid;

    if (firstMessage) {
      // Save user message
      db.prepare(`
        INSERT INTO messages (conversationId, userId, role, content)
        VALUES (?, ?, ?, ?)
      `).run(conversationId, req.user.id, 'user', firstMessage);

      const messages = [];

      // ✅ Now await works because function is async
      const aiResponse = await sendToGemini(messages, firstMessage);

      // Save AI response
      db.prepare(`
        INSERT INTO messages (conversationId, userId, role, content, languageCode)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        conversationId,
        req.user.id,
        'auria',
        aiResponse.response,
        aiResponse.languageCode
      );

      if (!title || title === 'New Conversation') {
        const titleFromMessage =
          firstMessage.length > 50
            ? firstMessage.substring(0, 50) + '...'
            : firstMessage;

        db.prepare('UPDATE conversations SET title = ? WHERE id = ?')
          .run(titleFromMessage, conversationId);
      }

      return res.json({
        conversationId,
        response: aiResponse.response
      });
    }

    res.json({ conversationId });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send message to AURIA
router.post('/chat/send', authenticateToken, async (req, res) => {
  try {
    let { conversationId, message } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message required' });
    }

    message = message.trim();
    let convId = conversationId;

    if (!convId) {
      const titleFromMessage =
        message.length > 50
          ? message.substring(0, 50) + '...'
          : message;

      const result = db.prepare(`
        INSERT INTO conversations (userId, title)
        VALUES (?, ?)
      `).run(req.user.id, titleFromMessage);

      convId = result.lastInsertRowid;
    }

    const conversation = db.prepare(`
      SELECT * FROM conversations WHERE id = ? AND userId = ?
    `).get(convId, req.user.id);

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    db.prepare(`
      INSERT INTO messages (conversationId, userId, role, content)
      VALUES (?, ?, ?, ?)
    `).run(convId, req.user.id, 'user', message);

    const messages = db.prepare(`
      SELECT role, content FROM messages WHERE conversationId = ? ORDER BY createdAt ASC
    `).all(convId);

    const aiResponse = await sendToGemini(messages, message);

    db.prepare(`
      INSERT INTO messages (conversationId, userId, role, content, languageCode)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      convId,
      req.user.id,
      'auria',
      aiResponse.response,
      aiResponse.languageCode
    );

    res.json({
      conversationId: convId,
      response: aiResponse.response,
      languageCode: aiResponse.languageCode
    });

  } catch (error) {
    console.error('Chat send error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete conversation
router.delete('/conversations/:id', authenticateToken, (req, res) => {
  try {
    const result = db.prepare(`
      DELETE FROM conversations WHERE id = ? AND userId = ?
    `).run(req.params.id, req.user.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    res.json({ success: true });

  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
