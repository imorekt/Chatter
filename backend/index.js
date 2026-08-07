const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config();

// --- DATABASE SETUP ---
const db = createClient({
  url: process.env.TURSO_DATABASE_URL || 'file:database.sqlite',
  authToken: process.env.TURSO_AUTH_TOKEN
});

// --- HELPER FUNCTIONS ---
async function sendPushNotification(recipient, title, text) {
  if (process.env.ONESIGNAL_APP_ID && process.env.ONESIGNAL_REST_API_KEY) {
    try {
      await fetch('https://api.onesignal.com/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${process.env.ONESIGNAL_REST_API_KEY}`
        },
        body: JSON.stringify({
          app_id: process.env.ONESIGNAL_APP_ID,
          include_aliases: {
            external_id: [recipient]
          },
          target_channel: 'push',
          headings: { "en": title },
          contents: { "en": text }
        })
      });
    } catch (e) {
      console.error("Gagal mengirim push notification:", e);
    }
  }
}

async function initDb() {
  try {
    console.log('Connected to the Turso database.');
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS moments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        content TEXT NOT NULL,
        image_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        moment_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        UNIQUE(moment_id, username)
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        moment_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_username TEXT NOT NULL,
        receiver_username TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(sender_username, receiver_username)
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender TEXT NOT NULL,
        receiver TEXT NOT NULL,
        text TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    try { await db.execute(`ALTER TABLE messages ADD COLUMN is_read INTEGER DEFAULT 0`); } catch (e) {}
    try { await db.execute(`ALTER TABLE messages ADD COLUMN deleted_by_sender INTEGER DEFAULT 0`); } catch (e) {}
    try { await db.execute(`ALTER TABLE messages ADD COLUMN deleted_by_receiver INTEGER DEFAULT 0`); } catch (e) {}
    try { await db.execute(`ALTER TABLE messages ADD COLUMN is_edited INTEGER DEFAULT 0`); } catch (e) {}
    try { await db.execute(`ALTER TABLE messages ADD COLUMN is_deleted_everyone INTEGER DEFAULT 0`); } catch (e) {}
    await db.execute(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipient TEXT NOT NULL,
        sender TEXT NOT NULL,
        type TEXT NOT NULL,
        moment_id INTEGER NOT NULL,
        content TEXT,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await db.execute(`
      CREATE TABLE IF NOT EXISTS favorite_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        message_id INTEGER NOT NULL,
        UNIQUE(username, message_id)
      )
    `);
    try { await db.execute("ALTER TABLE users ADD COLUMN avatar TEXT"); } catch (e) {}
    try { await db.execute("ALTER TABLE users ADD COLUMN display_name TEXT"); } catch (e) {}
    try { await db.execute("ALTER TABLE users ADD COLUMN bio TEXT"); } catch (e) {}
    try { await db.execute("ALTER TABLE notifications ADD COLUMN is_clicked INTEGER DEFAULT 0"); } catch (e) {}
    try { await db.execute("ALTER TABLE users ADD COLUMN last_seen DATETIME"); } catch (e) {}
  } catch (err) {
    console.error('Error opening database:', err.message);
  }
}
initDb();

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// --- HELPER FUNCTIONS ---
const lastSeenMap = new Map();
async function updateLastSeen(username) {
  const now = Date.now();
  if (!lastSeenMap.has(username) || now - lastSeenMap.get(username) > 30000) { // Throttle DB writes to 30s
    lastSeenMap.set(username, now);
    try {
      await db.execute({ sql: `UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE username = ?`, args: [username] });
    } catch (e) {}
  }
}

// --- OTP LOGIC ---
const otpStore = new Map(); // Store OTPs in memory: { email: { otp: "123456", expires: Date.now() + 5mins } }

async function getTransporter() {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  } else {
    console.log("âš ï¸ EMAIL_USER & EMAIL_PASS tidak ada di .env. Menggunakan akun test Ethereal.");
    let testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }
}

app.post('/api/auth/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email diperlukan" });

  const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit
  const expires = Date.now() + 10 * 60 * 1000; // 10 menit

  otpStore.set(email, { otp, expires });

  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail({
      from: `"ChatApp Security" <${process.env.EMAIL_USER || 'no-reply@chatapp.com'}>`,
      to: email,
      subject: "Kode Verifikasi (OTP) Anda",
      html: `<h2>Halo!</h2><p>Kode verifikasi Anda adalah: <b>${otp}</b></p><p>Kode ini akan kadaluarsa dalam 10 menit.</p>`
    });
    
    console.log(`OTP untuk ${email}: ${otp}`);
    if (info.messageId && !process.env.EMAIL_USER) {
      console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
    }
    
    res.json({ success: true, message: "OTP berhasil dikirim" });
  } catch (error) {
    console.error("Gagal mengirim email:", error);
    res.status(500).json({ error: "Gagal mengirim email" });
  }
});

app.post('/api/auth/verify-otp', async (req, res) => {
  const { username, email, password, otp } = req.body;
  const record = otpStore.get(email);
  
  if (!record) return res.status(400).json({ error: "OTP tidak ditemukan atau sudah kadaluarsa" });
  if (Date.now() > record.expires) {
    otpStore.delete(email);
    return res.status(400).json({ error: "OTP sudah kadaluarsa" });
  }
  if (record.otp !== otp) {
    return res.status(400).json({ error: "OTP salah" });
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    await db.execute({
      sql: 'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      args: [username, email, hashedPassword]
    });
    
    otpStore.delete(email);
    res.json({ success: true, message: "Akun berhasil dibuat dan disimpan!" });
  } catch (error) {
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: "Username atau Email sudah terdaftar" });
    }
    res.status(500).json({ error: "Gagal menyimpan data akun" });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] });
    const user = result.rows[0];
    
    if (!user) return res.status(400).json({ error: "Email tidak ditemukan" });
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: "Kata sandi salah" });
    
    res.json({ success: true, username: user.username, message: "Login berhasil" });
  } catch (error) {
    res.status(500).json({ error: "Terjadi kesalahan database" });
  }
});

app.post('/api/auth/forgot-password-otp', async (req, res) => {
  const { email } = req.body;
  try {
    const result = await db.execute({ sql: 'SELECT * FROM users WHERE email = ?', args: [email] });
    const user = result.rows[0];
    if (!user) return res.status(400).json({ error: "Email tidak terdaftar di sistem" });
    
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 10 * 60 * 1000;
    otpStore.set(email, { otp, expires });
    
    const transporter = await getTransporter();
    await transporter.sendMail({
      from: `"ChatApp Security" <${process.env.EMAIL_USER || 'no-reply@chatapp.com'}>`,
      to: email,
      subject: "Pemulihan Kata Sandi",
      html: `<h2>Pemulihan Akun</h2><p>Kode OTP Anda adalah: <b>${otp}</b></p>`
    });
    res.json({ success: true, message: "OTP pemulihan dikirim" });
  } catch (error) {
    res.status(500).json({ error: "Gagal mengirim email OTP" });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const record = otpStore.get(email);
  
  if (!record || Date.now() > record.expires) return res.status(400).json({ error: "OTP tidak valid/kadaluarsa" });
  if (record.otp !== otp) return res.status(400).json({ error: "OTP salah" });
  
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    await db.execute({ sql: 'UPDATE users SET password = ? WHERE email = ?', args: [hashedPassword, email] });
    otpStore.delete(email);
    res.json({ success: true, message: "Kata sandi berhasil diubah" });
  } catch (error) {
    res.status(500).json({ error: "Terjadi kesalahan sistem" });
  }
});

app.delete('/api/users/:identifier', async (req, res) => {
  const { identifier } = req.params;
  const { keyword } = req.body;
  try {
    const result = await db.execute({ sql: 'SELECT * FROM users WHERE username = ? OR email = ?', args: [identifier, identifier] });
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
    if (!keyword || keyword.toLowerCase() !== 'setuju') return res.status(400).json({ error: 'Kata kunci konfirmasi salah' });
    
    const targetUsername = user.username;
    await db.execute({ sql: 'DELETE FROM moments WHERE username = ?', args: [targetUsername] });
    await db.execute({ sql: 'DELETE FROM comments WHERE username = ?', args: [targetUsername] });
    await db.execute({ sql: 'DELETE FROM likes WHERE username = ?', args: [targetUsername] });
    await db.execute({ sql: 'DELETE FROM contacts WHERE sender_username = ? OR receiver_username = ?', args: [targetUsername, targetUsername] });
    await db.execute({ sql: 'DELETE FROM notifications WHERE recipient = ? OR sender = ?', args: [targetUsername, targetUsername] });
    await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [user.id] });
    
    res.json({ success: true, message: 'Akun dan semua data terkait berhasil dihapus' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// --- MOMENTS API ---
app.get('/api/moments/latest/:username', async (req, res) => {
  try {
    const result = await db.execute({ sql: 'SELECT id as latest_id FROM moments WHERE username != ? ORDER BY id DESC LIMIT 1', args: [req.params.username] });
    res.json(result.rows[0] || { latest_id: 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/moments', async (req, res) => {
  try {
    const query = `
      SELECT m.*, u.avatar as user_avatar, u.display_name as user_display_name,
             (SELECT COUNT(*) FROM likes WHERE moment_id = m.id) as like_count,
             (SELECT GROUP_CONCAT(username) FROM likes WHERE moment_id = m.id) as liked_by
      FROM moments m
      LEFT JOIN users u ON m.username = u.username
      ORDER BY m.created_at DESC
    `;
    const result = await db.execute(query);
    const moments = result.rows;
    
    const commentsResult = await db.execute(`SELECT c.*, u.display_name as user_display_name FROM comments c LEFT JOIN users u ON c.username = u.username ORDER BY c.created_at ASC`);
    const allComments = commentsResult.rows;
    
    const formattedMoments = moments.map(m => {
      return {
        ...m,
        liked_by: m.liked_by ? m.liked_by.split(',') : [],
        comments: allComments.filter(c => c.moment_id === m.id)
      };
    });
    res.json(formattedMoments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/moments', async (req, res) => {
  const { username, content, image_url } = req.body;
  if (!username || !content) return res.status(400).json({ error: "Username dan konten wajib diisi" });
  
  try {
    const result = await db.execute({ sql: `INSERT INTO moments (username, content, image_url) VALUES (?, ?, ?)`, args: [username, content, image_url || null] });
    res.json({ success: true, id: result.lastInsertRowid.toString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/moments/:id', async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: "Konten wajib diisi" });
  
  try {
    await db.execute({ sql: `UPDATE moments SET content = ? WHERE id = ?`, args: [content, req.params.id] });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/moments/:id', async (req, res) => {
  const momentId = req.params.id;
  try {
    await db.execute({ sql: `DELETE FROM moments WHERE id = ?`, args: [momentId] });
    await db.execute({ sql: `DELETE FROM likes WHERE moment_id = ?`, args: [momentId] });
    await db.execute({ sql: `DELETE FROM comments WHERE moment_id = ?`, args: [momentId] });
    await db.execute({ sql: `DELETE FROM notifications WHERE moment_id = ?`, args: [momentId] });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/moments/like', async (req, res) => {
  const { moment_id, username } = req.body;
  
  try {
    const result = await db.execute({ sql: `SELECT id FROM likes WHERE moment_id = ? AND username = ?`, args: [moment_id, username] });
    const row = result.rows[0];
    
    if (row) {
      // Unlike
      await db.execute({ sql: `DELETE FROM likes WHERE id = ?`, args: [row.id] });
      const momentResult = await db.execute({ sql: 'SELECT username FROM moments WHERE id = ?', args: [moment_id] });
      const moment = momentResult.rows[0];
      if (moment && moment.username !== username) {
        await db.execute({ sql: `DELETE FROM notifications WHERE recipient = ? AND sender = ? AND type = 'like' AND moment_id = ?`, args: [moment.username, username, moment_id] });
      }
      res.json({ success: true, action: 'unliked' });
    } else {
      // Like
      await db.execute({ sql: `INSERT INTO likes (moment_id, username) VALUES (?, ?)`, args: [moment_id, username] });
      const momentResult = await db.execute({ sql: 'SELECT username FROM moments WHERE id = ?', args: [moment_id] });
      const moment = momentResult.rows[0];
      if (moment && moment.username !== username) {
        await db.execute({ sql: `INSERT INTO notifications (recipient, sender, type, moment_id) VALUES (?, ?, 'like', ?)`, args: [moment.username, username, moment_id] });
        sendPushNotification(moment.username, "Moment Disukai", `${username} menyukai moment Anda.`);
      }
      res.json({ success: true, action: 'liked' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/moments/comment', async (req, res) => {
  const { moment_id, username, content } = req.body;
  if (!moment_id || !username || !content) return res.status(400).json({ error: "Data tidak lengkap" });
  
  try {
    const insertResult = await db.execute({ sql: `INSERT INTO comments (moment_id, username, content) VALUES (?, ?, ?)`, args: [moment_id, username, content] });
    const momentResult = await db.execute({ sql: 'SELECT username FROM moments WHERE id = ?', args: [moment_id] });
    const moment = momentResult.rows[0];
    if (moment && moment.username !== username) {
      await db.execute({ sql: `INSERT INTO notifications (recipient, sender, type, moment_id, content) VALUES (?, ?, 'comment', ?, ?)`, args: [moment.username, username, moment_id, content] });
      sendPushNotification(moment.username, "Komentar Baru", `${username} mengomentari: ${content}`);
    }
    res.json({ success: true, id: insertResult.lastInsertRowid.toString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/moments/comment/:id', async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: "Isi komentar tidak boleh kosong" });
  try {
    await db.execute({ sql: `UPDATE comments SET content = ? WHERE id = ?`, args: [content, id] });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/moments/comment/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.execute({ sql: `DELETE FROM comments WHERE id = ?`, args: [id] });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- NOTIFICATIONS API ---
app.get('/api/notifications/:username', async (req, res) => {
  const { username } = req.params;
  try {
    const query = `
      SELECT n.*, u.avatar as sender_avatar 
      FROM notifications n
      LEFT JOIN users u ON n.sender = u.username
      WHERE n.recipient = ?
      ORDER BY n.created_at DESC
    `;
    const result = await db.execute({ sql: query, args: [username] });
    res.json(result.rows || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notifications/read', async (req, res) => {
  const { username } = req.body;
  try {
    await db.execute({ sql: 'UPDATE notifications SET is_read = 1 WHERE recipient = ?', args: [username] });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/notifications/click', async (req, res) => {
  const { id } = req.body;
  try {
    await db.execute({ sql: 'UPDATE notifications SET is_clicked = 1 WHERE id = ?', args: [id] });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- USER API ---
app.post('/api/users/avatar', async (req, res) => {
  const { username, avatar } = req.body;
  try {
    await db.execute({ sql: `UPDATE users SET avatar = ? WHERE username = ?`, args: [avatar, username] });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Gagal menyimpan avatar" });
  }
});

app.put('/api/users/:username', async (req, res) => {
  const { display_name, bio } = req.body;
  try {
    await db.execute({ sql: `UPDATE users SET display_name = ?, bio = ? WHERE username = ?`, args: [display_name, bio, req.params.username] });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Gagal menyimpan profil" });
  }
});

app.get('/api/users/search', async (req, res) => {
  const { q, username } = req.query;
  if (!q || !username) return res.json([]);
  
  try {
    const query = `
      SELECT u.username, u.avatar, u.display_name, u.bio, 
             c.status, c.sender_username, c.receiver_username
      FROM users u
      LEFT JOIN contacts c ON 
        (c.sender_username = u.username AND c.receiver_username = ?) OR
        (c.sender_username = ? AND c.receiver_username = u.username)
      WHERE u.username = ? AND u.username != ?
      LIMIT 10
    `;
    const result = await db.execute({ sql: query, args: [username, username, q, username] });
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users/:username', async (req, res) => {
  try {
    const result = await db.execute({ sql: `SELECT username, display_name, avatar, bio FROM users WHERE username = ?`, args: [req.params.username] });
    res.json(result.rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/contacts/request', async (req, res) => {
  const { sender, receiver } = req.body;
  if (!sender || !receiver) return res.status(400).json({ error: "Data tidak lengkap" });
  
  try {
    await db.execute({ sql: `INSERT INTO contacts (sender_username, receiver_username, status) VALUES (?, ?, 'pending')`, args: [sender, receiver] });
    await db.execute({
      sql: `INSERT INTO notifications (recipient, sender, type, moment_id, content) VALUES (?, ?, 'friend_request', -1, 'mengirim permintaan pertemanan')`,
      args: [receiver, sender]
    });
    sendPushNotification(receiver, "Permintaan Teman", `${sender} ingin berteman dengan Anda.`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Gagal mengirim permintaan" });
  }
});

app.post('/api/contacts/cancel', async (req, res) => {
  const { sender, receiver } = req.body;
  if (!sender || !receiver) return res.status(400).json({ error: "Data tidak lengkap" });
  
  try {
    await db.execute({ sql: `DELETE FROM contacts WHERE sender_username = ? AND receiver_username = ? AND status = 'pending'`, args: [sender, receiver] });
    await db.execute({
      sql: `DELETE FROM notifications WHERE sender = ? AND recipient = ? AND type = 'friend_request'`,
      args: [sender, receiver]
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Gagal membatalkan permintaan" });
  }
});

app.post('/api/contacts/respond', async (req, res) => {
  const { sender, receiver, action } = req.body; 
  
  try {
    await db.execute({ sql: `DELETE FROM notifications WHERE sender = ? AND recipient = ? AND type = 'friend_request'`, args: [sender, receiver] });

    if (action === 'accept') {
      await db.execute({ sql: `UPDATE contacts SET status = 'accepted' WHERE sender_username = ? AND receiver_username = ?`, args: [sender, receiver] });
      await db.execute({
        sql: `INSERT INTO notifications (recipient, sender, type, moment_id, content) VALUES (?, ?, 'friend_accept', -1, 'menerima permintaan pertemanan')`,
        args: [sender, receiver]
      });
      sendPushNotification(sender, "Permintaan Diterima", `${receiver} menerima permintaan pertemanan Anda.`);
      res.json({ success: true });
    } else {
      await db.execute({ sql: `DELETE FROM contacts WHERE sender_username = ? AND receiver_username = ?`, args: [sender, receiver] });
      res.json({ success: true });
    }
  } catch (err) {
    res.status(500).json({ error: "Gagal" });
  }
});

app.get('/api/contacts/:username', async (req, res) => {
  const { username } = req.params;
  
  try {
    const result = await db.execute({
      sql: `
        SELECT c.*, u1.avatar as sender_avatar, u1.display_name as sender_display_name, u1.bio as sender_bio, u2.avatar as receiver_avatar, u2.display_name as receiver_display_name, u2.bio as receiver_bio
        FROM contacts c
        LEFT JOIN users u1 ON c.sender_username = u1.username
        LEFT JOIN users u2 ON c.receiver_username = u2.username
        WHERE c.sender_username = ? OR c.receiver_username = ?
      `,
      args: [username, username]
    });
    
    const rows = result.rows;
    const friends = [];
    const pending_received = [];
    const pending_sent = [];
    
    rows.forEach(r => {
      if (r.status === 'accepted') {
        const isSender = r.sender_username === username;
        if (isSender) {
          friends.push({
            username: r.receiver_username,
            avatar: r.receiver_avatar,
            displayName: r.receiver_display_name,
            bio: r.receiver_bio
          });
        } else {
          friends.push({
            username: r.sender_username,
            avatar: r.sender_avatar,
            displayName: r.sender_display_name,
            bio: r.sender_bio
          });
        }
      } else {
        if (r.receiver_username === username) {
          pending_received.push({ username: r.sender_username, avatar: r.sender_avatar, displayName: r.sender_display_name, bio: r.sender_bio });
        } else {
          pending_sent.push({ username: r.receiver_username, avatar: r.receiver_avatar, displayName: r.receiver_display_name, bio: r.receiver_bio });
        }
      }
    });
    
    res.json({ friends, pending_received, pending_sent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// --- CHATS API ---
app.get('/api/chats/:username', async (req, res) => {
  const { username } = req.params;
  updateLastSeen(username); // Hijacked heartbeat
  
  try {
    const query = `
      SELECT m.*, u.avatar, u.display_name, u.username as partner_exists,
             (SELECT COUNT(*) FROM messages 
              WHERE receiver = ? 
                AND sender = CASE WHEN m.sender = ? THEN m.receiver ELSE m.sender END 
                AND is_read = 0
                AND deleted_by_receiver = 0) as unread_count
      FROM messages m
      INNER JOIN (
        SELECT MAX(created_at) as max_date, 
               CASE WHEN sender = ? THEN receiver ELSE sender END as partner
        FROM messages
        WHERE (sender = ? AND deleted_by_sender = 0) OR (receiver = ? AND deleted_by_receiver = 0)
        GROUP BY partner
      ) latest ON (m.sender = ? AND m.receiver = latest.partner OR m.sender = latest.partner AND m.receiver = ?) 
               AND m.created_at = latest.max_date
      LEFT JOIN users u ON u.username = latest.partner
      WHERE (m.sender = ? AND m.deleted_by_sender = 0) OR (m.receiver = ? AND m.deleted_by_receiver = 0)
      ORDER BY m.created_at DESC
    `;
    
    const result = await db.execute({ sql: query, args: [username, username, username, username, username, username, username, username, username] });
    const rows = result.rows;
    
    const chats = rows.map(r => {
      const partner = r.sender === username ? r.receiver : r.sender;
      const isDeleted = !r.partner_exists;
      return {
        partner,
        displayName: isDeleted ? 'Deleted Account' : (r.display_name || partner),
        lastMessage: r.text,
        time: r.created_at,
        isSystem: false,
        avatar: isDeleted ? null : r.avatar,
        isDeleted: isDeleted,
        unread: r.unread_count || 0,
        isLastMessageMine: r.sender === username,
        isLastMessageRead: r.is_read === 1
      };
    });
    res.json(chats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/messages/:user1/:user2', async (req, res) => {
  const { user1, user2 } = req.params;
  updateLastSeen(user1); // Hijacked heartbeat
  try {
    const partnerResult = await db.execute({ sql: `SELECT last_seen FROM users WHERE username = ?`, args: [user2] });
    if (partnerResult.rows.length > 0) {
      res.setHeader('Access-Control-Expose-Headers', 'X-Partner-Last-Seen');
      res.setHeader('X-Partner-Last-Seen', partnerResult.rows[0].last_seen || '');
    }

    const result = await db.execute({
      sql: `SELECT * FROM messages WHERE ((sender = ? AND receiver = ? AND deleted_by_sender = 0) OR (sender = ? AND receiver = ? AND deleted_by_receiver = 0)) ORDER BY created_at ASC`,
      args: [user1, user2, user2, user1]
    });
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/messages/read', async (req, res) => {
  const { sender, receiver } = req.body;
  if (!sender || !receiver) return res.status(400).json({ error: 'Missing data' });
  try {
    await db.execute({ sql: `UPDATE messages SET is_read = 1 WHERE sender = ? AND receiver = ?`, args: [sender, receiver] });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/messages/favorite', async (req, res) => {
  const { username, messageIds } = req.body;
  if (!username || !messageIds || !Array.isArray(messageIds) || messageIds.length === 0) return res.status(400).json({ error: "Data tidak lengkap" });

  try {
    for (let id of messageIds) {
      try {
        await db.execute({ sql: `INSERT INTO favorite_messages (username, message_id) VALUES (?, ?)`, args: [username, id] });
      } catch(e) {
        // Ignore UNIQUE constraint errors (INSERT OR IGNORE fallback)
      }
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/messages/clear-image', async (req, res) => {
  const { messageId } = req.body;
  if (!messageId) return res.status(400).json({ error: "Missing messageId" });

  try {
    const result = await db.execute({ sql: `SELECT text FROM messages WHERE id = ?`, args: [messageId] });
    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: "Not found" });
    
    let newText = 'MEDIA_LOCAL_SAVED';
    if (row.text && row.text.includes('|||')) {
      const firstTagIndex = row.text.indexOf('|||');
      newText = 'MEDIA_LOCAL_SAVED' + row.text.substring(firstTagIndex);
    }
    
    await db.execute({ sql: `UPDATE messages SET text = ? WHERE id = ?`, args: [newText, messageId] });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/messages/delete', async (req, res) => {
  const { username, messageIds } = req.body;
  if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) return res.status(400).json({ error: "Data tidak lengkap" });

  const placeholders = messageIds.map(() => '?').join(', ');
  
  try {
    if (username) {
      const params = [username, ...messageIds];
      await db.execute({ sql: `UPDATE messages SET deleted_by_sender = 1 WHERE sender = ? AND id IN (${placeholders})`, args: params });
      await db.execute({ sql: `UPDATE messages SET deleted_by_receiver = 1 WHERE receiver = ? AND id IN (${placeholders})`, args: params });
      await db.execute(`DELETE FROM messages WHERE deleted_by_sender = 1 AND deleted_by_receiver = 1`);
    } else {
      await db.execute({ sql: `DELETE FROM messages WHERE id IN (${placeholders})`, args: messageIds });
    }
    
    if (username) {
      await db.execute({ sql: `DELETE FROM favorite_messages WHERE message_id IN (${placeholders}) AND username = ?`, args: [...messageIds, username] });
    } else {
      await db.execute({ sql: `DELETE FROM favorite_messages WHERE message_id IN (${placeholders})`, args: messageIds });
    }
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/chats/delete-bulk', async (req, res) => {
  const { username, partners } = req.body;
  if (!username || !partners || !Array.isArray(partners) || partners.length === 0) {
    return res.status(400).json({ error: "Data tidak lengkap" });
  }

  const placeholders = partners.map(() => '?').join(', ');
  const params = [username, ...partners];
  
  try {
    await db.execute({ sql: `UPDATE messages SET deleted_by_sender = 1 WHERE sender = ? AND receiver IN (${placeholders})`, args: params });
    await db.execute({ sql: `UPDATE messages SET deleted_by_receiver = 1 WHERE receiver = ? AND sender IN (${placeholders})`, args: params });
    await db.execute(`DELETE FROM messages WHERE deleted_by_sender = 1 AND deleted_by_receiver = 1`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/contacts/delete-bulk', async (req, res) => {
  const { username, targets } = req.body;
  if (!username || !targets || !Array.isArray(targets) || targets.length === 0) {
    return res.status(400).json({ error: "Data tidak lengkap" });
  }

  const placeholders = targets.map(() => '?').join(', ');
  const params = [username, ...targets, username, ...targets];
  try {
    await db.execute({
      sql: `DELETE FROM contacts WHERE (sender_username = ? AND receiver_username IN (${placeholders})) OR (receiver_username = ? AND sender_username IN (${placeholders}))`,
      args: params
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/favorites/:username', async (req, res) => {
  const { username } = req.params;
  const query = `
    SELECT DISTINCT 
           CASE WHEN m.sender = ? THEN m.receiver ELSE m.sender END as partner,
           u.avatar, u.display_name, u.username as partner_exists
    FROM favorite_messages fm
    JOIN messages m ON fm.message_id = m.id
    LEFT JOIN users u ON u.username = (CASE WHEN m.sender = ? THEN m.receiver ELSE m.sender END)
    WHERE fm.username = ?
  `;
  try {
    const result = await db.execute({ sql: query, args: [username, username, username] });
    const rows = result.rows;
    
    const partners = {};
    rows.forEach(r => {
      const isDeleted = !r.partner_exists;
      partners[r.partner] = { 
        username: r.partner, 
        avatar: isDeleted ? null : r.avatar, 
        displayName: isDeleted ? 'Deleted Account' : (r.display_name || r.partner),
        isDeleted: isDeleted
      };
    });
    res.json(Object.values(partners));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/favorites/messages/:username/:partner', async (req, res) => {
  const { username, partner } = req.params;
  const query = `
    SELECT m.* 
    FROM favorite_messages fm
    JOIN messages m ON fm.message_id = m.id
    WHERE fm.username = ? AND ((m.sender = ? AND m.receiver = ?) OR (m.sender = ? AND m.receiver = ?))
    ORDER BY m.created_at ASC
  `;
  try {
    const result = await db.execute({ sql: query, args: [username, username, partner, partner, username] });
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/messages/send', async (req, res) => {
  const data = req.body;
  try {
    const contactCheck = await db.execute({
      sql: `SELECT status FROM contacts WHERE (sender_username = ? AND receiver_username = ?) OR (sender_username = ? AND receiver_username = ?)`,
      args: [data.sender, data.recipient, data.recipient, data.sender]
    });
    
    if (contactCheck.rows.length === 0 || contactCheck.rows[0].status !== 'accepted') {
      return res.status(403).json({ error: "Anda tidak berteman dengan pengguna ini" });
    }

    const result = await db.execute({ sql: `INSERT INTO messages (sender, receiver, text) VALUES (?, ?, ?)`, args: [data.sender, data.recipient, data.text] });
    data.id = result.lastInsertRowid.toString();
    
    // Send Push Notification via OneSignal
    let pushText = data.text;
    if (pushText.includes('|||CAPTION|||')) {
      pushText = '📸 Mengirim Gambar: ' + pushText.split('|||CAPTION|||')[1];
    } else if (pushText.startsWith('data:image/') || pushText === 'MEDIA_LOCAL_SAVED') {
      pushText = '📸 Mengirim Gambar';
    }
    sendPushNotification(data.recipient, `Pesan baru dari ${data.sender}`, pushText);

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/messages/edit', async (req, res) => {
  const data = req.body;
  try {
    const result = await db.execute({ sql: `UPDATE messages SET text = ?, is_edited = 1 WHERE id = ? AND sender = ?`, args: [data.text, data.id, data.sender] });
    res.json({ success: result.rowsAffected > 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/messages/delete_everyone', async (req, res) => {
  const data = req.body;
  try {
    const result = await db.execute({ sql: `UPDATE messages SET is_deleted_everyone = 1 WHERE id = ? AND sender = ?`, args: [data.id, data.sender] });
    res.json({ success: result.rowsAffected > 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.use(express.static(path.join(__dirname, 'dist')));

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

if (process.env.VERCEL) {
  module.exports = app;
} else {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on port ${PORT}`);
  });
}
