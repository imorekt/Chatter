const fs = require('fs');
let code = fs.readFileSync('backend/index.js', 'utf8');

const searchPostSend = `app.post('/api/messages/send', async (req, res) => {
  const data = req.body;
  try {
    const contactCheck = await db.execute({
      sql: \`SELECT status FROM contacts WHERE (sender_username = ? AND receiver_username = ?) OR (sender_username = ? AND receiver_username = ?)\`,
      args: [data.sender, data.recipient, data.recipient, data.sender]
    });
    
    if (contactCheck.rows.length === 0 || contactCheck.rows[0].status !== 'accepted') {
      return res.status(403).json({ error: "Anda tidak berteman dengan pengguna ini" });
    }

    const replyToId = data.reply_to ? parseInt(data.reply_to, 10) : null;
    const result = await db.execute({ sql: \`INSERT INTO messages (sender, receiver, text, reply_to) VALUES (?, ?, ?, ?)\`, args: [data.sender, data.recipient, data.text, replyToId] });`;

const replacePostSend = `app.post('/api/messages/send', async (req, res) => {
  const data = req.body;
  try {
    if (data.sender !== 'ImoAI') {
      const contactCheck = await db.execute({
        sql: \`SELECT status FROM contacts WHERE (sender_username = ? AND receiver_username = ?) OR (sender_username = ? AND receiver_username = ?)\`,
        args: [data.sender, data.recipient, data.recipient, data.sender]
      });
      
      if (contactCheck.rows.length === 0 || contactCheck.rows[0].status !== 'accepted') {
        return res.status(403).json({ error: "Anda tidak berteman dengan pengguna ini" });
      }
    }

    const replyToId = data.reply_to ? parseInt(data.reply_to, 10) : null;
    let chatContext = data.chat_context || null;
    if (!chatContext) {
      const u1 = data.sender < data.recipient ? data.sender : data.recipient;
      const u2 = data.sender < data.recipient ? data.recipient : data.sender;
      chatContext = \`\${u1}|\${u2}\`;
    }

    const result = await db.execute({ sql: \`INSERT INTO messages (sender, receiver, text, reply_to, chat_context) VALUES (?, ?, ?, ?, ?)\`, args: [data.sender, data.recipient, data.text, replyToId, chatContext] });`;

code = code.replace(searchPostSend, replacePostSend);

fs.writeFileSync('backend/index.js', code);
console.log('Done refactoring POST messages send');
