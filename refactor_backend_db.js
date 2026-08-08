const fs = require('fs');
let code = fs.readFileSync('backend/index.js', 'utf8');

// 1. Add chat_context column
const alterTableHook = "try { await db.execute(`ALTER TABLE messages ADD COLUMN reply_to INTEGER DEFAULT NULL`); } catch (e) {}";
if (!code.includes('chat_context TEXT')) {
  code = code.replace(
    alterTableHook,
    alterTableHook + "\n      try { await db.execute(`ALTER TABLE messages ADD COLUMN chat_context TEXT DEFAULT NULL`); } catch (e) {}"
  );
}

// 2. Add ImoAI user creation hook
const userCreationHook = "console.log('Database and tables initialized.');";
if (!code.includes("imoai@local.dev")) {
  const seedImoAi = `
      try {
        const bcrypt = require('bcryptjs');
        const hash = await bcrypt.hash('123456', 10);
        await db.execute({
          sql: \`INSERT INTO users (username, display_name, email, password, avatar, bio) VALUES (?, ?, ?, ?, ?, ?)\`,
          args: ['ImoAI', 'Imo AI', 'imoai@local.dev', hash, 'https://api.dicebear.com/7.x/bottts/svg?seed=ImoAI', 'Saya adalah asisten AI super pintar!']
        });
      } catch (e) {
        // user already exists, ignore
      }
      console.log('Database and tables initialized.');
`;
  code = code.replace(userCreationHook, seedImoAi);
}

fs.writeFileSync('backend/index.js', code);
console.log('Done refactoring db init');
