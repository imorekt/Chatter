import React, { useState, useRef, useEffect } from 'react';
import { Camera, LogOut, Save, User, Loader2, Trash2, Bell, Terminal, X, Send } from 'lucide-react';
import Cropper from 'react-easy-crop';
import getCroppedImg from './utils/cropImage';
import { notify } from './utils/toast';
import localforage from 'localforage';

const Profile = ({ onLogout, email }) => {
  const [bio, setBio] = useState('Hey there! I am using Chatter.');
  const [displayName, setDisplayName] = useState('');
  const [originalDisplayName, setOriginalDisplayName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteEmailInput, setDeleteEmailInput] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [avatar, setAvatar] = useState(() => localStorage.getItem(`avatar_${email}`) || null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const [notifSettings, setNotifSettings] = useState({ notif_message: 1, notif_like: 1, notif_comment: 1 });
  const [isSavingNotif, setIsSavingNotif] = useState(false);
  const fileInputRef = useRef(null);

  // Admin Command AI State
  const [showAdminCommand, setShowAdminCommand] = useState(false);
  const [adminCommandMessages, setAdminCommandMessages] = useState([{ sender: 'imo_ai', text: 'Halo Admin! Ada perintah untuk dieksekusi hari ini?' }]);
  const [adminCommandInput, setAdminCommandInput] = useState('');
  const [isSendingCommand, setIsSendingCommand] = useState(false);
  const commandEndRef = useRef(null);

  const API_URL = window.APP_CONFIG?.API_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001';

  useEffect(() => {
    localforage.getItem(`profile_${email}`).then(val => {
      if (val) {
        if (val.avatar) setAvatar(val.avatar);
        if (val.display_name) {
          setDisplayName(val.display_name);
          setOriginalDisplayName(val.display_name);
        }
        if (val.bio) setBio(val.bio);
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
        localforage.setItem(`profile_${email}`, data);
        setIsLoadingProfile(false);
      })
      .catch((e) => {
        console.error(e);
        setIsLoadingProfile(false);
      });
  }, [email, API_URL]);

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
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
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
    <div className="hide-scrollbar" style={{ flex: 1, padding: '2cqh var(--pad-h)', display: 'flex', flexDirection: 'column', gap: '2.5cqh', overflowY: 'auto' }}>
      <h2 style={{ fontSize: 'var(--font-title)', fontWeight: 'bold', margin: 0 }}>Profil</h2>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2cqw' }}>
        <div style={{ position: 'relative', width: '20cqw', height: '20cqw' }}>
          {avatar ? (
            <img src={avatar} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', background: 'var(--dark-surface)' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'linear-gradient(135deg, #A48BFF, #651FFF)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontWeight: 'bold', fontSize: '7cqw' }}>
              {email.charAt(0).toUpperCase()}
            </div>
          )}
          <button
            onClick={handleAvatarUpload}
            disabled={isUploading}
            style={{
              position: 'absolute', bottom: 0, right: 0,
              background: 'var(--primary)', border: 'none', borderRadius: '50%',
              width: '6cqw', height: '6cqw', display: 'flex', justifyContent: 'center', alignItems: 'center',
              color: 'white', cursor: 'pointer'
            }}
          >
            {isUploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
          </button>
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--font-title)', color: 'white', fontWeight: 'bold', marginBottom: '0.5cqh' }}>{originalDisplayName || email}</div>
          <div style={{ fontSize: 'var(--font-body)', color: 'var(--primary)', fontWeight: '600' }}>@{email}</div>
          <div style={{ fontSize: 'var(--font-caption)', color: 'var(--dark-text-muted)', marginTop: '0.5cqh' }}>Bergabung sejak: 2026</div>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2cqh', marginTop: '1cqh' }}>
        <button 
          onClick={() => setShowNotifSettings(true)}
          style={{ width: '100%', padding: '1.2cqh 3cqw', borderRadius: '2cqw', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2cqw', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', fontSize: 'var(--font-body)' }}
        >
          <Bell size={18} />
          Notifikasi
        </button>

        <button 
          onClick={() => setShowLogoutConfirm(true)}
          style={{ width: '100%', padding: '1.2cqh 3cqw', borderRadius: '2cqw', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2cqw', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', fontSize: 'var(--font-body)' }}
        >
          <LogOut size={18} />
          Keluar dari Akun
        </button>

        <button 
          onClick={() => setShowDeleteConfirm(true)}
          style={{ width: '100%', padding: '1.2cqh 3cqw', borderRadius: '2cqw', background: 'rgba(153, 27, 27, 0.1)', border: '1px solid rgba(153, 27, 27, 0.2)', color: '#DC2626', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2cqw', fontWeight: '600', cursor: 'pointer', transition: 'all 0.2s', fontSize: 'var(--font-body)' }}
        >
          <Trash2 size={18} />
          Hapus Akun
        </button>
      </div>

      <div style={{ textAlign: 'center', marginTop: 'auto', marginBottom: '1cqh', color: 'var(--dark-text-muted)', fontSize: '10px' }}>
        Versi App: v{import.meta.env.VITE_APP_VERSION_NAME || '1.0.0'}
      </div>

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

      {/* Admin Command Modal */}
      {showAdminCommand && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--dark-bg)', zIndex: 1100, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2cqh 4cqw', background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '3cqw', color: '#3B82F6' }}>
              <Terminal size={20} />
              <h3 style={{ margin: 0, fontSize: 'var(--font-title)' }}>Admin Console</h3>
            </div>
            <X size={24} style={{ color: 'white', cursor: 'pointer' }} onClick={() => setShowAdminCommand(false)} />
          </div>
          
          <div className="hide-scrollbar" style={{ flex: 1, padding: '4cqw', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2cqh', background: '#0F172A' }}>
            {adminCommandMessages.map((msg, idx) => (
              <div key={idx} style={{ alignSelf: msg.sender === 'me' ? 'flex-end' : 'flex-start', background: msg.sender === 'me' ? 'var(--primary)' : '#1E293B', color: 'white', padding: '2cqh 3cqw', borderRadius: '3cqw', borderBottomRightRadius: msg.sender === 'me' ? '0' : '3cqw', borderBottomLeftRadius: msg.sender === 'imo_ai' ? '0' : '3cqw', maxWidth: '80%', wordBreak: 'break-word', fontSize: 'var(--font-body)', fontFamily: msg.sender === 'imo_ai' ? 'monospace' : 'inherit' }}>
                {msg.text}
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

