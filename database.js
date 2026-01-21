const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class Database {
  constructor() {
    this.db = null;
    this.init();
  }

  init() {
    // Create database file in the project directory
    const dbPath = path.join(__dirname, 'chatbot.db');
    
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err.message);
      } else {
        console.log('✅ Connected to SQLite database');
        this.createTables();
      }
    });
  }

  createTables() {
    // Create users table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_active DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create conversations table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        message TEXT NOT NULL,
        response TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES users (session_id)
      )
    `);

    // Create chat_messages table for detailed message tracking
    this.db.run(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES users (session_id)
      )
    `);

    console.log('✅ Database tables created/verified');
  }

  // Create or get user session
  async createOrGetUser(sessionId) {
    return new Promise((resolve, reject) => {
      // First, try to get existing user
      this.db.get(
        'SELECT * FROM users WHERE session_id = ?',
        [sessionId],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }

          if (row) {
            // Update last active time
            this.db.run(
              'UPDATE users SET last_active = CURRENT_TIMESTAMP WHERE session_id = ?',
              [sessionId]
            );
            resolve(row);
          } else {
            // Create new user
            this.db.run(
              'INSERT INTO users (session_id) VALUES (?)',
              [sessionId],
              function(err) {
                if (err) {
                  reject(err);
                } else {
                  resolve({ id: this.lastID, session_id: sessionId });
                }
              }
            );
          }
        }
      );
    });
  }

  // Save conversation
  async saveConversation(sessionId, userMessage, botResponse) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO conversations (session_id, message, response) VALUES (?, ?, ?)',
        [sessionId, userMessage, botResponse],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID });
          }
        }
      );
    });
  }

  // Save individual chat message
  async saveChatMessage(sessionId, role, content) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)',
        [sessionId, role, content],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID });
          }
        }
      );
    });
  }

  // Get conversation history for a session
  async getConversationHistory(sessionId, limit = 20) {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT role, content, timestamp 
         FROM chat_messages 
         WHERE session_id = ? 
         ORDER BY timestamp ASC 
         LIMIT ?`,
        [sessionId, limit],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows || []);
          }
        }
      );
    });
  }

  // Get all conversations for a session
  async getSessionConversations(sessionId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM conversations WHERE session_id = ? ORDER BY timestamp ASC',
        [sessionId],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows || []);
          }
        }
      );
    });
  }

  // Clear conversation history for a session
  async clearSessionHistory(sessionId) {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        this.db.run('DELETE FROM chat_messages WHERE session_id = ?', [sessionId]);
        this.db.run('DELETE FROM conversations WHERE session_id = ?', [sessionId], function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ deletedRows: this.changes });
          }
        });
      });
    });
  }

  // Get chat statistics
  async getChatStats() {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT 
          COUNT(DISTINCT session_id) as total_users,
          COUNT(*) as total_messages,
          COUNT(CASE WHEN role = 'user' THEN 1 END) as user_messages,
          COUNT(CASE WHEN role = 'assistant' THEN 1 END) as bot_responses
        FROM chat_messages
      `, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows[0] || {});
        }
      });
    });
  }

  // Close database connection
  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err.message);
        } else {
          console.log('Database connection closed');
        }
      });
    }
  }
}

module.exports = Database;