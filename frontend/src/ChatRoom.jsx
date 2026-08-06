import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, MoreVertical, Send, Image as ImageIcon, Smile, Trash2, Check, CheckCheck, Loader2, Star, X, ImageOff, Ban, Edit2 } from 'lucide-react';
import EmojiPicker, { Categories } from 'emoji-picker-react';
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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null); // popup for individual message (legacy)
  const [loading, setLoading] = useState(true);
  
  // Long Press State
  const [longPressMessage, setLongPressMessage] = useState(null);
  const [showEditModal, setShowEditModal] = useState(null);
  const [editMessageText, setEditMessageText] = useState('');
  const [showDeleteActionModal, setShowDeleteActionModal] = useState(null);
  const pressTimer = useRef(null);
  
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
  // removed socketRef
  const fileInputRef = useRef(null);
  const menuRef = useRef(null);
  const emojiPickerRef = useRef(null);

  useEffect(() => {
    const handleHardwareBack = (e) => {
      e.preventDefault();
      if (previewModalImage) {
        setPreviewModalImage(null);
      } else if (selectedImage) {
        setSelectedImage(null);
        setImageCaption('');
      } else if (showEditModal || showDeleteActionModal || showDeleteModal) {
        setShowEditModal(null);
        setShowDeleteActionModal(null);
        setShowDeleteModal(false);
      } else if (showEmojiPicker) {
        setShowEmojiPicker(false);
      } else if (showMenu) {
        setShowMenu(false);
      } else if (selectionMode) {
        setSelectionMode(null);
        setSelectedMessages(new Set());
      } else {
        onBack();
      }
    };
    window.addEventListener('hardwareBack', handleHardwareBack);
    return () => window.removeEventListener('hardwareBack', handleHardwareBack);
  }, [previewModalImage, selectedImage, showEditModal, showDeleteActionModal, showDeleteModal, showEmojiPicker, showMenu, selectionMode, onBack]);

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

  const fetchMessages = () => {
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
            status: (!isFriend) ? 'sent' : (m.is_read ? 'read' : 'delivered'),
            is_edited: m.is_edited,
            is_deleted_everyone: m.is_deleted_everyone
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
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [currentUser, chat.username]);

  const markMessagesRead = () => {
    fetch(`${API_URL}/api/messages/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: chat.username, receiver: currentUser })
    }).catch(console.error);
  };

  const lastMessageId = messages.length > 0 ? messages[messages.length - 1].id : null;

  useEffect(() => {
    scrollToBottom();
  }, [lastMessageId, isTyping]);

  useEffect(() => {
    if (inputRef.current && !chat.isDeleted && !selectionMode) {
      inputRef.current.focus();
    }
  }, [chat, selectionMode]);

  const handleTyping = () => {
    // Polling mode: Fitur typing dimatikan agar hemat request
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return notify.error('Pesan tidak boleh kosong.');
    
    const textToSend = newMessage;
    setNewMessage('');
    try {
      await fetch(`${API_URL}/api/messages/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: currentUser, recipient: chat.username, text: textToSend })
      });
      fetchMessages();
    } catch (err) {
      notify.error("Gagal mengirim pesan");
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        setSelectedImage(canvas.toDataURL('image/jpeg', 0.6));
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

  const confirmSendImage = async () => {
    if (!selectedImage) return;
    const textToSend = imageCaption.trim() ? `${selectedImage}|||CAPTION|||${imageCaption.trim()}` : selectedImage;
    try {
      await fetch(`${API_URL}/api/messages/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: currentUser, recipient: chat.username, text: textToSend })
      });
      notify.success('Gambar berhasil dikirim!');
      fetchMessages();
    } catch (err) {
      notify.error('Gagal kirim gambar');
    }
    setSelectedImage(null);
    setImageCaption('');
  };

  const handlePressStart = (msg) => {
    if (selectionMode) return;
    pressTimer.current = setTimeout(() => {
      setLongPressMessage(msg);
      if (navigator.vibrate) navigator.vibrate(50);
    }, 500);
  };

  const handlePressEnd = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
  };

  const handleEditSubmit = async () => {
    if (!editMessageText.trim() || !showEditModal) return;
    await fetch(`${API_URL}/api/messages/edit`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: showEditModal.id, sender: currentUser, text: editMessageText })
    });
    fetchMessages();
    setShowEditModal(null);
  };

  const handleDeleteForMe = async (msgId) => {
    const res = await fetch(`${API_URL}/api/messages/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: currentUser, messageIds: [msgId] })
    });
    if (res.ok) {
      setMessages(messages.filter(m => m.id !== msgId));
      setShowDeleteActionModal(null);
    }
  };

  const handleDeleteForEveryone = async (msgId) => {
    await fetch(`${API_URL}/api/messages/delete_everyone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: msgId, sender: currentUser })
    });
    fetchMessages();
    setShowDeleteActionModal(null);
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
        body: JSON.stringify({ username: currentUser, messageIds })
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
        }}
        onTouchStart={() => handlePressStart(msg)}
        onTouchEnd={handlePressEnd}
        onTouchMove={handlePressEnd}
        onMouseDown={() => handlePressStart(msg)}
        onMouseUp={handlePressEnd}
        onMouseLeave={handlePressEnd}
        >
          <div style={{
            background: msg.sender === 'me' ? '#005c4b' : '#202c33',
            color: '#e9edef',
            padding: msg.image_url ? '4px' : '6px 7px 8px 9px',
            borderRadius: '7.5px',
            borderTopRightRadius: msg.sender === 'me' ? '0px' : '7.5px',
            borderTopLeftRadius: msg.sender === 'me' ? '7.5px' : '0px',
            fontSize: '14.2px',
            lineHeight: '19px',
            cursor: selectionMode ? 'pointer' : 'default',
            wordBreak: 'break-word',
            boxShadow: '0 1px 0.5px rgba(11,20,26,.13)',
            display: 'inline-block',
            position: 'relative',
            border: selectedMessages.has(msg.id) ? '2px solid var(--primary)' : '2px solid transparent',
            boxSizing: 'border-box'
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
            {msg.is_deleted_everyone === 1 ? (
              <span style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', gap: '4px', paddingRight: '40px', paddingBottom: '4px' }}>
                <Ban size={14} /> Pesan ini telah dihapus
              </span>
            ) : (
              <div style={{ display: 'inline' }}>
                {renderMediaContent(msg.id, msg.text, msg.sender === 'me')}
                <span style={{ display: 'inline-block', width: msg.sender === 'me' ? '50px' : '40px', height: '10px' }} />
              </div>
            )}
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
              {msg.is_edited === 1 && msg.is_deleted_everyone !== 1 && <span style={{ fontStyle: 'italic', fontSize: '10px', marginRight: '4px' }}>(diedit)</span>}
              {msg.time}
              {msg.sender === 'me' && msg.is_deleted_everyone !== 1 && (
                msg.status === 'sent' ? <Check size={15} /> : <CheckCheck size={15} color={msg.status === 'read' ? '#53bdeb' : 'rgba(255,255,255,0.6)'} />
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
                <span style={{ fontSize: 'var(--font-body)', fontWeight: 600, color: chat.isDeleted ? '#a1a1aa' : (chat.name === 'admin1' || chat.username === 'admin1' ? '#ff4444' : chat.name === 'admin2' || chat.username === 'admin2' ? '#8b0000' : 'white'), fontStyle: chat.isDeleted ? 'italic' : 'normal' }}>
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
      <div className="chat-list" style={{ flex: 1, padding: '4px 16px 20px', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}>
        {loading && <div style={{ textAlign: 'center', marginTop: '20px' }}><Loader2 className="animate-spin" color="var(--primary)" /></div>}
        
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
                categories={[
                  { name: 'Emot Wajah', category: Categories.SMILEYS_PEOPLE },
                  { name: 'Lope Lope', category: Categories.SYMBOLS }
                ]}
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

      {/* Long Press Action Modal */}
      {longPressMessage && (
        <div onClick={() => setLongPressMessage(null)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--dark-surface)', padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '200px' }}>
            {longPressMessage.sender === 'me' && longPressMessage.is_deleted_everyone !== 1 && (
              <div onClick={() => { setEditMessageText(longPressMessage.text.replace('|||CAPTION|||', '')); setShowEditModal(longPressMessage); setLongPressMessage(null); }} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', cursor: 'pointer', color: 'white' }}>
                <Edit2 size={18} /> Edit Pesan
              </div>
            )}
            <div onClick={() => { setShowDeleteActionModal(longPressMessage); setLongPressMessage(null); }} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', cursor: 'pointer', color: '#EF4444' }}>
              <Trash2 size={18} /> Hapus Pesan
            </div>
          </div>
        </div>
      )}

      {/* Delete Action Modal */}
      {showDeleteActionModal && (
        <div onClick={() => setShowDeleteActionModal(null)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--dark-surface)', padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px', minWidth: '250px' }}>
            <h3 style={{ margin: 0, color: 'white', fontSize: '16px', textAlign: 'center', marginBottom: '8px' }}>Hapus Pesan?</h3>
            <div onClick={() => handleDeleteForMe(showDeleteActionModal.id)} style={{ padding: '12px', textAlign: 'center', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', cursor: 'pointer', color: 'white' }}>
              Hapus untuk saya
            </div>
            {showDeleteActionModal.sender === 'me' && showDeleteActionModal.is_deleted_everyone !== 1 && (
              <div onClick={() => handleDeleteForEveryone(showDeleteActionModal.id)} style={{ padding: '12px', textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', cursor: 'pointer', color: '#EF4444' }}>
                Hapus untuk semua
              </div>
            )}
            <div onClick={() => setShowDeleteActionModal(null)} style={{ padding: '12px', textAlign: 'center', cursor: 'pointer', color: 'var(--dark-text-muted)' }}>
              Batal
            </div>
          </div>
        </div>
      )}

      {/* Edit Message Modal */}
      {showEditModal && (
        <div onClick={() => setShowEditModal(null)} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: '20px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--dark-surface)', padding: '20px', borderRadius: '16px', width: '90%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, color: 'white', fontSize: '16px' }}>Edit Pesan</h3>
            <input 
              type="text" 
              value={editMessageText}
              onChange={e => setEditMessageText(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: 'none', color: 'white', outline: 'none' }}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button onClick={() => setShowEditModal(null)} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'transparent', color: 'white', cursor: 'pointer' }}>Batal</button>
              <button onClick={handleEditSubmit} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--primary)', color: 'white', cursor: 'pointer', fontWeight: 600 }}>Simpan</button>
            </div>
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
