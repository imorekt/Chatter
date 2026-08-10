import React, { useState, useRef, useEffect } from 'react';
import { Camera, LogOut, Save, User, Loader2, Trash2, Bell, Terminal, X, Send, Settings, ChevronRight } from 'lucide-react';
import Cropper from 'react-easy-crop';
import getCroppedImg from './utils/cropImage';
import { notify } from './utils/toast';
import localforage from 'localforage';

const Profile = ({ onLogout, email, friends = [] }) => {
  const [bio, setBio] = useState(() => {
    try { const data = JSON.parse(localStorage.getItem(`profile_sync_${email}`)); return data?.bio || 'Hey there! I am using Chatter.'; } catch(e) { return 'Hey there! I am using Chatter.'; }
  });
  const [displayName, setDisplayName] = useState(() => {
    try { const data = JSON.parse(localStorage.getItem(`profile_sync_${email}`)); return data?.display_name || ''; } catch(e) { return ''; }
  });
  const [originalDisplayName, setOriginalDisplayName] = useState(() => {
    try { const data = JSON.parse(localStorage.getItem(`profile_sync_${email}`)); return data?.display_name || ''; } catch(e) { return ''; }
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteEmailInput, setDeleteEmailInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [avatar, setAvatar] = useState(() => localStorage.getItem(`avatar_${email}`) || null);
  const [coverUrl, setCoverUrl] = useState(() => localStorage.getItem(`cover_${email}`) || null);
  const [momentCount, setMomentCount] = useState(() => {
    try { const data = JSON.parse(localStorage.getItem(`profile_sync_${email}`)); return data?.momentCount || 0; } catch(e) { return 0; }
  });
  const [friendCount, setFriendCount] = useState(() => {
    try { const data = JSON.parse(localStorage.getItem(`profile_sync_${email}`)); return data?.friendCount || 0; } catch(e) { return 0; }
  });
  const [isLoadingProfile, setIsLoadingProfile] = useState(() => !localStorage.getItem(`profile_sync_${email}`));
  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [notifSettings, setNotifSettings] = useState({ notif_message: 1, notif_like: 1, notif_comment: 1 });
  const [isSavingNotif, setIsSavingNotif] = useState(false);
  
  const [showMomentsPopup, setShowMomentsPopup] = useState(false);
  const [userMoments, setUserMoments] = useState([]);
  const [isLoadingMoments, setIsLoadingMoments] = useState(false);
  const [previewMoment, setPreviewMoment] = useState(null);
  const [showFriendsPopup, setShowFriendsPopup] = useState(false);
  
  const fileInputRef = useRef(null);
  const coverInputRef = useRef(null);

  // Admin Command AI State
  const [showAdminCommand, setShowAdminCommand] = useState(false);
  const [adminCommandMessages, setAdminCommandMessages] = useState([{ sender: 'imo_ai', text: 'Halo Admin! Ada perintah untuk dieksekusi hari ini?' }]);
  const [adminCommandInput, setAdminCommandInput] = useState('');
  const [isSendingCommand, setIsSendingCommand] = useState(false);
  const commandEndRef = useRef(null);
  const [imoAiAvatar, setImoAiAvatar] = useState("https://api.dicebear.com/7.x/bottts/svg?seed=imo_ai");

  useEffect(() => {
    fetch(`${API_URL}/api/users/imo_ai`)
      .then(res => res.json())
      .then(data => {
        if (data && data.avatar) {
          setImoAiAvatar(data.avatar);
        }
      })
      .catch(console.error);
  }, []);

  // Admin Bubble Swipe State
  const [bubbleOffset, setBubbleOffset] = useState(0);
  const dragStartX = useRef(0);
  const isDraggingBubble = useRef(false);

  const API_URL = window.APP_CONFIG?.API_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001';

  useEffect(() => {
    localforage.getItem(`profile_${email}`).then(val => {
      if (val) {
        if (val.avatar) setAvatar(val.avatar);
        if (val.cover_url) setCoverUrl(val.cover_url);
        if (val.display_name) {
          setDisplayName(val.display_name);
          setOriginalDisplayName(val.display_name);
        }
        if (val.bio) setBio(val.bio);
        if (val.momentCount !== undefined) setMomentCount(val.momentCount);
        if (val.friendCount !== undefined) setFriendCount(val.friendCount);
        setIsLoadingProfile(false);
      }
    });

    fetch(`${API_URL}/api/users/${email}`)
      .then(res => res.json())
      .then(data => {
        if (data.avatar) {
          setAvatar(data.avatar);
          localStorage.setItem(`avatar_${email}`, data.avatar);
        }
        if (data.cover_url) {
          setCoverUrl(data.cover_url);
          localStorage.setItem(`cover_${email}`, data.cover_url);
        }
        if (data.display_name) {
          setDisplayName(data.display_name);
          setOriginalDisplayName(data.display_name);
        } else {
          setDisplayName(email);
          setOriginalDisplayName(email);
        }
        if (data.bio) {
          setBio(data.bio);
        }
        if (data.momentCount !== undefined) setMomentCount(data.momentCount);
        if (data.friendCount !== undefined) setFriendCount(data.friendCount);
        localforage.setItem(`profile_${email}`, data);
        localStorage.setItem(`profile_sync_${email}`, JSON.stringify(data));
        setIsLoadingProfile(false);
      })
      .catch((e) => {
        console.error(e);
        setIsLoadingProfile(false);
      });
  }, [email, API_URL]);

  const handleOpenMomentsPopup = async () => {
    if (momentCount === 0) return;
    setShowMomentsPopup(true);
    setIsLoadingMoments(true);
    try {
      const res = await fetch(`${API_URL}/api/moments`);
      const data = await res.json();
      setUserMoments(data.filter(m => m.username === email));
    } catch(e) {
      console.error(e);
    }
    setIsLoadingMoments(false);
  };

  const handleOpenFriendsPopup = () => {
    if (friendCount === 0) return;
    setShowFriendsPopup(true);
  };

  const navigateToMoment = (momentId) => {
    setShowMomentsPopup(false);
    window.dispatchEvent(new CustomEvent('openMoment', { detail: momentId }));
  };

  // Crop states
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isCropping, setIsCropping] = useState(false);

  const handleSave = async () => {
    if (!displayName.trim()) {
      return notify.error('Nama tidak boleh kosong.');
    }
    setIsSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/users/${email}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: displayName, bio: bio })
      });
      if (res.ok) {
        setOriginalDisplayName(displayName.trim());
        notify.success('Profil berhasil diperbarui.');
      }
    } catch (e) {
      notify.error('Gagal memperbarui profil');
    }
    setIsSaving(false);
  };

  const handleAvatarUpload = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleCoverUpload = () => {
    if (coverInputRef.current) coverInputRef.current.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      return notify.error('Tolong pilih file gambar (JPG/PNG).');
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setImageSrc(reader.result);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCoverChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      return notify.error('Tolong pilih file gambar (JPG/PNG).');
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = reader.result;
      setCoverUrl(base64Data);
      try {
        const res = await fetch(`${API_URL}/api/users/${email}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ display_name: displayName, bio: bio, cover_url: base64Data })
        });
        if (res.ok) {
          localStorage.setItem(`cover_${email}`, base64Data);
          notify.success('Sampul profil berhasil diperbarui.');
        } else {
          notify.error('Gagal menyimpan sampul');
        }
      } catch (err) {
        notify.error('Terjadi kesalahan koneksi');
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const onCropComplete = (croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const applyCrop = async () => {
    setIsCropping(true);
    try {
      const croppedImage = await getCroppedImg(imageSrc, croppedAreaPixels);

      const res = await fetch(`${API_URL}/api/users/avatar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email, avatar: croppedImage })
      });

      if (res.ok) {
        setAvatar(croppedImage);
        localStorage.setItem(`avatar_${email}`, croppedImage);
        notify.success('Foto profil berhasil diperbarui!');
      } else {
        notify.error('Gagal menyimpan foto profil ke server.');
      }

      setImageSrc(null);
    } catch (e) {
      console.error(e);
      notify.error('Gagal memotong gambar.');
    } finally {
      setIsCropping(false);
    }
  };

  const handleLogout = () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setTimeout(() => {
      onLogout();
    }, 1500);
  };

  const handleDeleteAccount = async () => {
    if (deleteEmailInput.toLowerCase() !== 'setuju') return notify.error('Ketik "setuju" untuk konfirmasi');
    setIsDeleting(true);
    try {
      const res = await fetch(`${API_URL}/api/users/${email}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: deleteEmailInput })
      });
      const data = await res.json();
      if (res.ok) {
        notify.success('Akun berhasil dihapus');
        localStorage.removeItem('chat_user');
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        notify.error(data.error || 'Gagal menghapus akun');
        setIsDeleting(false);
      }
    } catch (e) {
      notify.error('Terjadi kesalahan koneksi');
      setIsDeleting(false);
    }
  };

  const fetchNotifSettings = async () => {
    try {
      const res = await fetch(`${API_URL}/api/users/${email}/settings`);
      if (res.ok) {
        const data = await res.json();
        setNotifSettings({
          notif_message: data.notif_message !== undefined ? data.notif_message : 1,
          notif_like: data.notif_like !== undefined ? data.notif_like : 1,
          notif_comment: data.notif_comment !== undefined ? data.notif_comment : 1,
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (showNotifSettings) {
      fetchNotifSettings();
    }
  }, [showNotifSettings, email]);

  const handleSaveNotifSettings = async () => {
    setIsSavingNotif(true);
    try {
      const res = await fetch(`${API_URL}/api/users/${email}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notifSettings)
      });
      if (res.ok) {
        notify.success('Pengaturan notifikasi disimpan');
        setShowNotifSettings(false);
      } else {
        notify.error('Gagal menyimpan pengaturan');
      }
    } catch (e) {
      notify.error('Kesalahan jaringan');
    }
    setIsSavingNotif(false);
  };

  const handleSendAdminCommand = async () => {
    if (!adminCommandInput.trim() || isSendingCommand) return;
    
    const userMsg = adminCommandInput.trim();
    setAdminCommandMessages(prev => [...prev, { sender: 'me', text: userMsg }]);
    setAdminCommandInput('');
    setIsSendingCommand(true);
    
    try {
      // Import callImoAI dynamically or statically
      const { callImoAI } = await import('./utils/aiConfig');
      const response = await callImoAI('admin_command', adminCommandMessages, userMsg, email, 'imo_ai');
      setAdminCommandMessages(prev => [...prev, { sender: 'imo_ai', text: response }]);
    } catch (e) {
      setAdminCommandMessages(prev => [...prev, { sender: 'imo_ai', text: 'Gagal mengeksekusi perintah: ' + e.message }]);
    } finally {
      setIsSendingCommand(false);
    }
  };

  useEffect(() => {
    if (showAdminCommand && commandEndRef.current) {
      commandEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [adminCommandMessages, showAdminCommand]);

  const isAdmin = email && (email.toLowerCase() === 'admin1' || email.toLowerCase() === 'admin 1' || email.toLowerCase() === 'admin2' || email.toLowerCase() === 'admin 2');

  return (
    <div className="hide-scrollbar" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      
      {/* HEADER SECTION (Cover & Avatar) */}
      <div style={{ position: 'relative', width: '100%', marginBottom: '12cqh' }}>
        {/* Cover Photo */}
        <div style={{ width: '100%', height: '25cqh', background: coverUrl ? `url(${coverUrl}) center/cover no-repeat` : 'linear-gradient(135deg, var(--dark-bg), var(--dark-border))', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.3)' }} />
          
          <div style={{ position: 'absolute', top: '2cqh', left: '4cqw', zIndex: 10 }}>
            <h2 style={{ fontSize: 'var(--font-title)', fontWeight: 'bold', margin: 0, color: 'white', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>Profil</h2>
          </div>
          
          {/* Header Icons */}
          <div style={{ position: 'absolute', top: '2cqh', right: '4cqw', zIndex: 10, display: 'flex', gap: '3cqw' }}>
            <div 
              onClick={() => setShowNotifSettings(true)}
              style={{ cursor: 'pointer', background: 'rgba(0,0,0,0.5)', padding: '2cqw', borderRadius: '50%', backdropFilter: 'blur(4px)', display: 'flex' }}
            >
              <Bell size={20} color="white" />
            </div>
            <div 
              onClick={() => setShowSettingsMenu(true)}
              style={{ cursor: 'pointer', background: 'rgba(0,0,0,0.5)', padding: '2cqw', borderRadius: '50%', backdropFilter: 'blur(4px)', display: 'flex' }}
            >
              <Settings size={20} color="white" />
            </div>
          </div>

          <button
            onClick={handleCoverUpload}
            style={{
              position: 'absolute', bottom: '2cqh', right: '4cqw',
              background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '2cqw',
              padding: '1cqh 2cqw', display: 'flex', gap: '1cqw', alignItems: 'center',
              color: 'white', cursor: 'pointer', backdropFilter: 'blur(4px)', fontSize: 'var(--font-caption)'
            }}
          >
            <Camera size={14} /> Ubah Sampul
          </button>
          <input type="file" accept="image/*" ref={coverInputRef} onChange={handleCoverChange} style={{ display: 'none' }} />
        </div>

        {/* Overlapping Avatar */}
        <div style={{ position: 'absolute', bottom: '-8cqh', left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ position: 'relative', width: '22cqw', height: '22cqw', borderRadius: '50%', padding: '0.8cqw', background: 'var(--dark-bg)' }}>
            {avatar ? (
              <img src={avatar} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'linear-gradient(135deg, #A48BFF, #651FFF)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontWeight: 'bold', fontSize: '8cqw' }}>
                {email.charAt(0).toUpperCase()}
              </div>
            )}
            <button
              onClick={handleAvatarUpload}
              disabled={isUploading}
              style={{
                position: 'absolute', bottom: '1cqw', right: '1cqw',
                background: 'var(--primary)', border: '2px solid var(--dark-bg)', borderRadius: '50%',
                width: '6.5cqw', height: '6.5cqw', display: 'flex', justifyContent: 'center', alignItems: 'center',
                color: 'white', cursor: 'pointer'
              }}
            >
              {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
            </button>
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
          </div>
        </div>
      </div>

      <div style={{ padding: '0 var(--pad-h)', display: 'flex', flexDirection: 'column', gap: '2cqh' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--font-title)', color: 'white', fontWeight: 'bold', marginBottom: '0.5cqh' }}>{originalDisplayName || email}</div>
          <div style={{ fontSize: 'var(--font-body)', color: 'var(--primary)', fontWeight: '600' }}>@{email}</div>
        </div>

        {/* Stats Row */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '4cqw', marginBottom: '1cqh' }}>
          <div onClick={handleOpenMomentsPopup} style={{ background: 'var(--dark-surface)', padding: '2cqh 4cqw', borderRadius: '3cqw', display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, border: '1px solid var(--dark-border)', cursor: momentCount > 0 ? 'pointer' : 'default' }}>
            <span style={{ fontSize: '5cqw', fontWeight: 'bold', color: 'white' }}>{momentCount}</span>
            <span style={{ fontSize: 'var(--font-caption)', color: 'var(--dark-text-muted)' }}>Moments</span>
          </div>
          <div onClick={handleOpenFriendsPopup} style={{ background: 'var(--dark-surface)', padding: '2cqh 4cqw', borderRadius: '3cqw', display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, border: '1px solid var(--dark-border)', cursor: friendCount > 0 ? 'pointer' : 'default' }}>
            <span style={{ fontSize: '5cqw', fontWeight: 'bold', color: 'white' }}>{friendCount}</span>
            <span style={{ fontSize: 'var(--font-caption)', color: 'var(--dark-text-muted)' }}>Teman</span>
          </div>
        </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2cqh' }}>
        {isLoadingProfile ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3cqh 0' }}>
            <Loader2 size={24} className="animate-spin" color="var(--primary)" />
          </div>
        ) : (
          <>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <User className="input-icon" />
              <input
                type="text"
                className="input-field"
                placeholder="Nama Tampilan"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                style={{ padding: '1cqh 3cqw 1cqh 12cqw', fontSize: 'var(--font-body)' }}
              />
            </div>

            <div className="input-group" style={{ marginBottom: 0 }}>
              <textarea
                className="input-field hide-scrollbar"
                placeholder="Bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                style={{ minHeight: '45px', padding: '1.2cqh 4cqw', resize: 'none', fontSize: 'var(--font-caption)', overflowY: 'auto' }}
              />
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="btn-primary"
              style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2cqw', marginTop: '0.5cqh', padding: '1.2cqh 3cqw', borderRadius: '2cqw' }}
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Perbarui Profil
            </button>
          </>
        )}
      </div>

      </div>

      <div style={{ textAlign: 'center', marginTop: 'auto', marginBottom: '1cqh', color: 'var(--dark-text-muted)', fontSize: '10px' }}>
        Versi App: v{import.meta.env.VITE_APP_VERSION_NAME || '1.0.0'}
      </div>

      {/* Settings Menu Modal */}
      {showSettingsMenu && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', zIndex: 1000 }}>
          <div style={{ background: 'var(--dark-surface)', padding: '5cqw', borderTopLeftRadius: '4cqw', borderTopRightRadius: '4cqw', borderTop: '1px solid var(--dark-border)', animation: 'slideUp 0.3s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4cqh' }}>
              <h3 style={{ margin: 0, fontSize: 'var(--font-title)', color: 'white' }}>Pengaturan</h3>
              <X size={24} style={{ color: 'var(--dark-text-muted)', cursor: 'pointer' }} onClick={() => setShowSettingsMenu(false)} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2cqh' }}>
              <button 
                onClick={() => { setShowSettingsMenu(false); setShowNotifSettings(true); }}
                style={{ width: '100%', padding: '2cqh 4cqw', borderRadius: '2cqw', background: 'var(--dark-bg)', border: '1px solid var(--dark-border)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: 'var(--font-body)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '3cqw' }}>
                  <Bell size={18} color="var(--primary)" />
                  Pengaturan Notifikasi
                </div>
                <ChevronRight size={18} color="var(--dark-text-muted)" />
              </button>

              <button 
                onClick={() => { setShowSettingsMenu(false); setShowLogoutConfirm(true); }}
                style={{ width: '100%', padding: '2cqh 4cqw', borderRadius: '2cqw', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#EF4444', display: 'flex', alignItems: 'center', gap: '3cqw', cursor: 'pointer', fontSize: 'var(--font-body)' }}
              >
                <LogOut size={18} />
                Keluar dari Akun
              </button>

              <button 
                onClick={() => { setShowSettingsMenu(false); setShowDeleteConfirm(true); }}
                style={{ width: '100%', padding: '2cqh 4cqw', borderRadius: '2cqw', background: 'rgba(153, 27, 27, 0.1)', border: '1px solid rgba(153, 27, 27, 0.2)', color: '#DC2626', display: 'flex', alignItems: 'center', gap: '3cqw', cursor: 'pointer', fontSize: 'var(--font-body)' }}
              >
                <Trash2 size={18} />
                Hapus Akun
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Moments Popup */}
      {showMomentsPopup && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--dark-bg)', zIndex: 1000, display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ padding: '4cqh 4cqw 2cqh 4cqw', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--dark-border)' }}>
            <h3 style={{ margin: 0, color: 'white', fontSize: 'var(--font-title)' }}>Moments</h3>
            <X size={24} style={{ color: 'var(--dark-text-muted)', cursor: 'pointer' }} onClick={() => setShowMomentsPopup(false)} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '2cqw' }} className="hide-scrollbar">
            {isLoadingMoments ? (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '20cqh' }}>
                <Loader2 size={24} className="animate-spin" color="var(--primary)" />
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1cqw' }}>
                {userMoments.map(m => (
                  <div 
                    key={m.id} 
                    onClick={() => setPreviewMoment(m)}
                    style={{ aspectRatio: '1/1', background: 'var(--dark-surface)', borderRadius: '2cqw', overflow: 'hidden', cursor: 'pointer', border: '1px solid var(--dark-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    {m.image_url ? (
                      <img src={m.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ padding: '2cqw', fontSize: '10px', color: 'var(--dark-text-muted)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                        {m.content}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Moment Preview Popup */}
      {previewMoment && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)', zIndex: 1100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '5cqw', animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ position: 'absolute', top: '4cqh', right: '4cqw', cursor: 'pointer', background: 'rgba(0,0,0,0.5)', padding: '2cqw', borderRadius: '50%' }} onClick={() => setPreviewMoment(null)}>
            <X size={24} color="white" />
          </div>
          <div style={{ width: '100%', maxWidth: '400px', background: 'var(--dark-surface)', borderRadius: '4cqw', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid var(--dark-border)' }}>
            {previewMoment.image_url && (
              <img src={previewMoment.image_url} alt="" style={{ width: '100%', maxHeight: '40cqh', objectFit: 'contain', background: '#000' }} />
            )}
            <div style={{ padding: '4cqw' }}>
              <div style={{ color: 'white', fontSize: 'var(--font-body)', marginBottom: '4cqw', whiteSpace: 'pre-wrap', maxHeight: '20cqh', overflowY: 'auto' }} className="hide-scrollbar">
                {previewMoment.content}
              </div>
              <button 
                onClick={() => { setPreviewMoment(null); navigateToMoment(previewMoment.id); }}
                style={{ width: '100%', padding: '2cqh', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '2cqw', fontSize: 'var(--font-body)', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Lihat Postingan Aslinya
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Friends Popup */}
      {showFriendsPopup && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', zIndex: 1000 }}>
          <div style={{ background: 'var(--dark-surface)', padding: '5cqw', borderTopLeftRadius: '4cqw', borderTopRightRadius: '4cqw', borderTop: '1px solid var(--dark-border)', animation: 'slideUp 0.3s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2cqh' }}>
              <h3 style={{ margin: 0, fontSize: 'var(--font-title)', color: 'white' }}>Teman</h3>
              <X size={24} style={{ color: 'var(--dark-text-muted)', cursor: 'pointer' }} onClick={() => setShowFriendsPopup(false)} />
            </div>

            <div className="hide-scrollbar" style={{ display: 'flex', gap: '4cqw', overflowX: 'auto', paddingBottom: '2cqh' }}>
              {friends.length === 0 ? (
                <div style={{ color: 'var(--dark-text-muted)', fontSize: 'var(--font-caption)', textAlign: 'center', width: '100%' }}>Belum ada teman.</div>
              ) : (
                friends.map(friend => (
                  <div key={friend.username} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1cqh', minWidth: '15cqw' }}>
                    {friend.avatar ? (
                      <img src={friend.avatar} alt="" style={{ width: '12cqw', height: '12cqw', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '12cqw', height: '12cqw', borderRadius: '50%', background: 'linear-gradient(135deg, #A48BFF, #651FFF)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontWeight: 'bold', fontSize: '14px' }}>
                        {friend.displayName ? friend.displayName.charAt(0).toUpperCase() : friend.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span style={{ color: 'white', fontSize: '10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                      {friend.displayName || friend.username}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
      {showSettingsMenu && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', zIndex: 1000 }}>
          <div style={{ background: 'var(--dark-surface)', padding: '5cqw', borderTopLeftRadius: '4cqw', borderTopRightRadius: '4cqw', borderTop: '1px solid var(--dark-border)', animation: 'slideUp 0.3s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4cqh' }}>
              <h3 style={{ margin: 0, fontSize: 'var(--font-title)', color: 'white' }}>Pengaturan</h3>
              <X size={24} style={{ color: 'var(--dark-text-muted)', cursor: 'pointer' }} onClick={() => setShowSettingsMenu(false)} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2cqh' }}>
              <button 
                onClick={() => { setShowSettingsMenu(false); setShowNotifSettings(true); }}
                style={{ width: '100%', padding: '2cqh 4cqw', borderRadius: '2cqw', background: 'var(--dark-bg)', border: '1px solid var(--dark-border)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', fontSize: 'var(--font-body)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '3cqw' }}>
                  <Bell size={18} color="var(--primary)" />
                  Pengaturan Notifikasi
                </div>
                <ChevronRight size={18} color="var(--dark-text-muted)" />
              </button>

              <button 
                onClick={() => { setShowSettingsMenu(false); setShowLogoutConfirm(true); }}
                style={{ width: '100%', padding: '2cqh 4cqw', borderRadius: '2cqw', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#EF4444', display: 'flex', alignItems: 'center', gap: '3cqw', cursor: 'pointer', fontSize: 'var(--font-body)' }}
              >
                <LogOut size={18} />
                Keluar dari Akun
              </button>

              <button 
                onClick={() => { setShowSettingsMenu(false); setShowDeleteConfirm(true); }}
                style={{ width: '100%', padding: '2cqh 4cqw', borderRadius: '2cqw', background: 'rgba(153, 27, 27, 0.1)', border: '1px solid rgba(153, 27, 27, 0.2)', color: '#DC2626', display: 'flex', alignItems: 'center', gap: '3cqw', cursor: 'pointer', fontSize: 'var(--font-body)' }}
              >
                <Trash2 size={18} />
                Hapus Akun
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Settings Modal */}
      {showNotifSettings && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '5cqw' }}>
          <div style={{ background: 'var(--dark-surface)', padding: '5cqw', borderRadius: '4cqw', width: '90%', border: '1px solid var(--dark-border)' }}>
            <h3 style={{ margin: '0 0 3cqh 0', fontSize: 'var(--font-title)', color: 'white', textAlign: 'center' }}>Pengaturan Notifikasi</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2cqh', marginBottom: '3cqh' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'white', fontSize: 'var(--font-body)' }}>Pesan Pribadi</span>
                <input type="checkbox" checked={notifSettings.notif_message === 1} onChange={(e) => setNotifSettings({...notifSettings, notif_message: e.target.checked ? 1 : 0})} style={{ width: '4cqw', height: '4cqw' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'white', fontSize: 'var(--font-body)' }}>Like momen</span>
                <input type="checkbox" checked={notifSettings.notif_like === 1} onChange={(e) => setNotifSettings({...notifSettings, notif_like: e.target.checked ? 1 : 0})} style={{ width: '4cqw', height: '4cqw' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'white', fontSize: 'var(--font-body)' }}>Komentar momen</span>
                <input type="checkbox" checked={notifSettings.notif_comment === 1} onChange={(e) => setNotifSettings({...notifSettings, notif_comment: e.target.checked ? 1 : 0})} style={{ width: '4cqw', height: '4cqw' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '3cqw', width: '100%' }}>
              <button onClick={() => setShowNotifSettings(false)} style={{ flex: 1, padding: '1.5cqh 3cqw', borderRadius: '2cqw', background: 'var(--dark-bg)', border: '1px solid var(--dark-border)', color: 'white', fontWeight: '600', cursor: 'pointer', fontSize: 'var(--font-body)' }}>
                Batal
              </button>
              <button onClick={handleSaveNotifSettings} disabled={isSavingNotif} style={{ flex: 1, padding: '1.5cqh 3cqw', borderRadius: '2cqw', background: 'var(--primary)', border: 'none', color: 'white', fontWeight: '600', cursor: 'pointer', fontSize: 'var(--font-body)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                {isSavingNotif ? <Loader2 size={16} className="animate-spin" /> : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Dialog */}
      {showLogoutConfirm && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '5cqw' }}>
          <div style={{ background: 'var(--dark-surface)', padding: '5cqw', borderRadius: '4cqw', width: '90%', textAlign: 'center', border: '1px solid var(--dark-border)' }}>
            <h3 style={{ margin: '0 0 3cqh 0', fontSize: 'var(--font-title)', color: 'white' }}>Yakin ingin keluar?</h3>
            <div style={{ display: 'flex', gap: '3cqw', width: '100%' }}>
              <button onClick={() => setShowLogoutConfirm(false)} style={{ flex: 1, padding: '1.5cqh 3cqw', borderRadius: '2cqw', background: 'var(--dark-bg)', border: '1px solid var(--dark-border)', color: 'white', fontWeight: '600', cursor: 'pointer', fontSize: 'var(--font-body)' }}>
                Batal
              </button>
              <button onClick={handleLogout} style={{ flex: 1, padding: '1.5cqh 3cqw', borderRadius: '2cqw', background: '#EF4444', border: 'none', color: 'white', fontWeight: '600', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: 'var(--font-body)' }}>
                {isLoggingOut ? <Loader2 size={16} className="animate-spin" /> : 'Keluar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Confirm Modal */}
      {showDeleteConfirm && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '5cqw' }}>
          <div style={{ background: 'var(--dark-surface)', borderRadius: '4cqw', padding: '5cqw', width: '90%', border: '1px solid var(--dark-border)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
              <div style={{ width: '10cqw', height: '10cqw', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '2cqh', color: '#EF4444' }}>
                <Trash2 size={20} />
              </div>
              <h3 style={{ margin: '0 0 2cqh 0', fontSize: 'var(--font-title)', color: 'white' }}>Hapus Akun Permanen?</h3>
              <p style={{ margin: '0 0 3cqh 0', fontSize: 'var(--font-body)', color: 'var(--dark-text-muted)', lineHeight: '1.4' }}>
                Tindakan ini tidak dapat dibatalkan. Semua momen, komentar, dan kontak Anda akan dihapus secara permanen. Tulis "setuju" untuk konfirmasi:
              </p>
              <input 
                type="text" 
                placeholder="Ketik 'setuju'" 
                value={deleteEmailInput}
                onChange={(e) => setDeleteEmailInput(e.target.value)}
                style={{ width: '100%', padding: '1.2cqh 3cqw', borderRadius: '2cqw', background: 'var(--dark-bg)', border: '1px solid var(--dark-border)', color: 'white', marginBottom: '3cqh', fontSize: 'var(--font-body)', outline: 'none' }}
              />
              <div style={{ display: 'flex', gap: '3cqw', width: '100%' }}>
                <button onClick={() => setShowDeleteConfirm(false)} style={{ flex: 1, padding: '1.5cqh 3cqw', borderRadius: '2cqw', background: 'var(--dark-bg)', border: '1px solid var(--dark-border)', color: 'white', fontWeight: '600', cursor: 'pointer', fontSize: 'var(--font-body)' }}>
                  Batal
                </button>
                <button onClick={handleDeleteAccount} disabled={isDeleting} style={{ flex: 1, padding: '1.5cqh 3cqw', borderRadius: '2cqw', background: '#DC2626', border: 'none', color: 'white', fontWeight: '600', cursor: isDeleting ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', opacity: isDeleting ? 0.7 : 1, fontSize: 'var(--font-body)' }}>
                  {isDeleting ? <Loader2 size={16} className="animate-spin" /> : 'Ya, Hapus'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Crop Modal */}
      {imageSrc && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
          <div style={{ padding: '4cqw 4cqw calc(4cqw + 40px) 4cqw', display: 'flex', justifyContent: 'space-between', background: 'var(--dark-surface)', alignItems: 'center' }}>
            <button onClick={() => setImageSrc(null)} style={{ background: 'transparent', border: '1px solid var(--dark-border)', color: 'white', padding: '1.5cqh 4cqw', borderRadius: '2cqw', cursor: 'pointer', fontSize: 'var(--font-body)' }}>Batal</button>
            <button onClick={applyCrop} disabled={isCropping} style={{ background: 'var(--primary)', border: 'none', color: 'white', padding: '1.5cqh 4cqw', borderRadius: '2cqw', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '2cqw', fontSize: 'var(--font-body)' }}>
              {isCropping ? <Loader2 size={16} className="animate-spin" /> : 'Simpan Foto'}
            </button>
          </div>
        </div>
      )}

      {/* Floating Admin Command Bubble (admin1 & admin2 only) */}
      {isAdmin && (
        <div 
          onTouchStart={(e) => {
            dragStartX.current = e.touches[0].clientX;
            isDraggingBubble.current = false;
          }}
          onTouchMove={(e) => {
            const deltaX = dragStartX.current - e.touches[0].clientX;
            if (Math.abs(deltaX) > 10) isDraggingBubble.current = true;
            if (deltaX > 0) {
              setBubbleOffset(deltaX);
            }
          }}
          onTouchEnd={() => {
            if (!isDraggingBubble.current || bubbleOffset > 40) {
              setShowAdminCommand(true);
            }
            setBubbleOffset(0);
          }}
          onClick={() => {
            if (!isDraggingBubble.current) {
              setShowAdminCommand(true);
            }
          }}
          style={{ 
            position: 'fixed', 
            right: `${16 + bubbleOffset}px`, 
            top: '45%', 
            transform: 'translateY(-50%)', 
            background: 'linear-gradient(135deg, #3B82F6, #1D4ED8)', 
            width: '48px', 
            height: '48px', 
            borderRadius: '50%', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            boxShadow: '0 8px 24px rgba(59, 130, 246, 0.5), 0 0 0 2px rgba(255, 255, 255, 0.2)',
            zIndex: 999,
            cursor: 'pointer',
            touchAction: 'none',
            transition: bubbleOffset > 0 ? 'none' : 'right 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }}
        >
          <Terminal size={22} color="white" />
        </div>
      )}

      {/* Admin Command Modal */}
      {showAdminCommand && (
        <div style={{ position: 'absolute', top: 'env(safe-area-inset-top, 0px)', left: 0, right: 0, bottom: 'env(safe-area-inset-bottom, 0px)', background: 'var(--dark-bg)', zIndex: 1100, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2cqh 4cqw', background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3cqw', color: '#3B82F6' }}>
              <Terminal size={20} />
              <h3 style={{ margin: 0, fontSize: 'var(--font-title)' }}>Admin Console</h3>
            </div>
            <X size={24} style={{ color: 'white', cursor: 'pointer' }} onClick={() => setShowAdminCommand(false)} />
          </div>
          
          <div className="hide-scrollbar" style={{ flex: 1, padding: '4cqw', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2cqh', background: '#0F172A' }}>
            {adminCommandMessages.map((msg, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '8px', alignSelf: msg.sender === 'me' ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                {msg.sender === 'imo_ai' && (
                  <img src={imoAiAvatar} alt="Momo" style={{ width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0, marginTop: '2px', background: '#1e293b', objectFit: 'cover' }} />
                )}
                <div style={{ background: msg.sender === 'me' ? 'var(--primary)' : '#1E293B', color: 'white', padding: '2cqh 3cqw', borderRadius: '3cqw', borderBottomRightRadius: msg.sender === 'me' ? '0' : '3cqw', borderBottomLeftRadius: msg.sender === 'imo_ai' ? '0' : '3cqw', wordBreak: 'break-word', fontSize: 'var(--font-body)', fontFamily: msg.sender === 'imo_ai' ? 'monospace' : 'inherit' }}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isSendingCommand && (
              <div style={{ alignSelf: 'flex-start', background: '#1E293B', padding: '2cqh 3cqw', borderRadius: '3cqw', color: '#94A3B8', fontFamily: 'monospace' }}>
                <Loader2 size={16} className="animate-spin" /> Executing...
              </div>
            )}
            <div ref={commandEndRef} />
          </div>
          
          <div style={{ padding: '2cqh 4cqw', background: 'var(--dark-surface)', borderTop: '1px solid var(--dark-border)', display: 'flex', gap: '2cqw' }}>
            <input 
              type="text" 
              value={adminCommandInput}
              onChange={e => setAdminCommandInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSendAdminCommand()}
              placeholder="e.g., matikan fitur kirim gambar untuk @poppiee2"
              style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--dark-border)', color: 'white', padding: '1.5cqh 3cqw', borderRadius: '5cqw', outline: 'none', fontSize: 'var(--font-body)', fontFamily: 'monospace' }}
            />
            <button 
              onClick={handleSendAdminCommand}
              disabled={isSendingCommand || !adminCommandInput.trim()}
              style={{ background: '#3B82F6', border: 'none', color: 'white', width: '12cqw', borderRadius: '5cqw', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: (isSendingCommand || !adminCommandInput.trim()) ? 'not-allowed' : 'pointer', opacity: (isSendingCommand || !adminCommandInput.trim()) ? 0.5 : 1 }}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;

