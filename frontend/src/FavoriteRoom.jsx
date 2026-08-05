import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Loader2, Check, CheckCheck, MoreVertical, Trash2, X } from 'lucide-react';

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

const FavoriteRoom = ({ partner, onBack, currentUser }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [selectionMode, setSelectionMode] = useState(null); // null | 'delete'
  const [selectedMessages, setSelectedMessages] = useState(new Set());
  const messagesEndRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    fetch(`${API_URL}/api/favorites/messages/${currentUser}/${partner.name}`)
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
            status: 'read' // Simplified status for favorite room
          };
        });
        setMessages(history);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [currentUser, partner.name]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleSelection = (id) => {
    const newSet = new Set(selectedMessages);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedMessages(newSet);
  };

  const executeBulkAction = async () => {
    if (selectedMessages.size === 0) return alert('Pilih setidaknya satu pesan');
    const messageIds = Array.from(selectedMessages);

    if (selectionMode === 'delete') {
      if (!window.confirm('Apakah Anda yakin ingin menghapus pesan yang dipilih?')) return;
      try {
        const res = await fetch(`${API_URL}/api/messages/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: currentUser, messageIds })
        });
        if (res.ok) {
          setMessages(messages.filter(m => !selectedMessages.has(m.id)));
          setSelectionMode(null);
          setSelectedMessages(new Set());
        } else {
          alert('Gagal menghapus pesan');
        }
      } catch (err) {
        alert('Kesalahan jaringan');
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

      const isSelected = selectedMessages.has(msg.id);

      elements.push(
        <div key={msg.id + '-' + index} style={{ 
          alignSelf: msg.sender === 'me' ? 'flex-end' : 'flex-start',
          maxWidth: '80%',
          position: 'relative'
        }}>
          <div 
            onClick={() => selectionMode ? toggleSelection(msg.id) : null}
            style={{
            background: msg.sender === 'me' ? '#005c4b' : '#202c33',
            color: '#e9edef',
            padding: '8px 12px 20px 12px',
            borderRadius: '8px',
            borderTopRightRadius: msg.sender === 'me' ? '0px' : '8px',
            borderTopLeftRadius: msg.sender === 'me' ? '8px' : '0px',
            fontSize: '15px',
            lineHeight: '1.3',
            wordBreak: 'break-word',
            boxShadow: '0 1px 0.5px rgba(11,20,26,.13)',
            display: 'inline-block',
            position: 'relative',
            cursor: selectionMode ? 'pointer' : 'default',
            border: isSelected ? '2px solid var(--primary)' : '2px solid transparent',
            boxSizing: 'border-box'
          }}>
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
                  checked={isSelected}
                  readOnly
                  style={{ pointerEvents: 'none', width: '16px', height: '16px', margin: 0 }}
                />
              </div>
            )}
            <span style={{ display: 'inline-block', paddingRight: msg.sender === 'me' ? '60px' : '50px', paddingBottom: '4px' }}>
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
              {msg.sender === 'me' && <CheckCheck size={14} color="#53bdeb" />}
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
      <div className="chat-header-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)', minHeight: '60px' }}>
        {selectionMode ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '100%' }}>
            <X size={24} style={{ cursor: 'pointer', color: 'white' }} onClick={() => { setSelectionMode(null); setSelectedMessages(new Set()); }} />
            <span style={{ fontSize: '18px', fontWeight: 600, color: 'white' }}>{selectedMessages.size} dipilih</span>
            <div style={{ flex: 1 }} />
            {selectionMode === 'delete' && <Trash2 size={24} style={{ cursor: 'pointer', color: 'white' }} onClick={executeBulkAction} />}
          </div>
        ) : (
          <>
            <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <ArrowLeft size={24} onClick={onBack} style={{ cursor: 'pointer', color: 'white' }} />
              <div className="avatar-container" style={{ width: 40, height: 40 }}>
                {partner.isDeleted ? (
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#3f3f46', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#a1a1aa', fontWeight: 'bold' }}>
                    X
                  </div>
                ) : (partner.avatar ? (
                  <img src={partner.avatar} alt="Avatar" className="avatar" />
                ) : (
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, #A48BFF, #651FFF)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontWeight: 'bold' }}>
                    {(partner.displayName || partner.name).charAt(0).toUpperCase()}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '16px', fontWeight: 600, color: partner.isDeleted ? '#a1a1aa' : 'white', fontStyle: partner.isDeleted ? 'italic' : 'normal' }}>
                  {partner.isDeleted ? 'Deleted Account' : (partner.displayName || partner.name)}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--dark-text-muted)' }}>Pesan Favorit</span>
              </div>
            </div>
            
            <div className="header-actions" style={{ position: 'relative', display: 'flex', alignItems: 'center' }} ref={menuRef}>
              <div onClick={() => setShowMenu(!showMenu)} style={{ cursor: 'pointer', display: 'flex', padding: '4px' }}>
                <MoreVertical size={24} color="white" />
              </div>
              {showMenu && (
                <div style={{ position: 'absolute', top: '100%', right: 0, background: 'var(--dark-surface)', border: '1px solid var(--dark-border)', borderRadius: '8px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '4px', zIndex: 60, minWidth: '120px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
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
            Belum ada pesan favorit dengan pengguna ini.
          </div>
        )}

        {renderMessages()}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default FavoriteRoom;
