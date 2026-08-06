import React, { useState, useEffect, useRef } from 'react';
import { Search, X, MessageSquare, Phone, Users, Settings, LogOut, Check, CheckCheck, Moon, Trash2, Info, Bell, Plus, MoreVertical, Edit2, Image as ImageIcon, MessageCircle, User, Loader2 } from 'lucide-react';
import ChatRoom from './ChatRoom';
import ContactList from './ContactList';
import MomentList from './MomentList';
import Profile from './Profile';
import FavoriteRoom from './FavoriteRoom';
import { notify } from './utils/toast';

const ChatList = ({ onLogout, currentUser }) => {
  const [activeChat, setActiveChat] = useState(null);
  const [activeFavoriteUser, setActiveFavoriteUser] = useState(null);
  const [activeNav, setActiveNav] = useState('chat'); // chat, kontak, moment, profil
  const [activeFilter, setActiveFilter] = useState('Semua'); // Semua, Online, Grup, Favorit
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [chats, setChats] = useState([]);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [contactsData, setContactsData] = useState({ friends: [], pending_received: [], pending_sent: [] });
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [highlightMomentId, setHighlightMomentId] = useState(null);
  const [hasNewMoment, setHasNewMoment] = useState(false);
  const [showNewChatPopup, setShowNewChatPopup] = useState(false);
  const [favoriteUsers, setFavoriteUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [selectionMode, setSelectionMode] = useState(null); // 'chat' | 'kontak' | null
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);
  const settingsRef = useRef(null);

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  const fetchChats = () => {
    fetch(`${API_URL}/api/chats/${currentUser}`)
      .then(res => res.json())
      .then(data => {
        const formatted = data.map((c, i) => ({
          id: i,
          name: c.displayName,
          username: c.partner,
          lastMessage: c.lastMessage,
          time: new Date(typeof c.time === 'string' && !c.time.includes('T') ? c.time.replace(' ', 'T') + 'Z' : c.time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).replace(/\./g, ':') + ' WIB',
          unread: c.unread,
          online: false,
          avatar: c.avatar,
          isDeleted: c.isDeleted,
          isLastMessageMine: c.isLastMessageMine,
          isLastMessageRead: c.isLastMessageRead
        }));
        setChats(formatted);
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchContacts();
    const interval = setInterval(fetchContacts, 2000);
    return () => clearInterval(interval);
  }, [currentUser]);

  useEffect(() => {
    if (activeNav === 'chat' || activeNav === 'kontak') {
      fetchChats();
      const interval = setInterval(fetchChats, 1000);
      return () => clearInterval(interval);
    }
  }, [currentUser, activeNav, activeChat, activeFavoriteUser]);

  useEffect(() => {
    if (activeFilter === 'Favorit') {
      fetch(`${API_URL}/api/favorites/${currentUser}`)
        .then(res => res.json())
        .then(data => setFavoriteUsers(data))
        .catch(console.error);
    }
  }, [activeFilter, currentUser, activeFavoriteUser]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const fetchContacts = () => {
    fetch(`${API_URL}/api/contacts/${currentUser}`)
      .then(res => res.json())
      .then(data => {
        setContactsData(data);
        setPendingRequests(data.pending_received ? data.pending_received.length : 0);
      })
      .catch(console.error);
  };

  // Socket.io dihapus, UI chat list sudah di-refresh otomatis setiap 1 detik oleh fetchChats

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setShowSettings(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const prevNotifCountRef = useRef(0);
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await fetch(`${API_URL}/api/notifications/${currentUser}`);
        if (res.ok) {
          const data = await res.json();
          const unreadNotifs = data.filter(n => !n.is_read);
          if (unreadNotifs.length > prevNotifCountRef.current && 'Notification' in window && Notification.permission === 'granted') {
            const latestNotif = unreadNotifs[0];
            if (latestNotif && document.hidden) {
              new Notification('Pemberitahuan Chatter', { body: latestNotif.text || 'Notifikasi baru', icon: '/favicon.svg' });
            }
          }
          prevNotifCountRef.current = unreadNotifs.length;
          setNotifications(data);
        }
        
        // Cek moment terbaru
        const momentRes = await fetch(`${API_URL}/api/moments/latest/${currentUser}`);
        if (momentRes.ok) {
          const { latest_id } = await momentRes.json();
          const lastSeenId = parseInt(localStorage.getItem('last_seen_moment_id') || '0');
          if (latest_id > lastSeenId) {
            setHasNewMoment(true);
          }
        }
      } catch (e) {}
    };
    
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 2000);
    return () => clearInterval(interval);
  }, [currentUser]);

  const handleNavChange = (nav) => {
    setActiveNav(nav);
    setIsSearching(false);
    setSearchQuery('');
    setSelectionMode(null);
    setSelectedItems(new Set());
    if (nav === 'moment') {
      setHasNewMoment(false);
      fetch(`${API_URL}/api/moments/latest/${currentUser}`)
        .then(res => res.json())
        .then(data => localStorage.setItem('last_seen_moment_id', data.latest_id))
        .catch(console.error);
    } else {
      setHighlightMomentId(null);
    }
  };

  useEffect(() => {
    if (activeChat || activeFavoriteUser || showNewChatPopup || selectionMode || showBulkDeleteConfirm) {
      window.history.pushState({ modalOpen: true }, '');
    }
  }, [!!activeChat, !!activeFavoriteUser, !!showNewChatPopup, !!selectionMode, !!showBulkDeleteConfirm]);

  useEffect(() => {
    const handlePopState = (e) => {
      if (showBulkDeleteConfirm) setShowBulkDeleteConfirm(false);
      else if (showNewChatPopup) setShowNewChatPopup(false);
      else if (selectionMode) {
        setSelectionMode(null);
        setSelectedItems(new Set());
      }
      else if (activeFavoriteUser) setActiveFavoriteUser(null);
      else if (activeChat) setActiveChat(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeChat, activeFavoriteUser, showNewChatPopup, selectionMode, showBulkDeleteConfirm]);

  const closeModal = () => {
    if (window.history.state && window.history.state.modalOpen) {
      window.history.back();
    } else {
      setActiveChat(null);
      setActiveFavoriteUser(null);
      setShowNewChatPopup(false);
      setSelectionMode(null);
      setSelectedItems(new Set());
      setShowBulkDeleteConfirm(false);
    }
  };

  if (activeChat) {
    const isFriend = contactsData.friends?.some(f => f.username === activeChat.username) || false;
    return <ChatRoom chat={activeChat} onBack={closeModal} currentUser={currentUser} isFriend={isFriend} />;
  }

  if (activeFavoriteUser) {
    return <FavoriteRoom partner={activeFavoriteUser} onBack={closeModal} currentUser={currentUser} />;
  }

  const filteredChats = chats.filter(chat => {
    if (searchQuery && (!chat.name || !chat.name.toLowerCase().includes(searchQuery.toLowerCase())) && (!chat.username || !chat.username.toLowerCase().includes(searchQuery.toLowerCase()))) return false;
    if (activeFilter === 'Online' && !chat.online) return false;
    if (activeFilter === 'Grup' && !chat.isGroup) return false;
    if (activeFilter === 'Favorit') return false; 
    return true;
  });

  const filteredFavorites = favoriteUsers.filter(user => {
    if (searchQuery && (!user.displayName || !user.displayName.toLowerCase().includes(searchQuery.toLowerCase())) && (!user.username || !user.username.toLowerCase().includes(searchQuery.toLowerCase()))) return false;
    return true;
  });

  const handleSearchClick = () => {
    if (isSearching) {
      setIsSearching(false);
      setSearchQuery('');
    } else {
      setIsSearching(true);
    }
  };

  const handleSettingClick = (action) => {
    setShowSettings(false);
    if (action === 'darkmode') notify.success('Tema gelap sudah aktif.');
    if (action === 'version') notify.info('Nebula Chat v1.0.0');
    if (action === 'delete') {
      if (activeNav === 'chat' || activeNav === 'kontak') {
        setSelectionMode(activeNav);
        setSelectedItems(new Set());
      } else {
        notify.info('Fitur hapus dapat digunakan di halaman Chat atau Kontak.');
      }
    }
  };

  const toggleSelectItem = (itemKey) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(itemKey)) newSet.delete(itemKey);
    else newSet.add(itemKey);
    setSelectedItems(newSet);
  };

  const handleConfirmBulkDelete = async () => {
    if (selectedItems.size === 0) return notify.error('Pilih setidaknya satu item');
    setIsDeletingBulk(true);
    try {
      if (selectionMode === 'chat') {
        const res = await fetch(`${API_URL}/api/chats/delete-bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: currentUser, partners: Array.from(selectedItems) })
        });
        if (res.ok) {
          notify.success('Obrolan berhasil dihapus');
          setChats(prev => prev.filter(c => !selectedItems.has(c.username)));
          setFavoriteUsers(prev => prev.filter(f => !selectedItems.has(f.username)));
          setSelectionMode(null);
          setSelectedItems(new Set());
          setTimeout(fetchChats, 500);
        } else {
          notify.error('Gagal menghapus obrolan');
        }
      } else if (selectionMode === 'kontak') {
        const res = await fetch(`${API_URL}/api/contacts/delete-bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: currentUser, targets: Array.from(selectedItems) })
        });
        if (res.ok) {
          notify.success('Kontak berhasil dihapus');
          fetch(`${API_URL}/api/contacts/${currentUser}`)
            .then(res => res.json())
            .then(data => {
              setContactsData(data);
              setPendingRequests(data.pending_received ? data.pending_received.length : 0);
            });
          setSelectionMode(null);
          setSelectedItems(new Set());
        } else {
          notify.error('Gagal menghapus kontak');
        }
      }
    } catch (e) {
      console.error(e);
      notify.error('Terjadi kesalahan koneksi');
    } finally {
      setIsDeletingBulk(false);
      setShowBulkDeleteConfirm(false);
    }
  };

  return (
    <div className="chat-app">
      <div className="chat-header-bar">
        {selectionMode ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '3cqw', width: '100%' }}>
            <X size={24} style={{ cursor: 'pointer', color: 'white' }} onClick={closeModal} />
            <span style={{ fontSize: 'var(--font-body)', fontWeight: 600, color: 'white' }}>{selectedItems.size} dipilih</span>
            <div style={{ flex: 1 }} />
            <button 
              onClick={() => {
                if (selectedItems.size === 0) return notify.error('Pilih setidaknya satu item.');
                setShowBulkDeleteConfirm(true);
              }} 
              style={{ background: '#EF4444', border: 'none', padding: '1cqh 3cqw', borderRadius: '2cqw', color: 'white', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1.5cqw', fontSize: 'var(--font-caption)' }}
            >
              <Trash2 size={16} /> Hapus
            </button>
          </div>
        ) : (
          <>
            <div className="header-left">
              <div className="logo-icon small">
                <div className="logo-dots small">
                  <div className="logo-dot"></div>
                  <div className="logo-dot"></div>
                  <div className="logo-dot"></div>
                </div>
              </div>
              {isSearching ? (
                <input 
                  autoFocus
                  type="text" 
                  placeholder={activeNav === 'kontak' ? "Cari Teman" : "Cari Obrolan"} 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ background: 'transparent', border: 'none', color: 'white', outline: 'none', fontSize: '16px', width: '150px' }}
                />
              ) : (
                <div className="header-title">Chatter</div>
              )}
            </div>
            <div className="header-actions" style={{ position: 'relative' }} ref={settingsRef}>
              {(showNotifications || showSettings) && (
                <div 
                  onClick={() => { setShowNotifications(false); setShowSettings(false); }} 
                  style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }} 
                />
              )}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', zIndex: 100 }}>
                <Bell size={20} onClick={() => {
                  const willShow = !showNotifications;
                  setShowNotifications(willShow);
                  setShowSettings(false);
                  if (willShow && notifications.filter(n => !n.is_read).length > 0) {
                    fetch(`${API_URL}/api/notifications/read`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ username: currentUser })
                    }).then(() => {
                      setNotifications(notifications.map(n => ({...n, is_read: 1})));
                    });
                  }
                }} />
                {notifications.filter(n => !n.is_read).length > 0 && (
                  <div style={{ position: 'absolute', top: -5, right: -5, background: '#EF4444', color: 'white', fontSize: '10px', width: '16px', height: '16px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold' }}>
                    {notifications.filter(n => !n.is_read).length}
                  </div>
                )}
              </div>
              {(activeNav === 'chat' || activeNav === 'kontak') && (
                <>
                  <div style={{ zIndex: 100 }}>
                    {isSearching ? <X size={20} onClick={handleSearchClick} style={{ cursor: 'pointer' }} /> : <Search size={20} onClick={handleSearchClick} style={{ cursor: 'pointer' }} />}
                  </div>
                  <MoreVertical size={20} style={{ zIndex: 100, cursor: 'pointer' }} onClick={() => { setShowSettings(!showSettings); setShowNotifications(false); }} />
                  
                  {showSettings && (
                    <div style={{ position: 'absolute', top: '100%', right: 0, background: 'var(--dark-surface)', border: '1px solid var(--dark-border)', borderRadius: '12px', padding: '8px', zIndex: 100, width: '160px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                      <div onClick={() => handleSettingClick('darkmode')} style={{ padding: '10px 12px', cursor: 'pointer', fontSize: '14px', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}><Moon size={16}/> Mode Gelap</div>
                      <div onClick={() => handleSettingClick('delete')} style={{ padding: '10px 12px', cursor: 'pointer', fontSize: '14px', color: '#EF4444', display: 'flex', alignItems: 'center', gap: '8px' }}><Trash2 size={16}/> Hapus</div>
                      <div onClick={() => handleSettingClick('version')} style={{ padding: '10px 12px', cursor: 'pointer', fontSize: '14px', color: 'var(--dark-text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}><Info size={16}/> Versi App</div>
                    </div>
                  )}
                </>
              )}
          
          {showNotifications && (
            <div style={{ position: 'absolute', top: '100%', right: 0, background: 'var(--dark-surface)', border: '1px solid var(--dark-border)', borderRadius: '12px', padding: '8px', zIndex: 100, width: '280px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', borderBottom: '1px solid var(--dark-border)', marginBottom: '8px' }}>
                <h4 style={{ margin: 0, color: 'white', fontSize: '14px' }}>Notifikasi</h4>
              </div>
              <div className="hide-scrollbar" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', color: 'var(--dark-text-muted)', fontSize: '13px' }}>Belum ada notifikasi</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {notifications.map(n => (
                      <div key={n.id} onClick={() => {
                        fetch(`${API_URL}/api/notifications/click`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ id: n.id })
                        }).then(() => {
                          setNotifications(notifications.map(notif => notif.id === n.id ? {...notif, is_clicked: 1} : notif));
                        });
                        setShowNotifications(false);
                        if (n.type === 'friend_request') {
                          handleNavChange('kontak');
                        } else {
                          setHighlightMomentId(n.moment_id);
                          handleNavChange('moment');
                        }
                      }} style={{ padding: '8px', borderRadius: '8px', display: 'flex', gap: '12px', background: n.is_clicked ? 'transparent' : 'rgba(164, 139, 255, 0.15)', cursor: 'pointer', transition: 'background-color 0.2s' }}>
                        {n.sender_avatar ? (
                          <img src={n.sender_avatar} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
                            {n.sender.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div style={{ flex: 1, fontSize: '13px', color: 'white' }}>
                          <b>{n.sender}</b> {n.type === 'like' ? 'menyukai moment Anda.' : n.type === 'friend_request' ? 'mengirim permintaan pertemanan kepada Anda.' : n.type === 'friend_accept' ? 'menerima permintaan pertemanan Anda.' : `mengomentari moment Anda: "${n.content}"`}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        </>
      )}
      </div>

      {/* Render Main Content based on Bottom Nav */}
      {activeNav === 'chat' && (
        <>
          <div className="filter-tabs">
            {['Semua', 'Online', 'Grup', 'Favorit'].map(tab => (
              <div 
                key={tab} 
                className={`filter-tab ${activeFilter === tab ? 'active' : ''}`}
                onClick={() => { setActiveFilter(tab); setSelectionMode(null); setSelectedItems(new Set()); }}
              >
                {tab}
              </div>
            ))}
          </div>

          <div className="chat-list">
            {activeFilter === 'Favorit' ? (
              filteredFavorites.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--dark-text-muted)', marginTop: '40px', fontSize: '14px' }}>
                  Belum ada pesan favorit.
                </div>
              ) : (
                filteredFavorites.map((fav, index) => (
                  <React.Fragment key={fav.username}>
                    <div className="chat-item" onClick={() => {
                      if (selectionMode === 'chat') {
                        toggleSelectItem(fav.username);
                      } else {
                        setActiveFavoriteUser({ name: fav.username, displayName: fav.displayName, avatar: fav.avatar, isDeleted: fav.isDeleted });
                      }
                    }}>
                      <div className="avatar-container">
                        {fav.isDeleted ? (
                          <div className="avatar" style={{ background: '#3f3f46', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#a1a1aa', fontWeight: 'bold' }}>
                            X
                          </div>
                        ) : fav.avatar ? (
                          <img src={fav.avatar} alt={fav.displayName || fav.username} className="avatar" />
                        ) : (
                          <div className="avatar" style={{ background: 'linear-gradient(135deg, #A48BFF, #651FFF)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontWeight: 'bold' }}>
                            {(fav.displayName || fav.username).charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="chat-info">
                        <div className="chat-header">
                          <div className="chat-name" style={{ color: (fav.username === 'admin1' ? '#ff4444' : fav.username === 'admin2' ? '#8b0000' : 'inherit') }}>{fav.isDeleted ? <span style={{ color: '#a1a1aa', fontStyle: 'italic' }}>Deleted Account</span> : (fav.displayName || fav.username)}</div>
                        </div>
                        <div className="chat-message-row">
                          <div className="chat-preview">
                            <span style={{ color: 'var(--dark-text-muted)' }}>Klik untuk melihat pesan favorit</span>
                          </div>
                        </div>
                      </div>
                      {selectionMode === 'chat' && (
                        <input 
                          type="checkbox"
                          checked={selectedItems.has(fav.username)}
                          onChange={() => toggleSelectItem(fav.username)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ width: '18px', height: '18px', cursor: 'pointer', marginLeft: '12px', flexShrink: 0 }}
                        />
                      )}
                    </div>
                    {index < filteredFavorites.length - 1 && <div className="divider-line"></div>}
                  </React.Fragment>
                ))
              )
            ) : (
              (activeFilter === 'Online' || activeFilter === 'Grup') ? (
                <div style={{ textAlign: 'center', color: 'var(--dark-text-muted)', marginTop: '40px', fontSize: '14px' }}>
                  coming soon
                </div>
              ) : filteredChats.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--dark-text-muted)', marginTop: '40px', fontSize: '14px' }}>
                  Obrolan tidak ditemukan.
                </div>
              ) : (
                filteredChats.map((chat, index) => (
                  <React.Fragment key={chat.id}>
                    <div className="chat-item" onClick={() => {
                      if (selectionMode === 'chat') {
                        toggleSelectItem(chat.username);
                      } else {
                        setActiveChat(chat);
                      }
                    }} style={{ cursor: 'pointer' }}>
                      <div className="avatar-container">
                        {chat.isSystem ? (
                          <div className="avatar" style={{ background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Info size={24} color="white" />
                          </div>
                        ) : chat.isDeleted ? (
                          <div className="avatar" style={{ background: '#3f3f46', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#a1a1aa', fontWeight: 'bold' }}>
                            X
                          </div>
                        ) : chat.avatar ? (
                          <img src={chat.avatar} alt={chat.name} className="avatar" />
                        ) : (
                          <div className="avatar" style={{ background: 'linear-gradient(135deg, #A48BFF, #651FFF)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontWeight: 'bold' }}>
                            {chat.name ? chat.name.charAt(0).toUpperCase() : 'U'}
                          </div>
                        )}
                        {chat.online && <div className="status-dot"></div>}
                        {chat.isGroup && (
                          <div className="group-icon">
                            <Users size={10} />
                          </div>
                        )}
                      </div>
                      
                      <div className="chat-info">
                        <div className="chat-header">
                          <div className="chat-name" style={{ color: (chat.partner === 'admin1' || chat.name === 'admin1' ? '#ff4444' : chat.partner === 'admin2' || chat.name === 'admin2' ? '#8b0000' : 'inherit') }}>{chat.isDeleted ? <span style={{ color: '#a1a1aa', fontStyle: 'italic' }}>Deleted Account</span> : chat.name} {chat.isSystem && <span style={{ fontSize: '10px' }}>⭐</span>}</div>
                        </div>
                        <div className="chat-message-row">
                          <div className="chat-preview">
                            {typingUsers[chat.username] ? (
                              <span style={{ color: 'var(--primary)', fontStyle: 'italic', fontWeight: 500 }}>
                                Sedang mengetik<span className="typing-dots"></span>
                              </span>
                            ) : (
                              <>
                                {chat.isImage && <ImageIcon size={14} style={{ marginRight: '4px' }} />}
                                {chat.isLastMessageMine && !chat.isSystem && (
                                  <span style={{ marginRight: '4px', display: 'inline-flex', alignItems: 'center' }}>
                                    {chat.isLastMessageRead ? (
                                      <CheckCheck size={14} color="#3b82f6" />
                                    ) : (
                                      (contactsData?.friends?.some(f => f.username === chat.username)) ? 
                                        <CheckCheck size={14} color="var(--dark-text-muted)" /> : 
                                        <Check size={14} color="var(--dark-text-muted)" />
                                    )}
                                  </span>
                                )}
                                <span style={{ color: chat.isSystem ? 'var(--primary)' : 'inherit' }}>
                                  {typeof chat.lastMessage === 'string' && chat.lastMessage.includes('|||CAPTION|||')
                                    ? `📷 ${chat.lastMessage.split('|||CAPTION|||')[1]}`
                                    : typeof chat.lastMessage === 'string' && chat.lastMessage.includes('|||FILENAME|||')
                                    ? `📷 ${chat.lastMessage.split('|||FILENAME|||')[1].split('|||')[0]}`
                                    : typeof chat.lastMessage === 'string' && (chat.lastMessage.startsWith('data:image/') || chat.lastMessage.startsWith('MEDIA_LOCAL_SAVED'))
                                    ? '📷 Foto'
                                    : chat.lastMessage}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      {chat.unread > 0 && (
                        <div className="unread-badge">{chat.unread}</div>
                      )}
                      {selectionMode === 'chat' && (
                        <input 
                          type="checkbox" 
                          checked={selectedItems.has(chat.username)} 
                          onChange={() => toggleSelectItem(chat.username)}
                          onClick={(e) => e.stopPropagation()}
                          style={{ width: '18px', height: '18px', cursor: 'pointer', marginLeft: '12px', flexShrink: 0 }}
                        />
                      )}
                    </div>
                    {index < filteredChats.length - 1 && <div className="divider-line"></div>}
                  </React.Fragment>
                ))
              )
            )}
          </div>

          <div 
            className="fab" 
            onClick={() => setShowNewChatPopup(true)} 
            style={{ position: 'absolute', bottom: '13cqh', right: '4cqw', width: '10cqw', height: '10cqw', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 4px 12px rgba(101, 31, 255, 0.4)', cursor: 'pointer', zIndex: 90 }}
          >
            <Edit2 size={16} />
          </div>

          {showNewChatPopup && (
            <>
              <div 
                style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 99, backdropFilter: 'blur(4px)' }} 
                onClick={() => setShowNewChatPopup(false)} 
              />
              <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'var(--dark-surface)', borderRadius: '16px', padding: '24px', width: '90%', maxWidth: '360px', zIndex: 100, border: '1px solid var(--dark-border)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px' }}>Pilih Teman</h3>
                  <X size={20} onClick={() => setShowNewChatPopup(false)} style={{ cursor: 'pointer', color: 'var(--dark-text-muted)' }} />
                </div>
                <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }} className="hide-scrollbar">
                  {!contactsData.friends || contactsData.friends.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--dark-text-muted)', padding: '20px 0', fontSize: '14px' }}>
                      Belum ada teman.
                    </div>
                  ) : (
                    contactsData.friends.map(friend => (
                      <div 
                        key={friend.username}
                        onClick={() => {
                          setActiveChat({ name: friend.displayName || friend.username, username: friend.username, id: friend.username, avatar: friend.avatar });
                          setShowNewChatPopup(false);
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', cursor: 'pointer' }}
                      >
                        {friend.avatar ? (
                          <img src={friend.avatar} alt="Avatar" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold' }}>
                            {(friend.displayName || friend.username).charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span style={{ fontWeight: '600', fontSize: '15px', color: (friend.username === 'admin1' ? '#ff4444' : friend.username === 'admin2' ? '#8b0000' : 'inherit') }}>{friend.displayName || friend.username}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

        </>
      )}

      {activeNav === 'kontak' && (
        <ContactList 
          onContactClick={(contact) => { setActiveChat(contact); handleNavChange('chat'); }} 
          searchQuery={searchQuery} 
          currentUser={currentUser} 
          contactsData={contactsData}
          selectionMode={selectionMode}
          selectedItems={selectedItems}
          toggleSelectItem={toggleSelectItem}
          onRefreshContacts={fetchContacts}
        />
      )}
      {activeNav === 'moment' && <MomentList currentUser={currentUser} highlightMomentId={highlightMomentId} setHighlightMomentId={setHighlightMomentId} />}
      {activeNav === 'profil' && <Profile onLogout={onLogout} email={currentUser} />}

      {/* Bulk Delete Confirm Modal */}
      {showBulkDeleteConfirm && (
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
            <h3 style={{ margin: '0 0 4cqh 0', fontSize: 'var(--font-title)', color: 'white' }}>
              {selectionMode === 'chat' ? 'Hapus Obrolan?' : 'Hapus Kontak?'}
            </h3>
            <p style={{ color: 'var(--dark-text-muted)', fontSize: 'var(--font-body)', marginBottom: '6cqh', lineHeight: '1.5' }}>
              {selectionMode === 'chat' 
                ? 'Anda yakin ingin menghapus obrolan yang dipilih? Riwayat pesan akan dihapus secara permanen.' 
                : 'Anda yakin ingin menghapus kontak yang dipilih dari daftar teman Anda?'}
            </p>
            <div style={{ display: 'flex', gap: '3cqw' }}>
              <button onClick={() => setShowBulkDeleteConfirm(false)} disabled={isDeletingBulk} style={{ flex: 1, padding: '3cqw', background: 'transparent', border: '1px solid var(--dark-border)', color: 'white', borderRadius: '2cqw', cursor: 'pointer', opacity: isDeletingBulk ? 0.5 : 1 }}>
                Batal
              </button>
              <button onClick={handleConfirmBulkDelete} disabled={isDeletingBulk} style={{ flex: 1, padding: '3cqw', background: '#EF4444', border: 'none', color: 'white', borderRadius: '2cqw', cursor: 'pointer', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2cqw', opacity: isDeletingBulk ? 0.7 : 1 }}>
                {isDeletingBulk ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bottom-nav">
        <div className={`nav-item ${activeNav === 'chat' ? 'active' : ''}`} onClick={() => handleNavChange('chat')}>
          {activeNav === 'chat' && <div className="nav-indicator"></div>}
          <MessageCircle size={24} />
          <span>Chat</span>
        </div>
        <div className={`nav-item ${activeNav === 'kontak' ? 'active' : ''}`} onClick={() => handleNavChange('kontak')}>
          {activeNav === 'kontak' && <div className="nav-indicator"></div>}
          <div style={{ position: 'relative' }}>
            <User size={24} />
            {pendingRequests > 0 && (
              <div style={{ position: 'absolute', top: -5, right: -5, background: 'var(--primary)', color: 'white', fontSize: '10px', width: '16px', height: '16px', borderRadius: '50%', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold' }}>
                {pendingRequests}
              </div>
            )}
          </div>
          <span>Kontak</span>
        </div>
        <div className={`nav-item ${activeNav === 'moment' ? 'active' : ''}`} onClick={() => handleNavChange('moment')}>
          {activeNav === 'moment' && <div className="nav-indicator"></div>}
          <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: '2px solid currentColor', position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'currentColor' }}></div>
            {hasNewMoment && (
              <div className="animate-pulse-green" style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                width: '10px',
                height: '10px',
                backgroundColor: '#25D366',
                borderRadius: '50%'
              }}></div>
            )}
          </div>
          <span>Moment</span>
        </div>
        <div className={`nav-item ${activeNav === 'profil' ? 'active' : ''}`} onClick={() => handleNavChange('profil')}>
          {activeNav === 'profil' && <div className="nav-indicator"></div>}
          <User size={24} />
          <span>Profil</span>
        </div>
      </div>
    </div>
  );
};

export default ChatList;
