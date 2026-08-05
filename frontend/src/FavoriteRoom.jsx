import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Loader2, Check, CheckCheck } from 'lucide-react';

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
  const messagesEndRef = useRef(null);

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
            status: 'read'
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

  const renderMessages = () => {
    const elements = [];
    let lastDateLabel = null;

    messages.forEach((msg, index) => {
      const currentLabel = formatDateDivider(msg.rawDate);
      if (currentLabel !== lastDateLabel) {
        elements.push(
          <div key={`date-${currentLabel}-${index}`} style={{ display: 'flex', justifyContent: 'center', margin: '4cqh 0' }}>
            <div style={{ background: 'rgba(255,255,255,0.1)', padding: '1cqh 3cqw', borderRadius: '3cqw', fontSize: 'var(--font-caption)', color: 'var(--dark-text-muted)' }}>
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
            padding: '1.5cqh 1.75cqw 2cqh 2.25cqw',
            borderRadius: '2cqw',
            borderTopRightRadius: msg.sender === 'me' ? '0px' : '2cqw',
            borderTopLeftRadius: msg.sender === 'me' ? '2cqw' : '0px',
            fontSize: 'var(--font-body)',
            lineHeight: '1.3',
            wordBreak: 'break-word',
            boxShadow: '0 1px 0.5px rgba(11,20,26,.13)',
            display: 'inline-block',
            position: 'relative'
          }}>
            <span style={{ display: 'inline-block', paddingRight: msg.sender === 'me' ? '16cqw' : '11cqw', paddingBottom: '2cqh' }}>
              {msg.text}
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
              {msg.sender === 'me' && <CheckCheck size={15} color="#53bdeb" />}
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
      <div style={{ display: 'flex', alignItems: 'center', gap: '3cqw', padding: '4cqw', background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)' }}>
        <ArrowLeft size={24} onClick={onBack} style={{ cursor: 'pointer', color: 'white' }} />
        <div style={{ width: '10cqw', height: '10cqw', borderRadius: '50%', background: partner.isDeleted ? '#3f3f46' : 'linear-gradient(135deg, #A48BFF, #651FFF)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: partner.isDeleted ? '#a1a1aa' : 'white', fontWeight: 'bold' }}>
          {partner.isDeleted ? 'X' : (partner.avatar ? (
            <img src={partner.avatar} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            (partner.displayName || partner.name).charAt(0).toUpperCase()
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 'var(--font-body)', fontWeight: 600, color: partner.isDeleted ? '#a1a1aa' : 'white', fontStyle: partner.isDeleted ? 'italic' : 'normal' }}>
            {partner.isDeleted ? 'Deleted Account' : (partner.displayName || partner.name)}
          </span>
          <span style={{ fontSize: 'var(--font-caption)', color: 'var(--dark-text-muted)' }}>Pesan Favorit</span>
        </div>
      </div>

      {/* Messages Area */}
      <div className="chat-list" style={{ flex: 1, padding: '5cqh 4cqw', display: 'flex', flexDirection: 'column', gap: '4cqw', overflowY: 'auto' }}>
        {loading && <div style={{ textAlign: 'center', marginTop: '5cqh' }}><Loader2 className="animate-spin" color="var(--primary)" /></div>}
        
        {!loading && messages.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--dark-text-muted)', marginTop: '10cqh', fontSize: 'var(--font-body)' }}>
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
