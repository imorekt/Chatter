const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const nodemailer = require('nodemailer');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config();

// --- DATABASE SETUP ---
const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS moments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        content TEXT NOT NULL,
        image_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        moment_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        UNIQUE(moment_id, username)
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        moment_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_username TEXT NOT NULL,
        receiver_username TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(sender_username, receiver_username)
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender TEXT NOT NULL,
        receiver TEXT NOT NULL,
        text TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    db.run(`ALTER TABLE messages ADD COLUMN is_read INTEGER DEFAULT 0`, (err) => {
      // Ignored if column already exists
    });
    db.run(`
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
    db.run(`
      CREATE TABLE IF NOT EXISTS favorite_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        message_id INTEGER NOT NULL,
        UNIQUE(username, message_id)
      )
    `);
    db.run("ALTER TABLE users ADD COLUMN avatar TEXT", (err) => {
      // Ignore if column already exists
    });
    db.run("ALTER TABLE users ADD COLUMN display_name TEXT", (err) => {
      // Ignore if column already exists
    });
    db.run("ALTER TABLE users ADD COLUMN bio TEXT", (err) => {
      // Ignore if column already exists
    });
    db.run("ALTER TABLE notifications ADD COLUMN is_clicked INTEGER DEFAULT 0", (err) => {
      // Ignore if column already exists
    });
  }
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

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
    console.log("⚠️ EMAIL_USER & EMAIL_PASS tidak ada di .env. Menggunakan akun test Ethereal.");
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
  
  // Jika benar, simpan ke database
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    db.run('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hashedPassword], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: "Username atau Email sudah terdaftar" });
        }
        return res.status(500).json({ error: "Gagal menyimpan data akun" });
      }
      
      otpStore.delete(email);
      res.json({ success: true, message: "Akun berhasil dibuat dan disimpan!" });
    });
  } catch (error) {
    res.status(500).json({ error: "Terjadi kesalahan sistem" });
  }
});

// --- LOGIN API ---
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) return res.status(500).json({ error: "Terjadi kesalahan database" });
    if (!user) return res.status(400).json({ error: "Email tidak ditemukan" });
    
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: "Kata sandi salah" });
    
    res.json({ success: true, username: user.username, message: "Login berhasil" });
  });
});

// --- FORGOT PASSWORD API ---
app.post('/api/auth/forgot-password-otp', (req, res) => {
  const { email } = req.body;
  
  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) return res.status(500).json({ error: "Terjadi kesalahan database" });
    if (!user) return res.status(400).json({ error: "Email tidak terdaftar di sistem" });
    
    // Create OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 10 * 60 * 1000;
    otpStore.set(email, { otp, expires });
    
    try {
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
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  const record = otpStore.get(email);
  
  if (!record || Date.now() > record.expires) return res.status(400).json({ error: "OTP tidak valid/kadaluarsa" });
  if (record.otp !== otp) return res.status(400).json({ error: "OTP salah" });
  
  try {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    db.run('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, email], function(err) {
      if (err) return res.status(500).json({ error: "Gagal mengubah kata sandi" });
      otpStore.delete(email);
      res.json({ success: true, message: "Kata sandi berhasil diubah" });
    });
  } catch (error) {
    res.status(500).json({ error: "Terjadi kesalahan sistem" });
  }
});
// -----------------

app.delete('/api/users/:identifier', (req, res) => {
  const { identifier } = req.params;
  const { keyword } = req.body;
  
  db.get('SELECT * FROM users WHERE username = ? OR email = ?', [identifier, identifier], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });
    if (!keyword || keyword.toLowerCase() !== 'setuju') return res.status(400).json({ error: 'Kata kunci konfirmasi salah' });
    
    const targetUsername = user.username;
    db.serialize(() => {
      db.run('DELETE FROM moments WHERE username = ?', [targetUsername]);
      db.run('DELETE FROM comments WHERE username = ?', [targetUsername]);
      db.run('DELETE FROM likes WHERE username = ?', [targetUsername]);
      db.run('DELETE FROM contacts WHERE sender_username = ? OR receiver_username = ?', [targetUsername, targetUsername]);
      db.run('DELETE FROM notifications WHERE recipient = ? OR sender = ?', [targetUsername, targetUsername]);
      db.run('DELETE FROM users WHERE id = ?', [user.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
      });
    });
  });
});

// --- MOMENTS API ---
app.get('/api/moments', (req, res) => {
  const query = `
    SELECT m.*, u.avatar as user_avatar, u.display_name as user_display_name,
           (SELECT COUNT(*) FROM likes WHERE moment_id = m.id) as like_count,
           (SELECT GROUP_CONCAT(username) FROM likes WHERE moment_id = m.id) as liked_by
    FROM moments m
    LEFT JOIN users u ON m.username = u.username
    ORDER BY m.created_at DESC
  `;
  db.all(query, [], (err, moments) => {
    if (err) return res.status(500).json({ error: err.message });
    
    // Fetch comments for all moments
    db.all(`SELECT c.*, u.display_name as user_display_name FROM comments c LEFT JOIN users u ON c.username = u.username ORDER BY c.created_at ASC`, [], (err, allComments) => {
      if (err) return res.status(500).json({ error: err.message });
      
      const formattedMoments = moments.map(m => {
        return {
          ...m,
          liked_by: m.liked_by ? m.liked_by.split(',') : [],
          comments: allComments.filter(c => c.moment_id === m.id)
        };
      });
      res.json(formattedMoments);
    });
  });
});

app.post('/api/moments', (req, res) => {
  const { username, content, image_url } = req.body;
  if (!username || !content) return res.status(400).json({ error: "Username dan konten wajib diisi" });
  
  db.run(`INSERT INTO moments (username, content, image_url) VALUES (?, ?, ?)`, [username, content, image_url || null], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, id: this.lastID });
  });
});

app.put('/api/moments/:id', (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: "Konten wajib diisi" });
  
  db.run(`UPDATE moments SET content = ? WHERE id = ?`, [content, req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.delete('/api/moments/:id', (req, res) => {
  const momentId = req.params.id;
  db.serialize(() => {
    db.run(`DELETE FROM moments WHERE id = ?`, [momentId]);
    db.run(`DELETE FROM likes WHERE moment_id = ?`, [momentId]);
    db.run(`DELETE FROM comments WHERE moment_id = ?`, [momentId]);
    db.run(`DELETE FROM notifications WHERE moment_id = ?`, [momentId]);
    res.json({ success: true });
  });
});

app.post('/api/moments/like', (req, res) => {
  const { moment_id, username } = req.body;
  
  // Toggle like: Check if exists
  db.get(`SELECT id FROM likes WHERE moment_id = ? AND username = ?`, [moment_id, username], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (row) {
      // Unlike
      db.run(`DELETE FROM likes WHERE id = ?`, [row.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.get('SELECT username FROM moments WHERE id = ?', [moment_id], (err, moment) => {
          if (moment && moment.username !== username) {
            db.run(`DELETE FROM notifications WHERE recipient = ? AND sender = ? AND type = 'like' AND moment_id = ?`, [moment.username, username, moment_id]);
          }
        });

        res.json({ success: true, action: 'unliked' });
      });
    } else {
      // Like
      db.run(`INSERT INTO likes (moment_id, username) VALUES (?, ?)`, [moment_id, username], (err) => {
        if (err) return res.status(500).json({ error: err.message });

        db.get('SELECT username FROM moments WHERE id = ?', [moment_id], (err, moment) => {
          if (moment && moment.username !== username) {
            db.run(`INSERT INTO notifications (recipient, sender, type, moment_id) VALUES (?, ?, 'like', ?)`, [moment.username, username, moment_id]);
          }
        });

        res.json({ success: true, action: 'liked' });
      });
    }
  });
});

app.post('/api/moments/comment', (req, res) => {
  const { moment_id, username, content } = req.body;
  if (!moment_id || !username || !content) return res.status(400).json({ error: "Data tidak lengkap" });
  
  db.run(`INSERT INTO comments (moment_id, username, content) VALUES (?, ?, ?)`, [moment_id, username, content], function(err) {
    if (err) return res.status(500).json({ error: err.message });

    db.get('SELECT username FROM moments WHERE id = ?', [moment_id], (err, moment) => {
      if (moment && moment.username !== username) {
        db.run(`INSERT INTO notifications (recipient, sender, type, moment_id, content) VALUES (?, ?, 'comment', ?, ?)`, [moment.username, username, moment_id, content]);
      }
    });

    res.json({ success: true, id: this.lastID });
  });
});
// -----------------

// --- NOTIFICATIONS API ---
app.get('/api/notifications/:username', (req, res) => {
  const { username } = req.params;
  const query = `
    SELECT n.*, u.avatar as sender_avatar 
    FROM notifications n
    LEFT JOIN users u ON n.sender = u.username
    WHERE n.recipient = ?
    ORDER BY n.created_at DESC
  `;
  db.all(query, [username], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

app.post('/api/notifications/read', (req, res) => {
  const { username } = req.body;
  db.run('UPDATE notifications SET is_read = 1 WHERE recipient = ?', [username], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.post('/api/notifications/click', (req, res) => {
  const { id } = req.body;
  db.run('UPDATE notifications SET is_clicked = 1 WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});
// -----------------

// --- USER API ---
app.post('/api/users/avatar', (req, res) => {
  const { username, avatar } = req.body;
  db.run(`UPDATE users SET avatar = ? WHERE username = ?`, [avatar, username], (err) => {
    if (err) return res.status(500).json({ error: "Gagal menyimpan avatar" });
    res.json({ success: true });
  });
});

app.put('/api/users/:username', (req, res) => {
  const { display_name, bio } = req.body;
  db.run(`UPDATE users SET display_name = ?, bio = ? WHERE username = ?`, [display_name, bio, req.params.username], (err) => {
    if (err) return res.status(500).json({ error: "Gagal menyimpan profil" });
    res.json({ success: true });
  });
});

app.get('/api/users/search', (req, res) => {
  const { q, username } = req.query;
  if (!q || !username) return res.json([]);
  
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
  db.all(query, [username, username, q, username], (err, users) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(users);
  });
});

app.get('/api/users/:username', (req, res) => {
  db.get(`SELECT username, display_name, avatar, bio FROM users WHERE username = ?`, [req.params.username], (err, user) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(user || {});
  });
});

app.post('/api/contacts/request', (req, res) => {
  const { sender, receiver } = req.body;
  if (!sender || !receiver) return res.status(400).json({ error: "Data tidak lengkap" });
  
  db.run(`INSERT INTO contacts (sender_username, receiver_username, status) VALUES (?, ?, 'pending')`, [sender, receiver], (err) => {
    if (err) return res.status(500).json({ error: "Gagal mengirim permintaan" });
    
    db.run(
      `INSERT INTO notifications (recipient, sender, type, moment_id, content) VALUES (?, ?, 'friend_request', -1, 'mengirim permintaan pertemanan')`,
      [receiver, sender]
    );
    
    res.json({ success: true });
  });
});

app.post('/api/contacts/cancel', (req, res) => {
  const { sender, receiver } = req.body;
  if (!sender || !receiver) return res.status(400).json({ error: "Data tidak lengkap" });
  
  db.run(`DELETE FROM contacts WHERE sender_username = ? AND receiver_username = ? AND status = 'pending'`, [sender, receiver], (err) => {
    if (err) return res.status(500).json({ error: "Gagal membatalkan permintaan" });
    
    db.run(
      `DELETE FROM notifications WHERE sender = ? AND recipient = ? AND type = 'friend_request'`,
      [sender, receiver]
    );
    
    res.json({ success: true });
  });
});

app.post('/api/contacts/respond', (req, res) => {
  const { sender, receiver, action } = req.body; // action: 'accept' | 'reject'
  if (action === 'accept') {
    db.run(`UPDATE contacts SET status = 'accepted' WHERE sender_username = ? AND receiver_username = ?`, [sender, receiver], (err) => {
      if (err) return res.status(500).json({ error: "Gagal" });
      res.json({ success: true });
    });
  } else {
    db.run(`DELETE FROM contacts WHERE sender_username = ? AND receiver_username = ?`, [sender, receiver], (err) => {
      if (err) return res.status(500).json({ error: "Gagal" });
      res.json({ success: true });
    });
  }
});

app.get('/api/contacts/:username', (req, res) => {
  const { username } = req.params;
  
  db.all(`
    SELECT c.*, u1.avatar as sender_avatar, u1.display_name as sender_display_name, u1.bio as sender_bio, u2.avatar as receiver_avatar, u2.display_name as receiver_display_name, u2.bio as receiver_bio
    FROM contacts c
    LEFT JOIN users u1 ON c.sender_username = u1.username
    LEFT JOIN users u2 ON c.receiver_username = u2.username
    WHERE c.sender_username = ? OR c.receiver_username = ?
  `, [username, username], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
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
  });
});

// --- CHATS API ---
app.get('/api/chats/:username', (req, res) => {
  const { username } = req.params;
  
  const query = `
    SELECT m.*, u.avatar, u.display_name, u.username as partner_exists,
           (SELECT COUNT(*) FROM messages 
            WHERE receiver = ? 
              AND sender = CASE WHEN m.sender = ? THEN m.receiver ELSE m.sender END 
              AND is_read = 0) as unread_count
    FROM messages m
    INNER JOIN (
      SELECT MAX(created_at) as max_date, 
             CASE WHEN sender = ? THEN receiver ELSE sender END as partner
      FROM messages
      WHERE sender = ? OR receiver = ?
      GROUP BY partner
    ) latest ON (m.sender = ? AND m.receiver = latest.partner OR m.sender = latest.partner AND m.receiver = ?) 
             AND m.created_at = latest.max_date
    LEFT JOIN users u ON u.username = latest.partner
    ORDER BY m.created_at DESC
  `;
  
  db.all(query, [username, username, username, username, username, username, username], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
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
  });
});

app.get('/api/messages/:user1/:user2', (req, res) => {
  const { user1, user2 } = req.params;
  db.all(`SELECT * FROM messages WHERE (sender = ? AND receiver = ?) OR (sender = ? AND receiver = ?) ORDER BY created_at ASC`, 
    [user1, user2, user2, user1], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/messages/read', (req, res) => {
  const { sender, receiver } = req.body;
  if (!sender || !receiver) return res.status(400).json({ error: 'Missing data' });
  db.run(`UPDATE messages SET is_read = 1 WHERE sender = ? AND receiver = ?`, [sender, receiver], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.post('/api/messages/favorite', (req, res) => {
  const { username, messageIds } = req.body;
  if (!username || !messageIds || !Array.isArray(messageIds) || messageIds.length === 0) return res.status(400).json({ error: "Data tidak lengkap" });

  const placeholders = messageIds.map(() => '(?, ?)').join(', ');
  const values = [];
  messageIds.forEach(id => {
    values.push(username, id);
  });

  db.run(`INSERT OR IGNORE INTO favorite_messages (username, message_id) VALUES ${placeholders}`, values, (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.post('/api/messages/clear-image', (req, res) => {
  const { messageId } = req.body;
  if (!messageId) return res.status(400).json({ error: "Missing messageId" });

  db.get(`SELECT text FROM messages WHERE id = ?`, [messageId], (err, row) => {
    if (err || !row) return res.status(404).json({ error: "Not found" });
    let newText = 'MEDIA_LOCAL_SAVED';
    if (row.text && row.text.includes('|||CAPTION|||')) {
      const caption = row.text.split('|||CAPTION|||')[1];
      newText = `MEDIA_LOCAL_SAVED|||CAPTION|||${caption}`;
    }
    db.run(`UPDATE messages SET text = ? WHERE id = ?`, [newText, messageId], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ success: true });
    });
  });
});

app.post('/api/messages/delete', (req, res) => {
  const { messageIds } = req.body;
  if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) return res.status(400).json({ error: "Data tidak lengkap" });

  const placeholders = messageIds.map(() => '?').join(', ');
  
  db.serialize(() => {
    db.run(`DELETE FROM messages WHERE id IN (${placeholders})`, messageIds, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      db.run(`DELETE FROM favorite_messages WHERE message_id IN (${placeholders})`, messageIds, () => {
        res.json({ success: true });
      });
    });
  });
});

app.post('/api/chats/delete-bulk', (req, res) => {
  const { username, partners } = req.body;
  if (!username || !partners || !Array.isArray(partners) || partners.length === 0) {
    return res.status(400).json({ error: "Data tidak lengkap" });
  }

  const placeholders = partners.map(() => '?').join(', ');
  const params = [username, ...partners, username, ...partners];
  db.run(
    `DELETE FROM messages WHERE (sender = ? AND receiver IN (${placeholders})) OR (receiver = ? AND sender IN (${placeholders}))`,
    params,
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

app.post('/api/contacts/delete-bulk', (req, res) => {
  const { username, targets } = req.body;
  if (!username || !targets || !Array.isArray(targets) || targets.length === 0) {
    return res.status(400).json({ error: "Data tidak lengkap" });
  }

  const placeholders = targets.map(() => '?').join(', ');
  const params = [username, ...targets, username, ...targets];
  db.run(
    `DELETE FROM contacts WHERE (sender_username = ? AND receiver_username IN (${placeholders})) OR (receiver_username = ? AND sender_username IN (${placeholders}))`,
    params,
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    }
  );
});

app.get('/api/favorites/:username', (req, res) => {
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
  db.all(query, [username, username, username], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    
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
  });
});

app.get('/api/favorites/messages/:username/:partner', (req, res) => {
  const { username, partner } = req.params;
  const query = `
    SELECT m.* 
    FROM favorite_messages fm
    JOIN messages m ON fm.message_id = m.id
    WHERE fm.username = ? AND ((m.sender = ? AND m.receiver = ?) OR (m.sender = ? AND m.receiver = ?))
    ORDER BY m.created_at ASC
  `;
  db.all(query, [username, username, partner, partner, username], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

let onlineUsers = {}; // map of socket.id -> { username, status }

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // When a user logs in / connects
  socket.on('user_login', (username) => {
    onlineUsers[socket.id] = { username, status: 'online' };
    io.emit('online_users', Object.values(onlineUsers));
    console.log(`${username} logged in`);
  });

  // Handle incoming messages
  socket.on('send_message', (data) => {
    // data: { sender, recipient, text, timestamp }
    db.run(`INSERT INTO messages (sender, receiver, text) VALUES (?, ?, ?)`, [data.sender, data.recipient, data.text], function(err) {
      if (err) {
        console.error("Database error saving message:", err.message);
        return;
      }
      data.id = this.lastID;
      io.emit('receive_message', data);
    });
  });

  // Handle typing indicator
  socket.on('typing', (data) => {
    // data: { sender, recipient, isTyping }
    socket.broadcast.emit('typing_status', data);
  });

  // Handle messages read
  socket.on('messages_read', (data) => {
    // data: { sender, recipient } (sender is the one who read the messages)
    io.emit('messages_read_update', data);
  });

  // Handle contact request/response realtime updates
  socket.on('contact_update', (data) => {
    io.emit('contact_update', data);
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    if (onlineUsers[socket.id]) {
      const username = onlineUsers[socket.id].username;
      delete onlineUsers[socket.id];
      io.emit('online_users', Object.values(onlineUsers));
      console.log(`${username} logged out`);
    }
  });
});

// Serve static files from the 'dist' directory
app.use(express.static(path.join(__dirname, 'dist')));

// Handle all other routes by sending the index.html
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
