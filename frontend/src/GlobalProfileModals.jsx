import React, { useState, useEffect } from 'react';
import { X, Loader2, ChevronRight } from 'lucide-react';

const API_URL = window.APP_CONFIG?.API_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001';

const GlobalProfileModals = () => {
  const [showMomentsPopup, setShowMomentsPopup] = useState(false);
  const [showFriendsPopup, setShowFriendsPopup] = useState(false);
  const [targetUser, setTargetUser] = useState(null);
  
  const [userMoments, setUserMoments] = useState([]);
  const [userFriends, setUserFriends] = useState([]);
  
  const [isLoadingMoments, setIsLoadingMoments] = useState(false);
  const [isLoadingFriends, setIsLoadingFriends] = useState(false);

  const [previewMoment, setPreviewMoment] = useState(null);

  useEffect(() => {
    const handleOpenMoments = async (e) => {
      const user = e.detail;
      if (!user || (user.momentCount || 0) === 0) return;
      setTargetUser(user);
      setShowMomentsPopup(true);
      
      const cacheKey = `user_moments_${user.username}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setUserMoments(JSON.parse(cached));
        setIsLoadingMoments(false);
      } else {
        setIsLoadingMoments(true);
      }

      try {
        const res = await fetch(`${API_URL}/api/moments`);
        if (res.ok) {
          const data = await res.json();
          const filtered = data.filter(m => m.username === user.username);
          setUserMoments(filtered);
          localStorage.setItem(cacheKey, JSON.stringify(filtered));
        }
      } catch (err) {}
      setIsLoadingMoments(false);
    };

    const handleOpenFriends = async (e) => {
      const user = e.detail;
      const count = user.username === 'imo_ai' ? user.followerCount : user.friendCount;
      if (!user || (count || 0) === 0) return;
      setTargetUser(user);
      setShowFriendsPopup(true);
      
      const cacheKey = `user_friends_${user.username}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        setUserFriends(JSON.parse(cached));
        setIsLoadingFriends(false);
      } else {
        setIsLoadingFriends(true);
      }

      try {
        const res = await fetch(`${API_URL}/api/contacts/${user.username}`);
        if (res.ok) {
          const data = await res.json();
          const friends = data.friends || [];
          setUserFriends(friends);
          localStorage.setItem(cacheKey, JSON.stringify(friends));
        }
      } catch (err) {}
      setIsLoadingFriends(false);
    };

    window.addEventListener('openPreviewMoments', handleOpenMoments);
    window.addEventListener('openPreviewFriends', handleOpenFriends);
    return () => {
      window.removeEventListener('openPreviewMoments', handleOpenMoments);
      window.removeEventListener('openPreviewFriends', handleOpenFriends);
    };
  }, []);

  const navigateToMoment = (momentId) => {
    setPreviewMoment(null);
    setShowMomentsPopup(false);
    window.dispatchEvent(new CustomEvent('openMoment', { detail: momentId }));
  };

  return (
    <>
      {/* Moments Popup */}
      {showMomentsPopup && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'var(--dark-bg)', zIndex: 10000, display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.2s ease-out' }}>
          <div style={{ padding: '4cqh 4cqw 2cqh 4cqw', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--dark-border)' }}>
            <h3 style={{ margin: 0, color: 'white', fontSize: 'var(--font-title)' }}>Moments {targetUser?.display_name || targetUser?.username}</h3>
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

      {/* Preview Single Moment from Popup */}
      {previewMoment && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.9)', zIndex: 10001, display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.2s ease-out', backdropFilter: 'blur(8px)' }}>
          <div style={{ padding: '4cqh 4cqw', display: 'flex', justifyContent: 'flex-end' }}>
            <X size={28} style={{ color: 'white', cursor: 'pointer' }} onClick={() => setPreviewMoment(null)} />
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '0 4cqw 10cqh 4cqw' }}>
            <div style={{ width: '100%', maxWidth: '500px', background: 'var(--dark-bg)', borderRadius: '4cqw', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
              
              {previewMoment.image_url && (
                <div style={{ width: '100%', aspectRatio: '1/1', background: '#000' }}>
                  <img src={previewMoment.image_url} alt="Moment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              )}
              
              {previewMoment.content && (
                <div style={{ padding: '4cqw' }}>
                  <div style={{ background: 'rgba(164, 139, 255, 0.1)', border: '1px solid rgba(164, 139, 255, 0.2)', padding: '4cqw', borderRadius: '4cqw', borderTopLeftRadius: previewMoment.image_url ? '4cqw' : '1cqw', color: 'white', fontSize: 'var(--font-body)', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                    {previewMoment.content}
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: '4cqw', background: 'var(--dark-surface)', borderTop: '1px solid rgba(255,255,255,0.05)', width: '100%', maxWidth: '500px', marginTop: '4cqh', borderRadius: '4cqw' }}>
              <button 
                onClick={() => navigateToMoment(previewMoment.id)}
                style={{ width: '100%', padding: '3cqh', background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)', color: 'white', border: 'none', borderRadius: '3cqw', fontSize: 'var(--font-body)', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2cqw' }}
              >
                Lihat Postingan Aslinya
                <ChevronRight size={18} />
              </button>
            </div>
            
          </div>
        </div>
      )}

      {/* Friends Popup */}
      {showFriendsPopup && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', zIndex: 10000, padding: '4cqw', paddingTop: '10cqh' }}>
          <div style={{ width: '100%', maxWidth: '400px', maxHeight: '80vh', background: 'var(--dark-surface)', borderRadius: '6cqw', border: '1px solid rgba(255,255,255,0.1)', animation: 'slideDown 0.3s ease-out', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4cqw', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
              <h3 style={{ margin: 0, fontSize: 'var(--font-title)', color: 'white' }}>{targetUser?.username === 'imo_ai' ? 'Follower' : 'Teman'} ({userFriends.length})</h3>
              <X size={24} style={{ color: 'var(--dark-text-muted)', cursor: 'pointer' }} onClick={() => setShowFriendsPopup(false)} />
            </div>

            <div className="hide-scrollbar" style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', flex: 1 }}>
              {isLoadingFriends && userFriends.length === 0 ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '10cqh' }}>
                  <Loader2 size={24} className="animate-spin" color="var(--primary)" />
                </div>
              ) : userFriends.length === 0 ? (
                <div style={{ padding: '8cqw', color: 'var(--dark-text-muted)', fontSize: 'var(--font-caption)', textAlign: 'center' }}>Belum ada {targetUser?.username === 'imo_ai' ? 'follower' : 'teman'}.</div>
              ) : (
                userFriends.map(friend => (
                  <div 
                    key={friend.username} 
                    onClick={() => {
                      setShowFriendsPopup(false);
                      window.dispatchEvent(new CustomEvent('openContactProfile', { detail: friend.username }));
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '4cqw', padding: '4cqw', borderBottom: '1px solid rgba(255,255,255,0.02)', cursor: 'pointer', background: 'transparent' }}
                  >
                    {friend.avatar ? (
                      <img src={friend.avatar} alt="" style={{ width: '12cqw', height: '12cqw', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '12cqw', height: '12cqw', borderRadius: '50%', background: 'linear-gradient(135deg, #A48BFF, #651FFF)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', fontWeight: 'bold', fontSize: '14px' }}>
                        {friend.displayName ? friend.displayName.charAt(0).toUpperCase() : friend.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                      <span style={{ color: 'white', fontSize: 'var(--font-body)', fontWeight: '600' }}>
                        {friend.displayName || friend.username}
                      </span>
                      <span style={{ color: 'var(--primary)', fontSize: 'var(--font-caption)' }}>
                        @{friend.username}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GlobalProfileModals;
