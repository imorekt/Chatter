import React, { useState, useEffect, useRef, useContext } from 'react';
import { Heart, MessageSquare, Send, Image as ImageIcon, Loader2, MoreHorizontal, MoreVertical, Trash2, Edit2, Edit3, X, Check } from 'lucide-react';
import { notify } from './utils/toast';
import localforage from 'localforage';
import pusher from './pusher';
import { callImoAI } from './utils/aiConfig';
import { RestrictionsContext } from './App';

let cachedMoments = [];
let hasFetchedMoments = false;

const getUserColor = (username) => {
  if (!username) return 'var(--primary)';
  const lowerUser = username.toLowerCase();
  if (lowerUser === 'admin1' || lowerUser === 'admin 1') return '#EF4444'; // merah menyala
  if (lowerUser === 'admin2' || lowerUser === 'admin 2') return '#991B1B'; // merah gelap
  
  const colors = [
    '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', 
    '#06B6D4', '#F97316', '#14B8A6', '#6366F1', '#84CC16'
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const MomentList = ({ currentUser, highlightMomentId, setHighlightMomentId, selectionMode, selectedItems, toggleSelectItem, contactsData }) => {
  const restrictions = useContext(RestrictionsContext);
  const [moments, setMoments] = useState(cachedMoments);
  const [loading, setLoading] = useState(cachedMoments.length === 0 && !hasFetchedMoments);
  const [newPost, setNewPost] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [commentTexts, setCommentTexts] = useState({});
  const [currentUserAvatar, setCurrentUserAvatar] = useState(null);
  const [currentUserDisplayName, setCurrentUserDisplayName] = useState(currentUser);
  const [showMenuId, setShowMenuId] = useState(null);
  const [editingMomentId, setEditingMomentId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [momentToDelete, setMomentToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [openComments, setOpenComments] = useState({});
  const [likesModalUsers, setLikesModalUsers] = useState(null);
  const [previewModalImage, setPreviewModalImage] = useState(null);
  const [commentActionModal, setCommentActionModal] = useState(null);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editCommentContent, setEditCommentContent] = useState('');
  const [mentionPopupMomentId, setMentionPopupMomentId] = useState(null);
  const [mentionSearchQuery, setMentionSearchQuery] = useState('');
  const [taggableUsers, setTaggableUsers] = useState([]);
  const commentPressTimer = useRef(null);
  const fileInputRef = useRef(null);
  
  const API_URL = window.APP_CONFIG?.API_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001';

  useEffect(() => {
    if (cachedMoments.length === 0) {
      localforage.getItem('moments').then(val => {
        if (val && val.length > 0) {
          setMoments(val);
          cachedMoments = val;
          setLoading(false);
        }
      });
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/api/users/${currentUser}`)
      .then(res => res.json())
      .then(data => {
        if (data.avatar) setCurrentUserAvatar(data.avatar);
        if (data.display_name) setCurrentUserDisplayName(data.display_name);
      })
      .catch(console.error);
  }, [currentUser]);

  useEffect(() => {
    // Generate taggable users from contactsData
    const friends = contactsData?.friends || [];
    const users = friends.map(f => ({
      username: f.username,
      display_name: f.display_name,
      avatar: f.avatar
    }));
    
    // add imo_ai
    users.unshift({
      username: 'imo_ai',
      display_name: 'Imo AI',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=imo_ai'
    });
    setTaggableUsers(users);
  }, [contactsData]);

  useEffect(() => {
    const handleHardwareBack = (e) => {
      if (previewModalImage || likesModalUsers || momentToDelete || editingMomentId || showMenuId || commentActionModal || editingCommentId) {
        e.preventDefault();
        setPreviewModalImage(null);
        setLikesModalUsers(null);
        setMomentToDelete(null);
        setEditingMomentId(null);
        setShowMenuId(null);
        setCommentActionModal(null);
        setEditingCommentId(null);
      }
    };
    window.addEventListener('hardwareBack', handleHardwareBack);
    return () => window.removeEventListener('hardwareBack', handleHardwareBack);
  }, [previewModalImage, likesModalUsers, momentToDelete, editingMomentId, showMenuId, commentActionModal, editingCommentId]);

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
        setNewImageUrl(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const fetchMoments = async () => {
    try {
      const res = await fetch(`${API_URL}/api/moments`);
      if (res.ok) {
        const data = await res.json();
        setMoments(data);
        localforage.setItem('moments', data);
        cachedMoments = data;
        hasFetchedMoments = true;
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMoments();
    
    const channel = pusher.subscribe('global-events');
    channel.bind('new-moment', () => {
      fetchMoments();
    });

    return () => {
      channel.unbind('new-moment');
      pusher.unsubscribe('global-events');
    };
  }, [currentUser]);

  useEffect(() => {
    if (highlightMomentId && moments.length > 0) {
      setOpenComments(prev => ({ ...prev, [highlightMomentId]: true }));
      setTimeout(() => {
        const element = document.getElementById(`moment-${highlightMomentId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.classList.add('blink-once');
          setTimeout(() => {
            if (element) element.classList.remove('blink-once');
            if (setHighlightMomentId) setHighlightMomentId(null);
          }, 2000);
        }
      }, 300);
    }
  }, [highlightMomentId, moments.length, setHighlightMomentId]);

  const handlePost = async () => {
    if (!newPost.trim() && !newImageUrl) return;
    setIsPosting(true);
    try {
      let finalImageUrl = newImageUrl;
      
      // Jika ada gambar (berupa data base64/blob URL), upload dulu ke ImgBB
      if (newImageUrl && newImageUrl.startsWith('data:image/')) {
        const imgbbKey = import.meta.env.VITE_IMGBB_API_KEY;
        if (!imgbbKey) {
          throw new Error("VITE_IMGBB_API_KEY belum dikonfigurasi.");
        }
        
        // Extract base64 part
        const base64Data = newImageUrl.split(',')[1];
        
        const formData = new FormData();
        formData.append('image', base64Data);
        
        // Upload to ImgBB (without expiration parameter, so it lasts forever)
        const imgbbRes = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, {
          method: 'POST',
          body: formData
        });
        
        if (!imgbbRes.ok) {
          throw new Error("Gagal mengupload gambar ke ImgBB");
        }
        
        const imgbbData = await imgbbRes.json();
        if (imgbbData.success) {
          finalImageUrl = imgbbData.data.url; // Use the public direct URL
        } else {
          throw new Error("Gagal mendapatkan link dari ImgBB");
        }
      }

      const res = await fetch(`${API_URL}/api/moments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUser, content: newPost, image_url: finalImageUrl })
      });
      if (res.ok) {
        setNewPost('');
        setNewImageUrl('');
        fetchMoments();
        notify.success('Moment diposting!');
      } else {
        throw new Error("Gagal menyimpan moment ke database");
      }
    } catch (error) {
      console.error(error);
      notify.error(error.message || 'Gagal memposting moment.');
    } finally {
      setIsPosting(false);
    }
  };

  const handleDeleteMoment = (id) => {
    setMomentToDelete(id);
    setShowMenuId(null);
  };

  const confirmDeleteMoment = async () => {
    if (!momentToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${API_URL}/api/moments/${momentToDelete}`, { method: 'DELETE' });
      if (res.ok) {
        notify.success('Moment dihapus');
        fetchMoments();
      }
    } catch (e) {
      notify.error('Gagal menghapus moment');
    } finally {
      setIsDeleting(false);
      setMomentToDelete(null);
    }
  };

  const handleEditMomentSubmit = async (id) => {
    if (!editContent.trim()) return;
    try {
      const res = await fetch(`${API_URL}/api/moments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent })
      });
      if (res.ok) {
        notify.success('Moment diperbarui');
        setEditingMomentId(null);
        fetchMoments();
      }
    } catch (e) {
      notify.error('Gagal mengedit moment');
    }
  };

  const handleLike = async (momentId) => {
    // Optimistic Update
    setMoments(prev => prev.map(m => {
      if (m.id === momentId) {
        const hasLiked = m.liked_by.includes(currentUser);
        let newLikedBy = [...m.liked_by];
        let newLikedByDisplays = [...(m.liked_by_displays || [])];
        if (hasLiked) {
          const index = newLikedBy.indexOf(currentUser);
          if (index > -1) {
            newLikedBy.splice(index, 1);
            newLikedByDisplays.splice(index, 1);
          }
        } else {
          newLikedBy.push(currentUser);
          newLikedByDisplays.push(currentUserDisplayName);
        }
        return { ...m, liked_by: newLikedBy, liked_by_displays: newLikedByDisplays, like_count: newLikedBy.length };
      }
      return m;
    }));

    try {
      const res = await fetch(`${API_URL}/api/moments/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moment_id: momentId, username: currentUser })
      });
      if (!res.ok) throw new Error("Gagal menyukai");
      fetchMoments();
    } catch (error) {
      notify.error("Gagal menyukai");
      fetchMoments();
    }
  };

  const handleComment = async (momentId) => {
    const text = commentTexts[momentId] || '';
    if (!text.trim()) return;
    
    // Optimistic Update
    const tempComment = { id: `temp-${Date.now()}`, username: currentUser, user_display_name: currentUserDisplayName, content: text, created_at: new Date().toISOString() };
    setMoments(prev => prev.map(m => {
      if (m.id === momentId) {
        return { ...m, comments: [...m.comments, tempComment] };
      }
      return m;
    }));
    setCommentTexts(prev => ({ ...prev, [momentId]: '' }));

    try {
      const res = await fetch(`${API_URL}/api/moments/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moment_id: momentId, username: currentUser, content: text })
      });
      if (!res.ok) throw new Error("Gagal mengomentari");
      fetchMoments();

      if (text.includes('@imo_ai') || text.includes('@Imo') || text.includes('@imo')) {
        const moment = moments.find(m => m.id === momentId);
        if (moment) {
          const chatContext = `moment-${momentId}`;
          const history = [
            { sender: moment.username, sender_display: moment.user_display_name, text: moment.content },
            ...(moment.comments || []).map(c => ({ sender: c.username, sender_display: c.user_display_name, text: c.content }))
          ];
          callImoAI(chatContext, history, text, currentUserDisplayName, moment.user_display_name || moment.username)
            .then(async (reply) => {
              const finalReply = `@${currentUserDisplayName} ${reply}`;
              await fetch(`${API_URL}/api/moments/comment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ moment_id: momentId, username: 'imo_ai', content: finalReply })
              });
              fetchMoments();
            })
            .catch(console.error);
        }
      }
    } catch (error) {
      notify.error('Gagal mengirim komentar');
      fetchMoments();
    }
  };

  const handleCommentClick = (momentId, replyUsername) => {
    setOpenComments(prev => ({ ...prev, [momentId]: true }));
    const prefix = `@${replyUsername} `;
    setCommentTexts(prev => ({ ...prev, [momentId]: prefix }));
    setTimeout(() => {
      const input = document.getElementById(`comment-input-${momentId}`);
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    }, 50);
  };

  const handleCommentPressStart = (c, momentId) => {
    const lowerUser = (currentUser || '').toLowerCase();
    const isAdmin = lowerUser === 'admin1' || lowerUser === 'admin 1' || lowerUser === 'admin2' || lowerUser === 'admin 2';
    if (c.username !== currentUser && !isAdmin) return;
    commentPressTimer.current = setTimeout(() => {
      setCommentActionModal({ commentId: c.id, momentId: momentId, text: c.content, isOwner: c.username === currentUser });
    }, 500);
  };

  const handleCommentPressEnd = () => {
    if (commentPressTimer.current) clearTimeout(commentPressTimer.current);
  };

  const handleDeleteComment = async (momentId, commentId) => {
    try {
      const res = await fetch(`${API_URL}/api/moments/comment/${commentId}`, { method: 'DELETE' });
      if (res.ok) {
        notify.success('Komentar dihapus');
        setCommentActionModal(null);
        fetchMoments();
      }
    } catch (e) {
      notify.error('Gagal menghapus');
    }
  };

  const handleEditCommentSubmit = async () => {
    if (!editCommentContent.trim()) return;
    try {
      const res = await fetch(`${API_URL}/api/moments/comment/${editingCommentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editCommentContent })
      });
      if (res.ok) {
        notify.success('Komentar diubah');
        setEditingCommentId(null);
        setEditCommentContent('');
        fetchMoments();
      }
    } catch (e) {
      notify.error('Gagal mengubah');
    }
  };

  const formatDate = (dateString) => {
    const safeDateString = typeof dateString === 'string' && !dateString.includes('T') 
      ? dateString.replace(' ', 'T') + 'Z' 
      : dateString;
    const date = new Date(safeDateString);
    return date.toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).replace(/\./g, ':') + ' WIB';
  };

  return (
    <div className="hide-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '4cqw', background: 'transparent', minHeight: 0 }}>
      {/* Post Creator */}
      {(!restrictions?.full_mute && !restrictions?.disable_moment) && (
        <div style={{ background: 'var(--dark-surface)', padding: '3cqw', borderRadius: '3cqw', marginBottom: '3cqh' }}>
          <div style={{ display: 'flex', gap: '3cqw', marginBottom: '1.5cqh' }}>
          {currentUserAvatar ? (
            <img src={currentUserAvatar} alt="Avatar" style={{ width: '8cqw', height: '8cqw', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{ width: '8cqw', height: '8cqw', borderRadius: '50%', background: 'var(--primary)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontWeight: 'bold', flexShrink: 0 }}>
              {currentUser ? currentUser.charAt(0).toUpperCase() : 'U'}
            </div>
          )}
          <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: '2.5cqw', padding: '2.5cqw', display: 'flex', flexDirection: 'column' }}>
            <textarea 
              className="hide-scrollbar"
              placeholder="Apa yang Anda pikirkan?"
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              style={{ width: '100%', background: 'transparent', border: 'none', color: 'white', outline: 'none', resize: 'none', minHeight: '5cqh', overflowY: 'auto', fontSize: 'var(--font-body)', fontFamily: 'inherit' }}
              onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = Math.max(e.target.scrollHeight, 40) + 'px'; }}
            />
            {newImageUrl && (
              <div style={{ position: 'relative', marginTop: '1.5cqh', width: 'fit-content' }}>
                <img src={newImageUrl} alt="Preview" style={{ maxHeight: '15cqh', borderRadius: '1.5cqw', objectFit: 'cover' }} />
                <div onClick={() => setNewImageUrl('')} style={{ position: 'absolute', top: '-1cqw', right: '-1cqw', background: '#EF4444', color: 'white', borderRadius: '50%', padding: '0.5cqw', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                  <X size={14} />
                </div>
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <input 
              type="file" 
              accept="image/*" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              onChange={handleImageUpload} 
            />
            {!restrictions?.disable_moment_image && (
              <div 
                onClick={() => fileInputRef.current?.click()} 
                style={{ display: 'flex', alignItems: 'center', gap: '2cqw', background: 'rgba(255,255,255,0.05)', padding: '1.2cqh 3cqw', borderRadius: '2cqw', cursor: 'pointer', color: 'var(--dark-text-muted)', fontSize: 'var(--font-caption)' }}
              >
                <ImageIcon size={18} />
                <span>Gambar</span>
              </div>
            )}
          </div>
          <button 
            onClick={handlePost} 
            disabled={isPosting || (!newPost.trim() && !newImageUrl)}
            style={{ background: 'var(--primary)', color: 'white', border: 'none', padding: '1.2cqh 4cqw', borderRadius: '4cqw', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '2cqw', cursor: 'pointer', opacity: ((!newPost.trim() && !newImageUrl) || isPosting) ? 0.5 : 1 }}
          >
            {isPosting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Posting
          </button>
        </div>
      </div>
      )}

      {/* Moments Feed */}
      {loading ? (
        <div style={{ textAlign: 'center', marginTop: '10cqh' }}><Loader2 size={24} className="animate-spin" color="var(--primary)" style={{ margin: '0 auto' }} /></div>
      ) : moments.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--dark-text-muted)', marginTop: '10cqh' }}>Belum ada moment. Jadilah yang pertama memposting!</div>
      ) : (
        moments.map(moment => {
          const hasLiked = moment.liked_by.includes(currentUser);
          return (
            <div id={`moment-${moment.id}`} key={moment.id} onClick={() => { if (selectionMode) toggleSelectItem(moment.id); }} style={{ position: 'relative', background: 'var(--dark-surface)', padding: '3cqw', borderRadius: '3cqw', marginBottom: '2cqh', transition: 'background-color 0.5s ease', cursor: selectionMode ? 'pointer' : 'default', border: selectionMode && selectedItems?.has(moment.id) ? '1px solid var(--primary)' : '1px solid transparent' }}>
                {selectionMode && (
                  <div style={{ position: 'absolute', top: '3cqw', right: '3cqw', zIndex: 10 }}>
                    <input 
                      type="checkbox" 
                      checked={selectedItems?.has(moment.id) || false} 
                      onChange={() => toggleSelectItem(moment.id)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ width: '20px', height: '20px', cursor: 'pointer' }}
                    />
                  </div>
                )}
              <div style={{ display: 'flex', gap: '3cqw', marginBottom: '1.5cqh' }}>
                {moment.user_avatar ? (
                  <img src={moment.user_avatar} alt="Avatar" style={{ width: '8cqw', height: '8cqw', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: '8cqw', height: '8cqw', borderRadius: '50%', background: 'linear-gradient(135deg, #A48BFF, #651FFF)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontWeight: 'bold', flexShrink: 0 }}>
                    {moment.user_display_name ? moment.user_display_name.charAt(0).toUpperCase() : moment.username.charAt(0).toUpperCase()}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', color: getUserColor(moment.username), fontSize: 'var(--font-body)' }}>{moment.user_display_name || moment.username}</div>
                  <div style={{ fontSize: 'var(--font-caption)', color: 'var(--dark-text-muted)' }}>{formatDate(moment.created_at)}</div>
                </div>
                {(() => {
                  const lowerUser = (currentUser || '').toLowerCase();
                  const isAdmin = lowerUser === 'admin1' || lowerUser === 'admin 1' || lowerUser === 'admin2' || lowerUser === 'admin 2';
                  return (moment.username === currentUser || isAdmin) && !selectionMode;
                })() && (
                  <div style={{ position: 'relative' }}>
                    <div style={{ cursor: 'pointer', padding: '1cqw', color: 'var(--dark-text-muted)' }} onClick={() => setShowMenuId(showMenuId === moment.id ? null : moment.id)}>
                      <MoreVertical size={20} />
                    </div>
                    {showMenuId === moment.id && (
                      <div style={{ position: 'absolute', top: '100%', right: 0, background: 'var(--dark-surface)', border: '1px solid var(--dark-border)', borderRadius: '2cqw', zIndex: 10, padding: '2cqw', minWidth: '30cqw', display: 'flex', flexDirection: 'column', gap: '2cqw' }}>
                        <div onClick={() => { setEditingMomentId(moment.id); setEditContent(moment.content); setShowMenuId(null); }} style={{ padding: '2cqw', color: 'white', cursor: 'pointer', display: 'flex', gap: '3cqw', alignItems: 'center', fontSize: '14px' }}>
                          <Edit3 size={18} /> Edit
                        </div>
                        <div onClick={() => handleDeleteMoment(moment.id)} style={{ padding: '2cqw', color: '#EF4444', cursor: 'pointer', display: 'flex', gap: '3cqw', alignItems: 'center', fontSize: '14px' }}>
                          <Trash2 size={18} /> Hapus
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {editingMomentId === moment.id ? (
                <div style={{ marginBottom: '1.5cqh' }}>
                  <textarea 
                    className="hide-scrollbar"
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--primary)', borderRadius: '2.5cqw', padding: '2.5cqw', color: 'white', outline: 'none', resize: 'none', minHeight: '7cqh', overflowY: 'auto', fontSize: 'var(--font-body)', fontFamily: 'inherit' }}
                    onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = Math.max(e.target.scrollHeight, 50) + 'px'; }}
                  />
                  <div style={{ display: 'flex', gap: '2cqw', marginTop: '1cqh', justifyContent: 'flex-end' }}>
                    <button onClick={() => setEditingMomentId(null)} style={{ background: 'transparent', border: '1px solid var(--dark-border)', color: 'white', padding: '0.8cqh 2cqw', borderRadius: '1.5cqw', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1cqw', fontSize: 'var(--font-caption)' }}><X size={14}/> Batal</button>
                    <button onClick={() => handleEditMomentSubmit(moment.id)} style={{ background: 'var(--primary)', border: 'none', color: 'white', padding: '0.8cqh 2cqw', borderRadius: '1.5cqw', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1cqw', fontSize: 'var(--font-caption)' }}><Check size={14}/> Simpan</button>
                  </div>
                </div>
              ) : (
                <div style={{ color: 'var(--dark-text)', fontSize: 'var(--font-body)', lineHeight: '1.4', marginBottom: '1.5cqh' }}>
                  {moment.content.split(' ').map((word, i) => word.startsWith('@') ? <span key={i} style={{ color: 'var(--primary)' }}>{word} </span> : word + ' ')}
                </div>
              )}
              
              {moment.image_url && (
                <div style={{ marginBottom: '2cqh', borderRadius: '2cqw', overflow: 'hidden', background: '#000', cursor: 'pointer', width: '100%', aspectRatio: '1/1', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setPreviewModalImage(moment.image_url)}>
                  <img src={moment.image_url} alt="Moment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
              
              <div style={{ display: 'flex', gap: '4cqw', borderTop: '1px solid var(--dark-border)', paddingTop: '0.6cqh', marginTop: '1.2cqh' }}>
                <div onClick={() => handleLike(moment.id)} style={{ display: 'flex', alignItems: 'center', gap: '1.5cqw', color: hasLiked ? '#EF4444' : 'var(--dark-text-muted)', cursor: 'pointer', fontSize: 'var(--font-body)', transition: 'color 0.2s' }}>
                  <Heart size={18} fill={hasLiked ? '#EF4444' : 'none'} />
                  {moment.like_count > 0 && <span>{moment.like_count}</span>}
                </div>
                <div onClick={() => setOpenComments(prev => ({ ...prev, [moment.id]: !prev[moment.id] }))} style={{ display: 'flex', alignItems: 'center', gap: '1.5cqw', color: openComments[moment.id] ? 'var(--primary)' : 'var(--dark-text-muted)', cursor: 'pointer', fontSize: 'var(--font-body)' }}>
                  <MessageSquare size={18} />
                  {moment.comments.length > 0 && <span>{moment.comments.length}</span>}
                </div>
              </div>

              {/* Likes List */}
              {moment.liked_by.length > 0 && (
                <div 
                  onClick={() => setLikesModalUsers(moment.liked_by_displays || moment.liked_by)}
                  style={{ marginTop: '0.8cqh', padding: '0.8cqh 2cqw', background: 'rgba(255,255,255,0.03)', borderRadius: '2cqw', fontSize: 'var(--font-caption)', color: 'var(--dark-text-muted)', display: 'flex', alignItems: 'center', gap: '1.5cqw', cursor: 'pointer' }}
                >
                  <Heart size={12} fill="var(--dark-text-muted)" />
                  <span>
                    Disukai oleh{' '}
                    <span style={{ color: 'var(--primary)', fontWeight: '600' }}>
                      {(moment.liked_by_displays || moment.liked_by).slice(0, 3).join(', ')}
                    </span>
                    {moment.liked_by.length > 3 && (
                      <span> dan <span style={{ fontWeight: '600', color: 'white' }}>{moment.liked_by.length - 3} orang lainnya</span></span>
                    )}
                  </span>
                </div>
              )}

              {/* Comments Section & Input toggled via icon */}
              {openComments[moment.id] && (
                <>
                  {moment.comments.length > 0 && (
                    <div style={{ marginTop: '0.8cqh', display: 'flex', flexDirection: 'column', gap: '0.3cqh' }}>
                      {moment.comments.map(c => (
                        <div 
                          key={c.id} 
                          onClick={() => handleCommentClick(moment.id, c.user_display_name || c.username)}
                          onTouchStart={() => handleCommentPressStart(c, moment.id)}
                          onTouchEnd={handleCommentPressEnd}
                          onTouchMove={handleCommentPressEnd}
                          onMouseDown={() => handleCommentPressStart(c, moment.id)}
                          onMouseUp={handleCommentPressEnd}
                          onMouseLeave={handleCommentPressEnd}
                          style={{ fontSize: 'var(--font-body)', lineHeight: '1.4', cursor: 'pointer', padding: '2px 4px', background: commentActionModal?.commentId === c.id ? 'rgba(255,255,255,0.1)' : 'transparent', borderRadius: '4px', marginBottom: '2px' }}
                        >
                          <span style={{ color: getUserColor(c.username), fontWeight: '600', marginRight: '1.5cqw' }}>{c.user_display_name || c.username}:</span>
                          <span style={{ color: 'var(--dark-text)', whiteSpace: 'pre-wrap' }}>{c.content.split(' ').map((word, i) => word.startsWith('@') ? <span key={i} style={{ color: 'var(--primary)' }}>{word} </span> : word + ' ')}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '2cqw', marginTop: '1.2cqh', alignItems: 'flex-end', position: 'relative' }}>
                    {mentionPopupMomentId === moment.id && (
                      <div style={{ position: 'absolute', bottom: '100%', left: 0, marginBottom: '8px', background: '#1A1F2E', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', border: '1px solid #2D3348', zIndex: 50, width: '220px', maxHeight: '200px', overflowY: 'auto', padding: '4px' }} className="hide-scrollbar">
                        {taggableUsers.filter(u => u.username.toLowerCase().includes(mentionSearchQuery) || (u.display_name && u.display_name.toLowerCase().includes(mentionSearchQuery))).map((user, idx) => (
                          <div 
                            key={idx} 
                            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', cursor: 'pointer', borderBottom: '1px solid rgba(51, 65, 85, 0.5)', transition: 'background 0.2s' }}
                            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#334155'}
                            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            onClick={() => {
                                setCommentTexts(prev => {
                                  const text = prev[moment.id] || '';
                                  const parts = text.split('@');
                                  parts.pop(); // remove the query part
                                  return { ...prev, [moment.id]: parts.join('@') + (parts.length > 0 ? '@' : '') + user.username + ' ' };
                                });
                                setMentionPopupMomentId(null);
                                setMentionSearchQuery('');
                                document.getElementById(`comment-input-${moment.id}`)?.focus();
                            }}>
                            {user.avatar ? (
                              <img src={user.avatar} style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#334155', objectFit: 'cover', flexShrink: 0 }} alt="" />
                            ) : (
                              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#334155', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '500', color: 'white', flexShrink: 0 }}>{user.username.charAt(0).toUpperCase()}</div>
                            )}
                            <div className="flex flex-col">
                              <span className="text-white text-[14px] font-bold">{user.display_name || user.username}</span>
                              <span className="text-[#8B95A5] text-[12px]">@{user.username} {user.username === 'imo_ai' && '- Asisten AI'}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ position: 'relative', flex: 1, display: 'flex' }}>
                      <textarea 
                        id={`comment-input-${moment.id}`}
                        className="hide-scrollbar"
                        rows={1}
                        placeholder="Tulis komentar..."
                        value={commentTexts[moment.id] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCommentTexts(prev => ({...prev, [moment.id]: val}));
                          
                          // Deteksi pola @username
                          const mentionMatch = val.match(/@([a-zA-Z0-9_.-]*)$/);
                          if (mentionMatch) {
                            setMentionSearchQuery(mentionMatch[1].toLowerCase());
                            setMentionPopupMomentId(moment.id);
                          } else {
                            if (mentionPopupMomentId === moment.id) {
                              setMentionPopupMomentId(null);
                              setMentionSearchQuery('');
                            }
                          }
                        }}
                        style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--dark-border)', borderRadius: '3cqw', padding: '1cqh 3cqw', color: 'white', outline: 'none', resize: 'none', fontSize: 'var(--font-caption)', fontFamily: 'inherit', minHeight: '4.5cqh', overflowY: 'auto' }}
                        onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = Math.max(e.target.scrollHeight, 36) + 'px'; }}
                      />
                    </div>
                    <button onClick={() => handleComment(moment.id)} style={{ background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '50%', width: '7cqw', height: '7cqw', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
                      <Send size={14} />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })
      )}
      
      {/* Comment Action Modal */}
      {commentActionModal && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '5cqw' }} onClick={() => setCommentActionModal(null)}>
          <div style={{ background: 'var(--dark-surface)', padding: '5cqw', borderRadius: '4cqw', width: '90%', border: '1px solid var(--dark-border)', display: 'flex', flexDirection: 'column', gap: '3cqh' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: '0', fontSize: 'var(--font-title)', color: 'white', textAlign: 'center', borderBottom: '1px solid var(--dark-border)', paddingBottom: '3cqh' }}>Aksi Komentar</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2cqh' }}>
              {commentActionModal.isOwner && (
                <button
                  onClick={() => {
                    setEditingCommentId(commentActionModal.commentId);
                    setEditCommentContent(commentActionModal.text);
                    setCommentActionModal(null);
                  }}
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid var(--dark-border)', borderRadius: '2cqw', padding: '2cqh 4cqw', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2cqw' }}
                >
                  <Edit3 size={18} /> Edit Komentar
                </button>
              )}
              <button
                onClick={() => handleDeleteComment(commentActionModal.momentId, commentActionModal.commentId)}
                style={{ background: 'rgba(255,59,48,0.1)', color: '#ff3b30', border: '1px solid rgba(255,59,48,0.3)', borderRadius: '2cqw', padding: '2cqh 4cqw', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2cqw' }}
              >
                <Trash2 size={18} /> Hapus Komentar
              </button>
              
              <button
                onClick={() => setCommentActionModal(null)}
                style={{ background: 'transparent', color: 'var(--dark-text-muted)', border: 'none', fontWeight: '600', cursor: 'pointer', marginTop: '1cqh', padding: '1cqh' }}
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Comment Modal */}
      {editingCommentId && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '5cqw' }}>
          <div style={{ background: 'var(--dark-surface)', padding: '5cqw', borderRadius: '4cqw', width: '90%', border: '1px solid var(--dark-border)' }}>
            <h3 style={{ margin: '0 0 3cqh 0', fontSize: 'var(--font-title)', color: 'white' }}>Edit Komentar</h3>
            <textarea 
              value={editCommentContent}
              onChange={(e) => setEditCommentContent(e.target.value)}
              className="hide-scrollbar"
              style={{ width: '100%', minHeight: '12cqh', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--dark-border)', borderRadius: '2cqw', padding: '3cqw', color: 'white', resize: 'none', fontSize: 'var(--font-body)', outline: 'none' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '3cqw', marginTop: '4cqh' }}>
              <button onClick={() => setEditingCommentId(null)} style={{ background: 'transparent', color: 'var(--dark-text-muted)', border: 'none', fontWeight: '600', cursor: 'pointer' }}>
                Batal
              </button>
              <button onClick={handleEditCommentSubmit} style={{ background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '2cqw', padding: '1.5cqh 4cqw', fontWeight: '600', cursor: 'pointer' }}>
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {momentToDelete && (
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
            <h3 style={{ margin: '0 0 4cqh 0', fontSize: 'var(--font-title)', color: 'white' }}>Hapus Moment?</h3>
            <p style={{ color: 'var(--dark-text-muted)', fontSize: 'var(--font-body)', marginBottom: '6cqh', lineHeight: '1.5' }}>
              Anda yakin ingin menghapus postingan ini? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div style={{ display: 'flex', gap: '3cqw' }}>
              <button onClick={() => setMomentToDelete(null)} disabled={isDeleting} style={{ flex: 1, padding: '3cqw', background: 'transparent', border: '1px solid var(--dark-border)', color: 'white', borderRadius: '2cqw', cursor: 'pointer', opacity: isDeleting ? 0.5 : 1 }}>
                Batal
              </button>
              <button onClick={confirmDeleteMoment} disabled={isDeleting} style={{ flex: 1, padding: '3cqw', background: '#EF4444', border: 'none', color: 'white', borderRadius: '2cqw', cursor: 'pointer', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2cqw', opacity: isDeleting ? 0.7 : 1 }}>
                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Likes Modal */}
      {likesModalUsers && (
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3cqh' }}>
              <h3 style={{ margin: 0, fontSize: 'var(--font-title)', color: 'white', display: 'flex', alignItems: 'center', gap: '2cqw' }}>
                <Heart size={18} fill="#EF4444" color="#EF4444" /> Menyukai ({likesModalUsers.length})
              </h3>
              <X size={20} onClick={() => setLikesModalUsers(null)} style={{ cursor: 'pointer', color: 'var(--dark-text-muted)' }} />
            </div>

            <div 
              className="hide-scrollbar" 
              style={{ maxHeight: '35cqh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.5cqh' }}
            >
              {likesModalUsers.map(uname => (
                <div key={uname} style={{ display: 'flex', alignItems: 'center', gap: '3cqw', padding: '1cqh 2cqw', borderRadius: '2cqw', background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ width: '8cqw', height: '8cqw', borderRadius: '50%', background: 'var(--primary)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontWeight: 'bold', flexShrink: 0 }}>
                    {uname.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ fontWeight: '600', fontSize: 'var(--font-body)', color: getUserColor(uname) }}>{uname}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {previewModalImage && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.95)', backdropFilter: 'blur(8px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999,
          padding: '2cqh'
        }} onClick={() => setPreviewModalImage(null)}>
          <X size={24} color="white" style={{ position: 'absolute', top: '4cqh', right: '4cqw', cursor: 'pointer', zIndex: 10000 }} onClick={(e) => { e.stopPropagation(); setPreviewModalImage(null); }} />
          <img src={previewModalImage} alt="Fullscreen Preview" style={{ maxWidth: '100%', maxHeight: '90%', objectFit: 'contain' }} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
};

export default MomentList;

