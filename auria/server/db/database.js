const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.join(__dirname, '..', 'data', 'auria.db');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    title TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversationId INTEGER NOT NULL,
    userId INTEGER NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'auria')),
    content TEXT NOT NULL,
    languageCode TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversationId) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_conversations_userId ON conversations(userId);
  CREATE INDEX IF NOT EXISTS idx_messages_conversationId ON messages(conversationId);
  CREATE INDEX IF NOT EXISTS idx_messages_userId ON messages(userId);
`);

// Seed admin user if not exists
const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get(process.env.ADMIN_EMAIL || 'admin@auria.app');

if (!adminExists) {
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const passwordHash = bcrypt.hashSync(adminPassword, 10);
  
  db.prepare(`
    INSERT INTO users (name, email, passwordHash, role)
    VALUES (?, ?, ?, ?)
  `).run('Admin', process.env.ADMIN_EMAIL || 'admin@auria.app', passwordHash, 'admin');
  
  console.log('Admin user created');
}

module.exports = db;
