const fs = require('fs');
let code = fs.readFileSync('frontend/src/ChatRoom.jsx', 'utf8');

// Normalize line endings to avoid \r\n issues
code = code.replace(/\r\n/g, '\n');

// 1. Add import
if (!code.includes('import { callImoAI }')) {
  code = code.replace("import React, { useState, useEffect, useRef } from 'react';", "import React, { useState, useEffect, useRef } from 'react';\nimport { callImoAI } from './utils/aiConfig';");
}

// 2. Add State
const stateHook = "const [longPressMessage, setLongPressMessage] = useState(null);";
if (!code.includes('showMentionPopup')) {
  code = code.replace(stateHook, stateHook + "\n  const [showMentionPopup, setShowMentionPopup] = useState(false);\n  const [isAiTyping, setIsAiTyping] = useState(false);");
}

// 3. Add handleSend Logic
// Be careful with the search string, it might have different spacing.
// Let's use a regex or string index to find the end of the fetch block
const handleSendStart = code.indexOf(`const res = await fetch(\`\${API_URL}/api/messages/send\``);
const handleSendEndStr = `          setMessages(prev => prev.filter(m => m.id !== tempId));\n        }`;
const handleSendEnd = code.indexOf(handleSendEndStr, handleSendStart);

if (handleSendStart !== -1 && handleSendEnd !== -1 && !code.includes('callImoAI(chatContext, history, textToSend)')) {
  const insertIndex = handleSendEnd + handleSendEndStr.length;
  
  const aiLogic = `
        if (textToSend.includes('@ImoAI')) {
          setIsAiTyping(true);
          const chatContext = currentUser < chat.username ? currentUser + '|' + chat.username : chat.username + '|' + currentUser;
          const history = messages.slice(-10);
          callImoAI(chatContext, history, textToSend).then(async (reply) => {
            setIsAiTyping(false);
            try {
              const aiRes = await fetch(\`\${API_URL}/api/messages/send\`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sender: 'ImoAI', recipient: chat.username, text: reply, chat_context: chatContext })
              });
              const aiData = await aiRes.json();
              if (!aiData.error) {
                setMessages(prev => [...prev, { 
                  ...aiData, 
                  sender: 'ImoAI', 
                  rawDate: new Date().toISOString(),
                  time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
                  status: 'sent'
                }]);
              }
            } catch (e) {
              console.error("Failed to send AI response", e);
            }
          });
        }
`;

  code = code.substring(0, insertIndex) + aiLogic + code.substring(insertIndex);
}

// 4. Update the input onChange
const inputSearch = `          <input 
            ref={inputRef}
            type="text" 
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
            }}`;
const inputReplace = `          <input 
            ref={inputRef}
            type="text" 
            value={newMessage}
            onChange={(e) => {
              const val = e.target.value;
              setNewMessage(val);
              if (val.endsWith('@') || val.endsWith('@Imo') || val.endsWith('@imo')) {
                  setShowMentionPopup(true);
              } else {
                  setShowMentionPopup(false);
              }
            }}`;
if (!code.includes('setShowMentionPopup(true)')) {
    code = code.replace(inputSearch, inputReplace);
}

// 5. Render MentionPopup and AiTyping indicator
const formSearch = `<form onSubmit={handleSend} style={{ padding: '0 4cqw', display: 'flex', gap: '3cqw', background: 'var(--dark-surface)', borderTop: replyingTo ? 'none' : '1px solid var(--dark-border)', alignItems: 'center', minHeight: '70px', maxHeight: '70px', boxSizing: 'border-box', flexShrink: 0 }}>`;

const formReplace = `
        {isAiTyping && (
          <div style={{ padding: '4px 16px', fontSize: '12px', color: 'var(--primary)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '8px' }}>
             <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> ImoAI sedang mengetik...
          </div>
        )}
        <form onSubmit={handleSend} style={{ position: 'relative', padding: '0 4cqw', display: 'flex', gap: '3cqw', background: 'var(--dark-surface)', borderTop: replyingTo ? 'none' : '1px solid var(--dark-border)', alignItems: 'center', minHeight: '70px', maxHeight: '70px', boxSizing: 'border-box', flexShrink: 0 }}>
          {showMentionPopup && (
            <div style={{ position: 'absolute', bottom: '100%', left: '2cqw', marginBottom: '8px', background: 'var(--dark-surface)', padding: '10px 16px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: '1px solid var(--dark-border)', zIndex: 100, display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                 onClick={() => {
                     setNewMessage(prev => prev.replace(/@imo$|@Imo$|@$/, '@ImoAI '));
                     setShowMentionPopup(false);
                     inputRef.current?.focus();
                 }}>
              <div style={{ fontSize: '20px', background: 'rgba(255,255,255,0.1)', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🤖</div>
              <div style={{ color: 'white', fontWeight: 'bold', fontSize: '14px' }}>ImoAI <span style={{ color: 'var(--dark-text-muted)', fontSize: '12px', fontWeight: 'normal' }}>- Asisten AI</span></div>
            </div>
          )}`;
if (!code.includes('ImoAI sedang mengetik...')) {
    code = code.replace(formSearch, formReplace);
}

fs.writeFileSync('frontend/src/ChatRoom.jsx', code);
console.log('Done refactoring frontend ChatRoom');
