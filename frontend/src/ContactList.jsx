import React, { useState, useEffect, useRef } from 'react';
import { Search, UserPlus, Check, X, Loader2, MessageSquare, User } from 'lucide-react';
import { notify } from './utils/toast';

const ContactList = ({ onContactClick, searchQuery, currentUser, contactsData, selectionMode, selectedItems, toggleSelectItem, onRefreshContacts }) => {
  const [optimisticAccepted, setOptimisticAccepted] = useState([]);
  const [optimisticRejected, setOptimisticRejected] = useState(new Set());

  useEffect(() => {
    setOptimisticAccepted([]);
    setOptimisticRejected(new Set());
  }, [contactsData]);

  const friends = [...(contactsData?.friends || []), ...optimisticAccepted];
  const pendingReceived = (contactsData?.pending_received || []).filter(s => !optimisticRejected.has(s.username));
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewProfileUser, setViewProfileUser] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  useEffect(() => {
    if (searchQuery.trim().length > 0) {
      const search = async () => {
        setLoading(true);
        try {
          const res = await fetch(`${API_URL}/api/users/search?q=${searchQuery}&username=${currentUser}`);
          if (res.ok) {
            const data = await res.json();
            setSearchResults(data);
          }
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      };
      // debounce slightly
      const timer = setTimeout(search, 500);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery, currentUser]);

  const handleRequest = async (receiver) => {
    try {
      const res = await fetch(`${API_URL}/api/contacts/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: currentUser, receiver })
      });
      if (res.ok) {
        notify.success('Permintaan dikirim!');
        setSearchResults(prev => prev.map(u => u.username === receiver ? { ...u, status: 'pending', sender_username: currentUser } : u));

        if (onRefreshContacts) onRefreshContacts();
      } else {
        notify.error('Gagal mengirim permintaan');
      }
    } catch (err) {
      notify.error('Gagal mengirim permintaan');
    }
  };

  const handleViewProfile = async (username) => {
    setIsLoadingProfile(true);
    try {
      const res = await fetch(`${API_URL}/api/users/${username}`);
      if (res.ok) {
        const data = await res.json();
        setViewProfileUser({ ...data, username });
      } else {
        notify.error('Gagal memuat profil');
      }
    } catch (err) {
      notify.error('Terjadi kesalahan jaringan');
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handleCancelRequest = async (receiver) => {
    try {
      const res = await fetch(`${API_URL}/api/contacts/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: currentUser, receiver })
      });
      if (res.ok) {
        notify.success('Permintaan dibatalkan');
        setSearchResults(prev => prev.map(u => u.username === receiver ? { ...u, status: null } : u));

        if (onRefreshContacts) onRefreshContacts();
      }
    } catch (err) {
      notify.error('Gagal membatalkan permintaan');
    }
  };

  const handleRespond = async (sender, action, senderObj = null) => {
    setOptimisticRejected(prev => new Set(prev).add(sender));
    if (action === 'accept') {
      const friendObj = senderObj || { username: sender, displayName: sender, avatar: null };
      setOptimisticAccepted(prev => [...prev, friendObj]);
    }

    try {
      const res = await fetch(`${API_URL}/api/contacts/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender, receiver: currentUser, action })
      });
      if (res.ok) {
        notify.success(action === 'accept' ? 'Teman ditambahkan!' : 'Permintaan ditolak.');
        if (onRefreshContacts) onRefreshContacts();
      } else {
        throw new Error();
      }
    } catch (err) {
      notify.error('Gagal merespons');
      if (onRefreshContacts) onRefreshContacts();
    }
  };

  if (searchQuery) {
    return (
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        <h2 style={{ fontSize: '18px', margin: '0 0 16px 0' }}>Hasil Pencarian</h2>
        {loading ? (
          <div style={{ textAlign: 'center', marginTop: '20px' }}><Loader2 className="animate-spin" /></div>
        ) : searchResults.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--dark-text-muted)', marginTop: '20px' }}>Tidak ada pengguna ditemukan.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {searchResults.map(user => (
              <div key={user.username} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px' }}>
                {user.avatar ? (
                  <img src={user.avatar} alt="Avatar" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
                    {user.username ? user.username.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                <div style={{ flex: 1, fontWeight: 600 }}>{user.display_name || user.username}</div>
                {user.status === 'accepted' ? (
                  <button onClick={() => onContactClick({ name: user.display_name || user.username, username: user.username, avatar: user.avatar })} style={{ background: 'var(--primary)', border: 'none', borderRadius: '50%', width: 36, height: 36, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <MessageSquare size={18} />
                  </button>
                ) : user.status === 'pending' && user.sender_username === currentUser ? (
                  <button onClick={() => handleCancelRequest(user.username)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 36, height: 36, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <X size={18} />
                  </button>
                ) : user.status === 'pending' && user.receiver_username === currentUser ? (
                  <button onClick={() => handleRespond(user.username, 'accept', user)} style={{ background: 'var(--primary)', border: 'none', borderRadius: '50%', width: 36, height: 36, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <Check size={18} />
                  </button>
                ) : (
                  <button onClick={() => handleRequest(user.username)} style={{ background: 'var(--primary)', border: 'none', borderRadius: '50%', width: 36, height: 36, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <UserPlus size={18} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
      
      {pendingReceived.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '14px', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>Permintaan Pertemanan</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {pendingReceived.map(sender => (
              <div key={sender.username} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'var(--dark-surface)', borderRadius: '12px', border: '1px solid var(--primary)' }}>
                {sender.avatar ? (
                  <img src={sender.avatar} alt="Avatar" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #A48BFF, #651FFF)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
                    {sender.username ? sender.username.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                <div style={{ flex: 1, fontSize: '14px' }}>
                  <b>{sender.displayName || sender.username}</b> menambahkan Anda
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => handleRespond(sender.username, 'accept', sender)} style={{ background: '#10B981', border: 'none', borderRadius: '50%', width: 32, height: 32, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <Check size={16} />
                  </button>
                  <button onClick={() => handleRespond(sender.username, 'reject', sender)} style={{ background: '#EF4444', border: 'none', borderRadius: '50%', width: 32, height: 32, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 style={{ fontSize: '18px', margin: '0 0 16px 0' }}>Daftar Teman</h2>
      {friends.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--dark-text-muted)', marginTop: '40px', fontSize: '14px' }}>
          Belum ada teman. Cari seseorang menggunakan ikon pencarian di atas!
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {friends.map(friend => (
            <div 
              key={friend.username} 
              onClick={() => { if (selectionMode === 'kontak') toggleSelectItem(friend.username); }}
              style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', cursor: selectionMode === 'kontak' ? 'pointer' : 'default' }}
            >
              {friend.avatar ? (
                <img src={friend.avatar} alt="Avatar" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
                  {friend.username ? friend.username.charAt(0).toUpperCase() : 'U'}
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{friend.displayName || friend.username}</div>
                <div style={{ fontSize: '12px', color: 'var(--dark-text-muted)' }}>Berteman</div>
              </div>
              {selectionMode === 'kontak' ? (
                <input 
                  type="checkbox" 
                  checked={selectedItems?.has(friend.username) || false} 
                  onChange={() => toggleSelectItem(friend.username)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', flexShrink: 0 }}
                />
              ) : (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => handleViewProfile(friend.username)} 
                    style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: 36, height: 36, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    title="Lihat Profil"
                  >
                    <User size={18} />
                  </button>
                  <button 
                    onClick={() => onContactClick({ name: friend.displayName || friend.username, username: friend.username, id: friend.username, avatar: friend.avatar })} 
                    style={{ background: 'var(--primary)', border: 'none', borderRadius: '50%', width: 36, height: 36, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    title="Kirim Pesan"
                  >
                    <MessageSquare size={18} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Loading Profile Popup */}
      {isLoadingProfile && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 101, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <Loader2 className="animate-spin" size={32} color="var(--primary)" />
        </div>
      )}

      {/* View Profile Popup */}
      {viewProfileUser && (
        <>
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 99, backdropFilter: 'blur(4px)' }} onClick={() => setViewProfileUser(null)} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'var(--dark-surface)', borderRadius: '6cqw', padding: '8cqw 6cqw', width: '90%', maxWidth: '85vw', zIndex: 100, border: '1px solid var(--dark-border)', boxShadow: '0 5cqh 6cqh -1cqh rgba(0, 0, 0, 0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '20cqw', height: '20cqw', borderRadius: '50%', background: 'linear-gradient(135deg, #A48BFF, #651FFF)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '8cqw', marginBottom: '4cqh', overflow: 'hidden' }}>
              {viewProfileUser.avatar ? <img src={viewProfileUser.avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : viewProfileUser.username.charAt(0).toUpperCase()}
            </div>
            <h2 style={{ margin: '0 0 1cqh 0', fontSize: '5cqw', color: 'white' }}>{viewProfileUser.display_name || viewProfileUser.username}</h2>
            <div style={{ fontSize: 'var(--font-body)', color: 'var(--primary)', marginBottom: '5cqh' }}>@{viewProfileUser.username}</div>
            
            <div style={{ background: 'var(--dark-bg)', padding: '4cqw', borderRadius: '3cqw', width: '100%', marginBottom: '6cqh', border: '1px solid var(--dark-border)' }}>
              <div style={{ fontSize: 'var(--font-caption)', color: 'var(--dark-text-muted)', marginBottom: '2cqh', textTransform: 'uppercase', letterSpacing: '1px' }}>Bio</div>
              <div style={{ fontSize: 'var(--font-body)', color: 'white', lineHeight: '1.5' }}>
                {viewProfileUser.bio || 'Tidak ada bio.'}
              </div>
            </div>
            
            <button onClick={() => setViewProfileUser(null)} style={{ width: '100%', padding: '3.5cqw', borderRadius: '3cqw', background: 'var(--primary)', border: 'none', color: 'white', fontWeight: '600', cursor: 'pointer' }}>
              Tutup
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ContactList;
