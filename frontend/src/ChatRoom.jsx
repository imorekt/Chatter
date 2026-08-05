import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, MoreVertical, Send, Image as ImageIcon, Smile, Trash2, Check, CheckCheck, Loader2, Star, X } from 'lucide-react';
import { io } from 'socket.io-client';
import { notify } from './utils/toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const formatDateDivider = (dateString) => {
  const d = new Date(dateString);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) {
    return 'Hari ini';
  } else if (d.toDateString() === yesterday.toDateString()) {
    return 'Kemarin';
  } else {
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  }
};

const ChatRoom = ({ chat, onBack, currentUser, isFriend }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null); // popup for individual message (legacy)
  const [loading, setLoading] = useState(true);
  const [debugError, setDebugError] = useState(null);

  // Selection Mode State
  const [showMenu, setShowMenu] = useState(false);
  const [selectionMode, setSelectionMode] = useState(null); // 'favorite' | 'delete' | null
  const [selectedMessages, setSelectedMessages] = useState(new Set());

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const socketRef = useRef(null);
  const fileInputRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const scrollToBottom = () => {
    if (!selectionMode) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    fetch(`${API_URL}/api/messages/${currentUser}/${chat.username}`)
      .then(res => res.json())
      .then(data => {
        const history = data.map(m => {
          const rawDate = typeof m.created_at === 'string' && !m.created_at.includes('T') ? m.created_at.replace(' ', 'T') + 'Z' : m.created_at;
          return {
            id: m.id,
            text: m.text,
            sender: m.sender === currentUser ? 'me' : 'them',
            time: new Date(rawDate).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).replace(/\./g, ':'),
            rawDate: rawDate,
            status: (!isFriend) ? 'sent' : (m.is_read ? 'read' : 'delivered')
          };
        });
        setMessages(history);
        setLoading(false);
        markMessagesRead();
      })
      .catch(err => {
        console.error(err);
        setDebugError(err.message || String(err));
        setLoading(false);
      });

    socketRef.current = io(API_URL);
    socketRef.current.emit('user_login', currentUser);

    socketRef.current.on('receive_message', (data) => {
      if (
        (data.sender === chat.username && data.recipient === currentUser) ||
        (data.sender === currentUser && data.recipient === chat.username)
      ) {
        setMessages(prev => [...prev, {
          id: data.timestamp || Date.now(),
          text: data.text,
          sender: data.sender === currentUser ? 'me' : 'them',
          time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).replace(/\./g, ':'),
          rawDate: new Date().toISOString(),
          status: (!isFriend) ? 'sent' : 'delivered'
        }]);

        if (data.recipient === currentUser) {
          markMessagesRead();
        }
      }
    });

    socketRef.current.on('messages_read_update', (data) => {
      if (data.sender === chat.username && data.recipient === currentUser) {
        setMessages(prev => prev.map(m => m.sender === 'me' ? { ...m, status: 'read' } : m));
      }
    });

    socketRef.current.on('typing_status', (data) => {
      if (data.sender === chat.username && data.recipient === currentUser) {
        setIsTyping(data.isTyping);
      }
    });

    return () => socketRef.current.disconnect();
  }, [currentUser, chat.username]);

  const markMessagesRead = () => {
    fetch(`${API_URL}/api/messages/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: chat.username, receiver: currentUser })
    }).catch(console.error);

    if (socketRef.current) {
      socketRef.current.emit('messages_read', { sender: currentUser, recipient: chat.username });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    if (inputRef.current && !chat.isDeleted && !selectionMode) {
      inputRef.current.focus();
    }
  }, [chat, selectionMode]);

  let typingTimeout = null;
  const handleTyping = () => {
    if (socketRef.current) {
      socketRef.current.emit('typing', { sender: currentUser, recipient: chat.username, isTyping: true });
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        socketRef.current.emit('typing', { sender: currentUser, recipient: chat.username, isTyping: false });
      }, 1000);
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return notify.error('Pesan tidak boleh kosong.');

    if (socketRef.current) {
      socketRef.current.emit('send_message', {
        sender: currentUser,
        recipient: chat.username,
        text: newMessage,
        timestamp: Date.now()
      });
      socketRef.current.emit('typing', { sender: currentUser, recipient: chat.username, isTyping: false });
    }
    setNewMessage('');
  };

  const handleImageUpload = () => {
    setIsImageUploading(true);
    setTimeout(() => {
      setIsImageUploading(false);
      notify.error('Gagal mengirim gambar. Fitur belum didukung.');
    }, 2000);
  };

  const toggleSelection = (id) => {
    const newSet = new Set(selectedMessages);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedMessages(newSet);
  };

  const executeBulkAction = async () => {
    if (selectedMessages.size === 0) return notify.error('Pilih setidaknya satu pesan');
    const messageIds = Array.from(selectedMessages);

    if (selectionMode === 'favorite') {
      try {
        const res = await fetch(`${API_URL}/api/messages/favorite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: currentUser, messageIds })
        });
        if (res.ok) {
          notify.success('Berhasil DiFavoritkan');
          setSelectionMode(null);
          setSelectedMessages(new Set());
        } else {
          notify.error('Gagal menyimpan favorit');
        }
      } catch (err) {
        notify.error('Kesalahan jaringan');
      }
    } else if (selectionMode === 'delete') {
      if (!window.confirm('Apakah Anda yakin ingin menghapus pesan yang dipilih?')) return;
      try {
        const res = await fetch(`${API_URL}/api/messages/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageIds })
        });
        if (res.ok) {
          setMessages(messages.filter(m => !selectedMessages.has(m.id)));
          notify.success('Pesan berhasil dihapus');
          setSelectionMode(null);
          setSelectedMessages(new Set());
        } else {
          notify.error('Gagal menghapus pesan');
        }
      } catch (err) {
        notify.error('Kesalahan jaringan');
      }
    }
  };

  const renderMessages = () => {
    const elements = [];
    let lastDateLabel = null;

    messages.forEach((msg, index) => {
      const currentLabel = formatDateDivider(msg.rawDate);
      if (currentLabel !== lastDateLabel) {
        elements.push(
          <div key={`date-${currentLabel}-${index}`} style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 16px 0' }}>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', color: 'var(--dark-text-muted)' }}>
              {currentLabel}
            </div>
          </div>
        );
        lastDateLabel = currentLabel;
      }

      elements.push(
        <div key={msg.id + '-' + index} style={{
          alignSelf: msg.sender === 'me' ? 'flex-end' : 'flex-start',
          maxWidth: '80%',
          position: 'relative'
        }}>

          <div style={{
            background: msg.sender === 'me' ? '#005c4b' : '#202c33',
            color: '#e9edef',
            padding: '6px 7px 8px 9px',
            borderRadius: '7.5px',
            borderTopRightRadius: msg.sender === 'me' ? '0px' : '7.5px',
            borderTopLeftRadius: msg.sender === 'me' ? '7.5px' : '0px',
            fontSize: '14.2px',
            lineHeight: '19px',
            cursor: selectionMode ? 'pointer' : 'default',
            wordBreak: 'break-word',
            flex: selectionMode ? '0 1 auto' : 'initial',
            boxShadow: '0 1px 0.5px rgba(11,20,26,.13)',
            display: 'inline-block',
            position: 'relative'
          }} onClick={() => { if (selectionMode) toggleSelection(msg.id); }}>
            {selectionMode && (
              <div style={{
                position: 'absolute',
                top: '-8px',
                right: '-8px',
                background: 'var(--dark-surface)',
                borderRadius: '50%',
                padding: '2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                zIndex: 10
              }}>
                <input
                  type="checkbox"
                  checked={selectedMessages.has(msg.id)}
                  readOnly
                  style={{ pointerEvents: 'none', width: '16px', height: '16px', margin: 0 }}
                />
              </div>
            )}
            <span style={{ display: 'inline-block', paddingRight: msg.sender === 'me' ? '65px' : '45px', paddingBottom: '8px' }}>
              {msg.text}
            </span>
            <div style={{
              position: 'absolute',
              bottom: '4px',
              right: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              color: 'rgba(255,255,255,0.6)'
            }}>
              {msg.time}
              {msg.sender === 'me' && (
                msg.status === 'sent' ? <Check size={15} /> : <CheckCheck size={15} color={msg.status === 'read' ? '#53bdeb' : 'currentColor'} />
              )}
            </div>
          </div>
        </div>
      );
    });
    return elements;
  };

  return (
    <div className="chat-app" style={{ zIndex: 50, position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'transparent' }}>
      {/* Header */}
      <div className="chat-header-bar" style={{ position: 'relative', zIndex: 60, padding: '16px 20px', borderBottom: '1px solid var(--dark-border)', background: 'var(--dark-surface)', display: 'flex', justifyContent: 'space-between' }}>
        {selectionMode ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '100%' }}>
            <X size={24} style={{ cursor: 'pointer', color: 'white' }} onClick={() => { setSelectionMode(null); setSelectedMessages(new Set()); }} />
            <span style={{ fontSize: '16px', fontWeight: 600, color: 'white' }}>{selectedMessages.size} dipilih</span>
            <div style={{ flex: 1 }} />
            <button onClick={executeBulkAction} style={{ background: selectionMode === 'favorite' ? 'var(--primary)' : '#EF4444', border: 'none', padding: '6px 16px', borderRadius: '8px', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
              {selectionMode === 'favorite' ? 'Simpan' : 'Hapus'}
            </button>
          </div>
        ) : (
          <>
            <div className="header-left" style={{ gap: '16px' }}>
              <ArrowLeft size={24} style={{ cursor: 'pointer', color: 'white' }} onClick={onBack} />
              <div className="avatar-container" style={{ width: 40, height: 40 }}>
                {chat.isDeleted ? (
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#3f3f46', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#a1a1aa', fontWeight: 'bold' }}>
                    X
                  </div>
                ) : chat.avatar ? (
                  <img src={chat.avatar} alt={chat.name} className="avatar" />
                ) : (
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #A48BFF, #651FFF)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontWeight: 'bold' }}>
                    {chat.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '16px', fontWeight: 600, color: 'white' }}>{chat.name}</span>
                <span style={{ fontSize: '12px', color: isTyping ? 'var(--primary)' : 'var(--dark-text-muted)', fontStyle: isTyping ? 'italic' : 'normal', fontWeight: isTyping ? 500 : 'normal' }}>
                  {isTyping ? (
                    <>Sedang mengetik<span className="typing-dots"></span></>
                  ) : (
                    chat.isDeleted ? 'Akun telah dihapus' : (chat.isSystem ? 'Sistem Chat' : (isFriend ? 'Berteman' : 'Tidak berteman'))
                  )}
                </span>
              </div>
            </div>
            <div className="header-actions" style={{ position: 'relative', display: 'flex', alignItems: 'center' }} ref={menuRef}>
              <div onClick={() => setShowMenu(!showMenu)} style={{ cursor: 'pointer', display: 'flex', padding: '4px' }}>
                <MoreVertical size={24} />
              </div>
              {showMenu && (
                <div style={{ position: 'absolute', top: '100%', right: 0, background: 'var(--dark-surface)', border: '1px solid var(--dark-border)', borderRadius: '8px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px', zIndex: 60, minWidth: '120px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                  <button onClick={() => { setSelectionMode('favorite'); setShowMenu(false); }} style={{ background: 'transparent', border: 'none', color: 'white', padding: '8px 12px', textAlign: 'left', cursor: 'pointer', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Star size={16} /> Favorite
                  </button>
                  <button onClick={() => { setSelectionMode('delete'); setShowMenu(false); }} style={{ background: 'transparent', border: 'none', color: '#EF4444', padding: '8px 12px', textAlign: 'left', cursor: 'pointer', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Trash2 size={16} /> Delete
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Messages Area */}
      <div className="chat-list" style={{ flex: 1, padding: '4px 16px 20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
        {loading && <div style={{ textAlign: 'center', marginTop: '20px' }}><Loader2 className="animate-spin" color="var(--primary)" /></div>}

        {!loading && messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--dark-text-muted)', marginTop: '40px', fontSize: '14px' }}>
            Belum ada pesan. Mulai obrolan dengan {chat.name} ({chat.username || 'NO_USERNAME'})!
            {debugError && <div style={{ color: 'red', marginTop: '10px' }}>Error: {debugError}</div>}
          </div>
        )}

        {renderMessages()}

        {isTyping && (
          <div style={{ alignSelf: 'flex-start', background: 'var(--dark-surface)', padding: '12px 16px', borderRadius: '16px', borderBottomLeftRadius: '4px', display: 'flex', gap: '4px' }}>
            <div className="typing-dot" style={{ width: 6, height: 6, background: 'var(--dark-text-muted)', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both' }}></div>
            <div className="typing-dot" style={{ width: 6, height: 6, background: 'var(--dark-text-muted)', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '0.2s' }}></div>
            <div className="typing-dot" style={{ width: 6, height: 6, background: 'var(--dark-text-muted)', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '0.4s' }}></div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer (Hidden in Selection Mode) */}
      {!selectionMode && (
        <form onSubmit={handleSend} style={{ padding: '16px 20px', display: 'flex', gap: '12px', background: 'var(--dark-surface)', borderTop: '1px solid var(--dark-border)', alignItems: 'center' }}>
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={handleImageUpload}
            disabled={chat.isDeleted}
          />
          <ImageIcon
            size={24}
            style={{ cursor: chat.isDeleted ? 'not-allowed' : 'pointer', color: chat.isDeleted ? '#52525b' : 'var(--dark-text-muted)' }}
            onClick={() => !chat.isDeleted && fileInputRef.current?.click()}
          />
          <input
            ref={inputRef}
            autoFocus
            type="text"
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              handleTyping();
            }}
            placeholder={chat.isDeleted ? "Anda tidak dapat membalas percakapan ini" : "Ketik pesan..."}
            disabled={chat.isDeleted}
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.05)',
              border: 'none',
              borderRadius: '20px',
              padding: '12px 16px',
              color: chat.isDeleted ? '#a1a1aa' : 'white',
              outline: 'none',
              fontSize: '14px',
              cursor: chat.isDeleted ? 'not-allowed' : 'text'
            }}
          />
          <button type="submit" disabled={chat.isDeleted} style={{
            background: chat.isDeleted ? '#3f3f46' : 'var(--primary)',
            border: 'none',
            width: 40,
            height: 40,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: chat.isDeleted ? 'not-allowed' : 'pointer',
            color: chat.isDeleted ? '#52525b' : 'white'
          }}>
            <Send size={18} style={{ marginLeft: '2px' }} />
          </button>
        </form>
      )}

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      `}} />
    </div>
  );
};

export default ChatRoom;
