const fs = require('fs');
let code = fs.readFileSync('backend/index.js', 'utf8');

// 1. Modify GET /api/messages/:user1/:user2
const searchGetMessages = `      const result = await db.execute({
        sql: \`SELECT m.*, r.text as reply_text, r.sender as reply_sender FROM messages m LEFT JOIN messages r ON CAST(m.reply_to AS INTEGER) = r.id WHERE ((m.sender = ? AND m.receiver = ? AND m.deleted_by_sender = 0) OR (m.sender = ? AND m.receiver = ? AND m.deleted_by_receiver = 0)) ORDER BY m.created_at ASC\`,
        args: [user1, user2, user2, user1]
      });`;

const replaceGetMessages = `      const userA = user1 < user2 ? user1 : user2;
      const userB = user1 < user2 ? user2 : user1;
      const chatContextStr = \`\${userA}|\${userB}\`;
      const result = await db.execute({
        sql: \`SELECT m.*, r.text as reply_text, r.sender as reply_sender FROM messages m LEFT JOIN messages r ON CAST(m.reply_to AS INTEGER) = r.id WHERE ((m.sender = ? AND m.receiver = ? AND m.deleted_by_sender = 0) OR (m.sender = ? AND m.receiver = ? AND m.deleted_by_receiver = 0) OR (m.sender = 'ImoAI' AND m.chat_context = ? AND m.deleted_by_receiver = 0)) ORDER BY m.created_at ASC\`,
        args: [user1, user2, user2, user1, chatContextStr]
      });`;

code = code.replace(searchGetMessages, replaceGetMessages);

fs.writeFileSync('backend/index.js', code);
console.log('Done refactoring GET messages');
