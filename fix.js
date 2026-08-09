const fs = require('fs');
let code = fs.readFileSync('backend/index.js', 'utf8');

// 1. Move the API blocks
const apiBlockStart = code.indexOf('// --- RESTRICTIONS API ---');
const apiBlockEnd = code.indexOf('  const PORT = process.env.PORT || 3001;');
if (apiBlockStart !== -1 && apiBlockEnd !== -1) {
  const apiBlock = code.substring(apiBlockStart, apiBlockEnd);
  
  // Remove the apiBlock from its current location
  code = code.substring(0, apiBlockStart) + code.substring(apiBlockEnd);
  
  // Insert it before app.use(express.static...
  const staticIndex = code.indexOf("app.use(express.static(path.join(__dirname, 'dist')));");
  code = code.substring(0, staticIndex) + apiBlock + '\\n' + code.substring(staticIndex);
}

// 2. Add checkRestriction function
const checkFunction = `
async function checkRestriction(username, type) {
  if (username === 'imo_ai') return false;
  try {
    const res = await db.execute({ sql: "SELECT * FROM user_restrictions WHERE username = ? OR username = 'GLOBAL'", args: [username] });
    let isRestricted = false;
    res.rows.forEach(row => {
      if (row.full_mute) isRestricted = true;
      if (type === 'chat' && row.disable_chat) isRestricted = true;
      if (type === 'moment' && row.disable_moment) isRestricted = true;
      if (type === 'chat_image' && row.disable_chat_image) isRestricted = true;
      if (type === 'moment_image' && row.disable_moment_image) isRestricted = true;
    });
    return isRestricted;
  } catch(e) {
    return false;
  }
}
`;
if (!code.includes('checkRestriction(')) {
  code = code.replace('const app = express();', checkFunction + '\nconst app = express();');
}

// 3. Inject check in /api/messages/send
if (!code.includes('checkRestriction(data.sender')) {
  code = code.replace(
    "  try {\n    if (data.sender !== 'imo_ai') {",
    "  try {\n    const isRestricted = await checkRestriction(data.sender, data.text.includes('|||CAPTION|||') || data.text.startsWith('data:image/') || data.text === 'MEDIA_LOCAL_SAVED' ? 'chat_image' : 'chat');\n    if (isRestricted) return res.status(403).json({ error: 'Anda sedang dibatasi (Muted)' });\n    if (data.sender !== 'imo_ai') {"
  );
}

// 4. Inject check in /api/moments
if (!code.includes('checkRestriction(username, image_url')) {
  code = code.replace(
    "app.post('/api/moments', async (req, res) => {\n  const { username, content, image_url } = req.body;\n  if (!username || (!content && !image_url)) return res.status(400).json({ error: \"Username dan konten/gambar wajib diisi\" });\n  \n  try {",
    "app.post('/api/moments', async (req, res) => {\n  const { username, content, image_url } = req.body;\n  if (!username || (!content && !image_url)) return res.status(400).json({ error: \"Username dan konten/gambar wajib diisi\" });\n  \n  try {\n    const isRestricted = await checkRestriction(username, image_url ? 'moment_image' : 'moment');\n    if (isRestricted) return res.status(403).json({ error: 'Anda sedang dibatasi (Muted)' });"
  );
}

// 5. Inject check in /api/moments/comment
if (!code.includes("checkRestriction(username, 'moment');")) {
  code = code.replace(
    "app.post('/api/moments/comment', async (req, res) => {\n  const { moment_id, username, content } = req.body;\n  if (!moment_id || !username || !content) return res.status(400).json({ error: \"Data tidak lengkap\" });\n\n  try {",
    "app.post('/api/moments/comment', async (req, res) => {\n  const { moment_id, username, content } = req.body;\n  if (!moment_id || !username || !content) return res.status(400).json({ error: \"Data tidak lengkap\" });\n\n  try {\n    const isRestricted = await checkRestriction(username, 'moment');\n    if (isRestricted) return res.status(403).json({ error: 'Anda sedang dibatasi (Muted)' });"
  );
}

// 6. Inject check in /api/moments/like
if (!code.includes("checkRestriction(username, 'moment')")) {
  code = code.replace(
    "app.post('/api/moments/like', async (req, res) => {\n  const { moment_id, username } = req.body;\n  if (!moment_id || !username) return res.status(400).json({ error: \"Data tidak lengkap\" });\n  try {",
    "app.post('/api/moments/like', async (req, res) => {\n  const { moment_id, username } = req.body;\n  if (!moment_id || !username) return res.status(400).json({ error: \"Data tidak lengkap\" });\n  try {\n    const isRestricted = await checkRestriction(username, 'moment');\n    if (isRestricted) return res.status(403).json({ error: 'Anda sedang dibatasi (Muted)' });"
  );
}

fs.writeFileSync('backend/index.js', code);
console.log('Update complete.');
