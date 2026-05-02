const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'termuxlab_secret_2024_change_in_production';

// ── DATABASE SETUP ────────────────────────────────────────
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
const db = new Database(path.join(dataDir, 'termuxlab.db'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    lesson_id INTEGER NOT NULL,
    completed INTEGER DEFAULT 0,
    completed_at DATETIME,
    UNIQUE(user_id, lesson_id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    badge_id TEXT NOT NULL,
    earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, badge_id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

// ── MIDDLEWARE ────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Auth middleware
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token required' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ── AUTH ROUTES ───────────────────────────────────────────
app.post('/api/auth/register', (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password deve ter pelo menos 6 caracteres' });
  try {
    const hash = bcrypt.hashSync(password, 10);
    const stmt = db.prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)');
    const result = stmt.run(username, email, hash);
    const token = jwt.sign({ id: result.lastInsertRowid, username, email }, JWT_SECRET, { expiresIn: '30d' });
    // Award first badge
    db.prepare("INSERT OR IGNORE INTO badges (user_id, badge_id) VALUES (?, 'welcome')").run(result.lastInsertRowid);
    res.json({ token, user: { id: result.lastInsertRowid, username, email } });
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      if (e.message.includes('username')) return res.status(400).json({ error: 'Username já existe' });
      return res.status(400).json({ error: 'Email já registado' });
    }
    res.status(500).json({ error: 'Erro interno' });
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email e password obrigatórios' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: 'Credenciais inválidas' });
  const token = jwt.sign({ id: user.id, username: user.username, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
  const user = db.prepare('SELECT id, username, email, created_at FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

// ── PROGRESS ROUTES ───────────────────────────────────────
app.get('/api/progress', authMiddleware, (req, res) => {
  const progress = db.prepare('SELECT * FROM progress WHERE user_id = ?').all(req.user.id);
  res.json(progress);
});

app.post('/api/progress/complete', authMiddleware, (req, res) => {
  const { lesson_id } = req.body;
  db.prepare(`
    INSERT INTO progress (user_id, lesson_id, completed, completed_at)
    VALUES (?, ?, 1, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, lesson_id) DO UPDATE SET completed=1, completed_at=CURRENT_TIMESTAMP
  `).run(req.user.id, lesson_id);

  // Check for badges
  const completedCount = db.prepare('SELECT COUNT(*) as c FROM progress WHERE user_id = ? AND completed = 1').get(req.user.id).c;
  const badgeMap = { 1: 'first_lesson', 3: 'three_lessons', 6: 'module1_complete', 10: 'ten_lessons' };
  if (badgeMap[completedCount]) {
    db.prepare('INSERT OR IGNORE INTO badges (user_id, badge_id) VALUES (?, ?)').run(req.user.id, badgeMap[completedCount]);
  }
  res.json({ success: true, completed: completedCount });
});

// ── BADGES ROUTE ──────────────────────────────────────────
app.get('/api/badges', authMiddleware, (req, res) => {
  const badges = db.prepare('SELECT badge_id, earned_at FROM badges WHERE user_id = ?').all(req.user.id);
  res.json(badges);
});

// ── STATS ROUTE ───────────────────────────────────────────
app.get('/api/stats', authMiddleware, (req, res) => {
  const completed = db.prepare('SELECT COUNT(*) as c FROM progress WHERE user_id = ? AND completed=1').get(req.user.id).c;
  const badges = db.prepare('SELECT COUNT(*) as c FROM badges WHERE user_id = ?').get(req.user.id).c;
  const member_since = db.prepare('SELECT created_at FROM users WHERE id = ?').get(req.user.id).created_at;
  res.json({ completed_lessons: completed, badges_earned: badges, member_since });
});

// ── SERVE SPA ─────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`TermuxLab running on port ${PORT}`));
