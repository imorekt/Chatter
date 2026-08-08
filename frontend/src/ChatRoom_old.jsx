import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, MoreVertical, Send, Image as ImageIcon, Smile, Trash2, Check, CheckCheck, Loader2, Star, X, ImageOff } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';

import { notify } from './utils/toast';

const API_URL = window.APP_CONFIG?.API_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001';

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

const ChatRoom = ({ chat, onBack, currentUser }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null); // popup for individual message (legacy)
  const [loading, setLoading] = useState(true);
  
  // Selection Mode State
  const [showMenu, setShowMenu] = useState(false);
  const [selectionMode, setSelectionMode] = useState(null); // 'favorite' | 'delete' | null
  const [selectedMessages, setSelectedMessages] = useState(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageCaption, setImageCaption] = useState('');
  const [previewModalImage, setPreviewModalImage] = useState(null);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const socketRef = useRef(null);
  const fileInputRef = useRef(null);
  const menuRef = useRef(null);
  const emojiPickerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showEmojiPicker]);

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
            status: m.is_read ? 'read' : 'delivered'
          };
        });
        setMessages(history);
        setLoading(false);
        markMessagesRead();
      })
      .catch(err => {
        console.error(err);
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
          id: data.id || data.timestamp || Date.now(),
          text: data.text,
          sender: data.sender === currentUser ? 'me' : 'them',
          time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).replace(/\./g, ':'),
          rawDate: new Date().toISOString(),
          status: 'delivered'
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

  const typingTimeoutRef = useRef(null);
  const handleTyping = () => {
    if (socketRef.current) {
      socketRef.current.emit('typing', { sender: currentUser, recipient: chat.username, isTyping: true });
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socketRef.current.emit('typing', { sender: currentUser, recipient: chat.username, isTyping: false });
      }, 1500);
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

  const handleImageUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      return notify.error('Tolong pilih file gambar (JPG/PNG).');
    }

    if (file.size > 15 * 1024 * 1024) {
      return notify.error('Ukuran gambar maksimal 15MB.');
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1000;
        const MAX_HEIGHT = 1000;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round(height * (MAX_WIDTH / width));
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round(width * (MAX_HEIGHT / height));
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.75);
        setSelectedImage(compressedBase64);
        setImageCaption('');
      };
      img.onerror = () => {
        setSelectedImage(reader.result);
        setImageCaption('');
      };
      img.src = reader.result;
    };
    reader.onerror = () => {
      notify.error('Gagal membaca gambar.');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const confirmSendImage = () => {
    if (!selectedImage) return;
    const textToSend = imageCaption.trim() ? `${selectedImage}|||CAPTION|||${imageCaption.trim()}` : selectedImage;
    if (socketRef.current) {
      socketRef.current.emit('send_message', {
        sender: currentUser,
        recipient: chat.username,
        text: textToSend,
        timestamp: Date.now()
      });
      notify.success('Gambar berhasil dikirim!');
    }
    setSelectedImage(null);
    setImageCaption('');
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
      setShowDeleteModal(true);
    }
  };

  const confirmDeleteMessages = async () => {
    const messageIds = Array.from(selectedMessages);
    setIsDeleting(true);
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
        setShowDeleteModal(false);
      } else {
        notify.error('Gagal menghapus pesan');
      }
    } catch (err) {
      notify.error('Kesalahan jaringan');
    } finally {
      setIsDeleting(false);
    }
  };

  const renderMediaContent = (msgId, rawText, isMe) => {
    if (typeof rawText !== 'string') return rawText;

    let base64Part = null;
    let captionPart = null;
    let isMediaSaved = false;

    if (rawText.includes('|||CAPTION|||')) {
      const parts = rawText.split('|||CAPTION|||');
      base64Part = parts[0];
      captionPart = parts[1];
    } else {
      base64Part = rawText;
    }

    if (base64Part.startsWith('data:image/')) {
      try {
        localStorage.setItem(`chat_media_${msgId}`, base64Part);
        if (!isMe) {
          fetch(`${API_URL}/api/messages/clear-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageId: msgId })
          }).catch(() => {});
        }
      } catch (e) {}
      isMediaSaved = true;
    } else if (base64Part === 'MEDIA_LOCAL_SAVED') {
      const localMedia = localStorage.getItem(`chat_media_${msgId}`);
      if (localMedia) {
        base64Part = localMedia;
        isMediaSaved = true;
      } else {
        isMediaSaved = false;
      }
    } else {
      return rawText;
    }

    return (
      <div>
        {isMediaSaved ? (
          <img 
            src={base64Part} 
            alt="Gambar" 
            onClick={(e) => {
              e.stopPropagation();
              if (!selectionMode) setPreviewModalImage(base64Part);
            }}
            style={{ 
              maxWidth: '55cqw', 
              maxHeight: '40cqh', 
              borderRadius: '2cqw', 
              display: 'block', 
              margin: '0.5cqh 0', 
              objectFit: 'cover',
              cursor: selectionMode ? 'pointer' : 'zoom-in',
              transition: 'transform 0.15s ease'
            }} 
          />
        ) : (
          <div style={{ padding: '1.5cqh 2.5cqw', background: 'rgba(0,0,0,0.2)', borderRadius: '2cqw', color: '#a1a1aa', display: 'flex', alignItems: 'center', gap: '2cqw', fontSize: 'var(--font-caption)', border: '1px dashed rgba(255,255,255,0.2)', margin: '0.5cqh 0' }}>
            <ImageOff size={18} color="#ef4444" />
            <span>Gambar tidak ditemukan</span>
          </div>
        )}
        {captionPart && <div style={{ marginTop: '1cqh', color: '#e9edef' }}>{captionPart}</div>}
      </div>
    );
  };

  const renderMessages = () => {
    const elements = [];
    let lastDateLabel = null;

    messages.forEach((msg, index) => {
      const currentLabel = formatDateDivider(msg.rawDate);
      if (currentLabel !== lastDateLabel) {
        elements.push(
          <div key={`date-${currentLabel}-${index}`} style={{ display: 'flex', justifyContent: 'center', margin: 'var(--sp-md) 0' }}>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '0.5cqh 3cqw', borderRadius: 'var(--radius)', fontSize: 'var(--font-caption)', color: 'var(--dark-text-muted)' }}>
              {currentLabel}
            </div>
          </div>
        );
        lastDateLabel = currentLabel;
      }

      elements.push(
        <div key={msg.id} style={{
          alignSelf: msg.sender === 'me' ? 'flex-end' : 'flex-start',
          maxWidth: '80%',
          position: 'relative'
        }}>
          <div style={{
            background: msg.sender === 'me' ? '#005c4b' : '#202c33',
            color: '#e9edef',
            padding: '1.5cqh 1.8cqw 2cqh 2.3cqw',
            borderRadius: '2cqw',
            borderTopRightRadius: msg.sender === 'me' ? '0px' : '2cqw',
            borderTopLeftRadius: msg.sender === 'me' ? '2cqw' : '0px',
            fontSize: 'var(--font-body)',
            lineHeight: '1.4',
            cursor: selectionMode ? 'pointer' : 'default',
            wordBreak: 'break-word',
            boxShadow: '0 1px 0.5px rgba(11,20,26,.13)',
            position: 'relative'
          }} onClick={() => { if(selectionMode) toggleSelection(msg.id); }}>
            {selectionMode && (
              <input 
                type="checkbox" 
                checked={selectedMessages.has(msg.id)} 
                onChange={() => toggleSelection(msg.id)}
                onClick={(e) => e.stopPropagation()}
                style={{ position: 'absolute', top: '1cqh', right: '1.8cqw', width: '4.2cqw', height: '4.2cqw', cursor: 'pointer', zIndex: 10 }}
              />
            )}
            <span style={{ display: 'inline-block', paddingRight: msg.sender === 'me' ? '7.5cqw' : '4.5cqw', paddingBottom: '2cqh' }}>
              {renderMediaContent(msg.id, msg.text, msg.sender === 'me')}
            </span>
            <div style={{ 
              position: 'absolute',
              bottom: '1cqh',
              right: '2cqw',
              display: 'flex', 
              alignItems: 'center', 
              gap: '1cqw',
              fontSize: 'var(--font-caption)',
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
      <div className="chat-header-bar" style={{ position: 'relative', zIndex: 60, height: '8.5cqh', minHeight: '72px', maxHeight: '72px', padding: '0 var(--pad-h)', borderBottom: '1px solid var(--dark-border)', background: 'var(--dark-surface)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxSizing: 'border-box', flexShrink: 0 }}>
        {selectionMode ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4cqw', width: '100%' }}>
            <X size={24} style={{ cursor: 'pointer', color: 'white' }} onClick={() => { setSelectionMode(null); setSelectedMessages(new Set()); }} />
            <span style={{ fontSize: 'var(--font-body)', fontWeight: 600, color: 'white' }}>{selectedMessages.size} dipilih</span>
            <div style={{ flex: 1 }} />
            <button onClick={executeBulkAction} style={{ background: selectionMode === 'favorite' ? 'var(--primary)' : '#EF4444', border: 'none', padding: '1.5cqh 4cqw', borderRadius: '2cqw', color: 'white', fontWeight: 600, cursor: 'pointer' }}>
              {selectionMode === 'favorite' ? 'Favorit' : 'Hapus'}
            </button>
          </div>
        ) : (
          <>
            <div className="header-left" style={{ gap: '4cqw' }}>
              <ArrowLeft size={24} style={{ cursor: 'pointer', color: 'white' }} onClick={onBack} />
              <div className="avatar-container" style={{ width: '10cqw', height: '10cqw' }}>
                {chat.isDeleted ? (
                  <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#3f3f46', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#a1a1aa', fontWeight: 'bold' }}>
                    X
                  </div>
                ) : chat.avatar ? (
                  <img src={chat.avatar} alt={chat.name} className="avatar" />
                ) : (
                  <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'linear-gradient(135deg, #A48BFF, #651FFF)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontWeight: 'bold' }}>
                    {chat.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 'var(--font-body)', fontWeight: 600, color: chat.isDeleted ? '#a1a1aa' : 'white', fontStyle: chat.isDeleted ? 'italic' : 'normal' }}>
                  {chat.isDeleted ? 'Deleted Account' : chat.name}
                </span>
                <span style={{ fontSize: 'var(--font-caption)', color: isTyping ? 'var(--primary)' : 'var(--dark-text-muted)', fontStyle: isTyping ? 'italic' : 'normal', fontWeight: isTyping ? 500 : 'normal' }}>
                  {isTyping ? (
                    <>Sedang mengetik<span className="typing-dots"></span></>
                  ) : (
                    chat.isDeleted ? 'Akun telah dihapus' : (chat.isSystem ? 'Sistem Chat' : 'Berteman')
                  )}
                </span>
              </div>
            </div>
            <div className="header-actions" style={{ position: 'relative', display: 'flex', alignItems: 'center' }} ref={menuRef}>
              <div onClick={() => setShowMenu(!showMenu)} style={{ cursor: 'pointer', display: 'flex', padding: '1cqw' }}>
                <MoreVertical size={24} />
              </div>
              {showMenu && (
                <div style={{ position: 'absolute', top: '100%', right: 0, background: 'var(--dark-surface)', border: '1px solid var(--dark-border)', borderRadius: '2cqw', padding: '2cqw', display: 'flex', flexDirection: 'column', gap: '1cqw', zIndex: 60, minWidth: '30cqw', boxShadow: '0 1cqh 3cqh rgba(0,0,0,0.5)' }}>
                  <button onClick={() => { setSelectionMode('favorite'); setShowMenu(false); }} style={{ background: 'transparent', border: 'none', color: 'white', padding: '2cqw 3cqw', textAlign: 'left', cursor: 'pointer', borderRadius: '1cqw', display: 'flex', alignItems: 'center', gap: '2cqw' }}>
                    <Star size={16} /> Favorite
                  </button>
                  <button onClick={() => { setSelectionMode('delete'); setShowMenu(false); }} style={{ background: 'transparent', border: 'none', color: '#EF4444', padding: '2cqw 3cqw', textAlign: 'left', cursor: 'pointer', borderRadius: '1cqw', display: 'flex', alignItems: 'center', gap: '2cqw' }}>
                    <Trash2 size={16} /> Delete
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Messages Area */}
      <div className="chat-list hide-scrollbar" style={{ flex: 1, padding: '5cqh 4cqw', display: 'flex', flexDirection: 'column', gap: '4cqw', overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {loading && <div style={{ textAlign: 'center', marginTop: '5cqh' }}><Loader2 className="animate-spin" color="var(--primary)" /></div>}
        
        {!loading && messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--dark-text-muted)', marginTop: '10cqh', fontSize: 'var(--font-body)' }}>
            Belum ada pesan. Mulai obrolan dengan {chat.name}!
          </div>
        )}

        {renderMessages()}

        {isTyping && (
          <div style={{ alignSelf: 'flex-start', background: 'var(--dark-surface)', padding: '3cqh 4cqw', borderRadius: '4cqw', borderBottomLeftRadius: '1cqw', display: 'flex', gap: '1cqw' }}>
            <div className="typing-dot" style={{ width: '1.5cqw', height: '1.5cqw', background: 'var(--dark-text-muted)', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both' }}></div>
            <div className="typing-dot" style={{ width: '1.5cqw', height: '1.5cqw', background: 'var(--dark-text-muted)', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '0.2s' }}></div>
            <div className="typing-dot" style={{ width: '1.5cqw', height: '1.5cqw', background: 'var(--dark-text-muted)', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both', animationDelay: '0.4s' }}></div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <form onSubmit={handleSend} style={{ padding: '3cqh 4cqw', display: 'flex', gap: '3cqw', background: 'var(--dark-surface)', borderTop: '1px solid var(--dark-border)', alignItems: 'center', minHeight: '85px', maxHeight: '85px', boxSizing: 'border-box', flexShrink: 0 }}>
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleImageUpload}
          disabled={chat.isDeleted || !!selectionMode}
        />
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <ImageIcon 
            size={24} 
            style={{ cursor: (chat.isDeleted || selectionMode) ? 'not-allowed' : 'pointer', color: (chat.isDeleted || selectionMode) ? '#52525b' : 'var(--dark-text-muted)', display: 'block' }} 
            onClick={() => !chat.isDeleted && !selectionMode && fileInputRef.current?.click()} 
          />
        </div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }} ref={emojiPickerRef}>
          <Smile
            size={24}
            style={{ cursor: (chat.isDeleted || selectionMode) ? 'not-allowed' : 'pointer', color: (chat.isDeleted || selectionMode) ? '#52525b' : showEmojiPicker ? 'var(--primary)' : 'var(--dark-text-muted)', display: 'block' }}
            onClick={() => !chat.isDeleted && !selectionMode && setShowEmojiPicker(!showEmojiPicker)}
          />
          {showEmojiPicker && !chat.isDeleted && !selectionMode && (
            <div style={{ position: 'absolute', bottom: '10cqh', left: '0', zIndex: 50 }}>
              <EmojiPicker 
                onEmojiClick={(emojiObject) => {
                  setNewMessage(prev => prev + emojiObject.emoji);
                }}
                theme="dark"
                searchDisabled={true}
                skinTonesDisabled={true}
              />
            </div>
          )}
        </div>
        <input 
          ref={inputRef}
          type="text" 
          value={newMessage}
          onChange={(e) => {
            setNewMessage(e.target.value);
            handleTyping();
          }}
          placeholder={chat.isDeleted ? "Anda tidak dapat membalas percakapan ini" : "Ketik pesan..."}
          disabled={chat.isDeleted || !!selectionMode}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.05)',
            border: 'none',
            borderRadius: '5cqw',
            padding: '2cqh 4cqw',
            color: (chat.isDeleted || selectionMode) ? '#a1a1aa' : 'white',
            outline: 'none',
            fontSize: 'var(--font-body)',
            cursor: (chat.isDeleted || selectionMode) ? 'not-allowed' : 'text'
          }}
        />
        <button type="submit" disabled={chat.isDeleted || !!selectionMode} style={{ 
          background: (chat.isDeleted || selectionMode) ? '#3f3f46' : 'var(--primary)', 
          border: 'none', 
          width: '9.5cqw', 
          height: '9.5cqw', 
          borderRadius: '50%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          cursor: (chat.isDeleted || selectionMode) ? 'not-allowed' : 'pointer',
          color: (chat.isDeleted || selectionMode) ? '#52525b' : 'white',
          flexShrink: 0
        }}>
          <Send size={18} style={{ marginLeft: '0.5cqw' }} />
        </button>
      </form>
      
      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div style={{ 
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 1000, padding: '5cqw'
        }}>
          <div style={{ 
            background: 'var(--dark-surface)', 
            padding: '5cqw', 
            borderRadius: '4cqw', 
            width: '90%', 
            border: '1px solid var(--dark-border)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
            <h3 style={{ margin: '0 0 3cqh 0', fontSize: 'var(--font-title)', color: 'white' }}>
              Hapus Pesan?
            </h3>
            <p style={{ color: 'var(--dark-text-muted)', fontSize: 'var(--font-body)', marginBottom: '4cqh', lineHeight: '1.5' }}>
              Anda yakin ingin menghapus pesan yang dipilih? Pesan yang dihapus tidak dapat dikembalikan.
            </p>
            <div style={{ display: 'flex', gap: '3cqw' }}>
              <button onClick={() => setShowDeleteModal(false)} disabled={isDeleting} style={{ flex: 1, padding: '1.5cqh 3cqw', background: 'transparent', border: '1px solid var(--dark-border)', color: 'white', borderRadius: '2cqw', cursor: 'pointer', opacity: isDeleting ? 0.5 : 1, fontSize: 'var(--font-body)' }}>
                Batal
              </button>
              <button onClick={confirmDeleteMessages} disabled={isDeleting} style={{ flex: 1, padding: '1.5cqh 3cqw', background: '#EF4444', border: 'none', color: 'white', borderRadius: '2cqw', cursor: 'pointer', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2cqw', opacity: isDeleting ? 0.7 : 1, fontSize: 'var(--font-body)' }}>
                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview & Caption Modal */}
      {selectedImage && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)',
          display: 'flex', flexDirection: 'column', zIndex: 1000,
          boxSizing: 'border-box'
        }}>
          {/* Top Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3cqh 4cqw' }}>
            <span style={{ color: 'white', fontWeight: 600, fontSize: 'var(--font-title)' }}>Kirim Gambar</span>
            <X size={24} color="white" style={{ cursor: 'pointer' }} onClick={() => { setSelectedImage(null); setImageCaption(''); }} />
          </div>

          {/* Image Preview Container */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2cqh 4cqw', overflow: 'hidden' }}>
            <img 
              src={selectedImage} 
              alt="Preview" 
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                display: 'block',
                objectFit: 'contain',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                boxShadow: 'none',
                borderRadius: 0
              }} 
            />
          </div>

          {/* Caption Input & Send Controls */}
          <div style={{ padding: '2.5cqh 4cqw', display: 'flex', gap: '3cqw', background: 'var(--dark-surface)', borderTop: '1px solid var(--dark-border)', alignItems: 'center' }}>
            <input 
              type="text" 
              value={imageCaption}
              onChange={(e) => setImageCaption(e.target.value)}
              placeholder="Tambah keterangan (opsional)..."
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') confirmSendImage(); }}
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.05)',
                border: 'none',
                borderRadius: '5cqw',
                padding: '2cqh 4cqw',
                color: 'white',
                outline: 'none',
                fontSize: 'var(--font-body)'
              }}
            />
            <button 
              onClick={confirmSendImage} 
              style={{ 
                background: 'var(--primary)', 
                border: 'none', 
                width: '9.5cqw', 
                height: '9.5cqw', 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'white',
                flexShrink: 0
              }}
            >
              <Send size={18} style={{ marginLeft: '0.5cqw' }} />
            </button>
          </div>
        </div>
      )}

      {/* Image Preview Lightbox Modal */}
      {previewModalImage && (
        <div 
          onClick={() => setPreviewModalImage(null)}
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.9)', backdropFilter: 'blur(8px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 1000, padding: '4cqw', boxSizing: 'border-box'
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <div 
              style={{ 
                position: 'absolute', top: '-1.5cqh', right: '-1.5cqw', 
                background: 'var(--primary)', width: '7cqw', height: '7cqw', 
                borderRadius: '50%', display: 'flex', justifyContent: 'center', 
                alignItems: 'center', cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', zIndex: 10 
              }} 
              onClick={() => setPreviewModalImage(null)}
            >
              <X size={16} color="white" />
            </div>
            <img 
              src={previewModalImage} 
              alt="Preview" 
              style={{
                maxWidth: '85cqw',
                maxHeight: '75cqh',
                display: 'block',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                boxShadow: 'none',
                borderRadius: 0
              }} 
            />
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      `}} />
    </div>
  );
};

export default ChatRoom;

