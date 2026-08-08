const fs = require('fs');
let code = fs.readFileSync('frontend/src/ChatRoom.jsx', 'utf8');

// Normalize line endings to help replacement
code = code.replace(/\r\n/g, '\n');

// 1. Fix maxHeight: '40cqh' -> '350px'
code = code.replace("maxHeight: '40cqh'", "maxHeight: '350px'");

// 2. Add getReplyThumbnail and getReplyText inside renderMessages
const searchRenderMessages = '  const renderMessages = () => {';
const insertHelper = `
    const getReplyThumbnail = (text) => {
      if (!text) return null;
      if (text.startsWith('IMGBB_IMAGE|||')) return text.split('|||')[1];
      if (text.startsWith('R2_IMAGE|||')) return text.split('|||')[2];
      if (text.startsWith('data:image/')) return text.includes('|||CAPTION|||') ? text.split('|||CAPTION|||')[0] : text;
      return null;
    };
    const getReplyText = (text) => {
      if (!text) return '';
      if (text.includes('|||CAPTION|||')) return '📷 ' + text.split('|||CAPTION|||')[1];
      if (text.startsWith('IMGBB_IMAGE|||') || text.startsWith('R2_IMAGE|||') || text.startsWith('data:image/') || text === 'MEDIA_LOCAL_SAVED' || text === 'MEDIA_DELETED') return '📷 Foto';
      return text;
    };
`;

if (code.indexOf('const getReplyThumbnail') === -1) {
  code = code.replace(searchRenderMessages, searchRenderMessages + insertHelper);
}

// 3. Update the reply block JSX inside renderMessages loop
// First we locate the exact old block using regex or indexOf
const blockStart = code.indexOf("{msg.reply_to && msg.reply_text && (");
const blockEnd = code.indexOf(")}", blockStart) + 2;

if (blockStart !== -1 && blockEnd !== -1) {
  const newReplyBlock = `{msg.reply_to && msg.reply_text && (
                  <div 
                    onClick={(e) => { e.stopPropagation(); const el = document.getElementById(\`msg-\${msg.reply_to}\`); if(el) { el.scrollIntoView({behavior: 'smooth', block: 'center'}); el.classList.add('blink-once'); setTimeout(() => el.classList.remove('blink-once'), 2000); } }}
                    style={{ background: 'rgba(0,0,0,0.2)', padding: '6px 8px', borderRadius: '6px', borderLeft: '4px solid var(--primary)', marginBottom: '6px', cursor: 'pointer', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                      <span style={{ color: 'var(--primary)', fontSize: '12px', fontWeight: 'bold' }}>{msg.reply_sender === currentUser ? 'Anda' : (msg.reply_sender === chat.username ? chat.name : msg.reply_sender)}</span>
                      <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {getReplyText(msg.reply_text)}
                      </span>
                    </div>
                    {getReplyThumbnail(msg.reply_text) && (
                      <img src={getReplyThumbnail(msg.reply_text)} alt="thumbnail" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} />
                    )}
                  </div>
                )}`;
  code = code.substring(0, blockStart) + newReplyBlock + code.substring(blockEnd);
  console.log("Reply block updated!");
} else {
  console.log("Could not find reply block.");
}

fs.writeFileSync('frontend/src/ChatRoom.jsx', code);
