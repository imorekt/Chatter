import React, { useState, useEffect } from 'react';
import { Search, Play, X, Music as MusicIcon, Loader2, Pause, Clock, Heart } from 'lucide-react';
import { notify } from './utils/toast';
import localforage from 'localforage';

const Music = ({ currentTrack, isPlaying, handlePlayPause, musicResults, setMusicResults, setMusicQueue }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [recentPlays, setRecentPlays] = useState([]);
  const [favoriteSongs, setFavoriteSongs] = useState([]);
  const [activeTab, setActiveTab] = useState('recent'); // 'recent' | 'favorites'

  // Load recent plays and favorites
  useEffect(() => {
    localforage.getItem('music_recent_plays').then((data) => {
      if (data) setRecentPlays(data);
    });
    localforage.getItem('music_favorite_songs').then((data) => {
      if (data) setFavoriteSongs(data);
    });
  }, []);

  const toggleFavorite = (item, e) => {
    e.stopPropagation();
    setFavoriteSongs(prev => {
      const isFav = prev.some(t => t.id === item.id);
      let updated;
      if (isFav) {
        updated = prev.filter(t => t.id !== item.id);
      } else {
        updated = [item, ...prev];
      }
      localforage.setItem('music_favorite_songs', updated);
      return updated;
    });
  };

  const onPlayClick = (item, sourceList) => {
    if (setMusicQueue && sourceList) setMusicQueue(sourceList);
    handlePlayPause(item);
    
    // Save to recent plays
    setRecentPlays(prev => {
      const filtered = prev.filter(t => t.id !== item.id);
      const updated = [item, ...filtered].slice(0, 20); // Keep last 20
      localforage.setItem('music_recent_plays', updated);
      return updated;
    });
  };

  // Debounce logic
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setMusicResults([]);
      setError('');
      return;
    }

    const fetchMusic = async () => {
      setIsLoading(true);
      setError('');
      try {
        const response = await fetch(
          `https://api.audius.co/v1/tracks/search?query=${encodeURIComponent(debouncedQuery)}&app_name=chatapp&limit=50`
        );
        const json = await response.json();

        if (json.data && json.data.length > 0) {
          setMusicResults(json.data);
        } else {
          setMusicResults([]);
          setError('Musik tidak ditemukan di Audius');
        }
      } catch (err) {
        setError('Gagal mengambil data musik. Silakan coba lagi.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMusic();
  }, [debouncedQuery]);

  return (
    <div style={{ padding: '20px', paddingBottom: '180px', color: 'white', background: 'var(--dark-bg)', flex: 1, overflowY: 'auto', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px', gap: '10px' }}>
        <MusicIcon size={24} color="var(--primary)" />
        <h2 style={{ margin: 0, fontSize: '24px' }}>ImoCloud Music</h2>
      </div>

      <div style={{ position: 'relative', marginBottom: '20px' }}>
        <div style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--dark-text-muted)' }}>
          <Search size={20} />
        </div>
        <input
          type="text"
          placeholder="Cari lagu DJ, Remix, atau Artis"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '12px 12px 12px 40px',
            borderRadius: '12px',
            border: '1px solid var(--dark-border)',
            background: 'var(--dark-surface)',
            color: 'white',
            fontSize: '16px',
            outline: 'none',
            boxSizing: 'border-box'
          }}
        />
        {searchQuery && (
          <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--dark-text-muted)', cursor: 'pointer' }} onClick={() => setSearchQuery('')}>
            <X size={20} />
          </div>
        )}
      </div>

      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
          <Loader2 size={32} className="animate-spin" color="var(--primary)" />
        </div>
      )}

      {error && !isLoading && debouncedQuery && (
        <div style={{ textAlign: 'center', color: 'var(--dark-text-muted)', marginTop: '40px' }}>
          {error}
        </div>
      )}

      {!debouncedQuery && !isLoading && (
        <div>
          <div style={{ display: 'flex', gap: '20px', marginBottom: '16px', borderBottom: '1px solid var(--dark-border)' }}>
            <div 
              onClick={() => setActiveTab('recent')}
              style={{ 
                paddingBottom: '8px', 
                color: activeTab === 'recent' ? 'white' : 'var(--dark-text-muted)',
                borderBottom: activeTab === 'recent' ? '2px solid var(--primary)' : '2px solid transparent',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Clock size={16} /> Terakhir Diputar
            </div>
            <div 
              onClick={() => setActiveTab('favorites')}
              style={{ 
                paddingBottom: '8px', 
                color: activeTab === 'favorites' ? 'white' : 'var(--dark-text-muted)',
                borderBottom: activeTab === 'favorites' ? '2px solid var(--primary)' : '2px solid transparent',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Heart size={16} /> Favorit
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(activeTab === 'recent' ? recentPlays : favoriteSongs).map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: currentTrack && currentTrack.id === item.id ? 'rgba(101, 31, 255, 0.15)' : 'var(--dark-surface)',
                  padding: '6px',
                  borderRadius: '10px',
                  border: currentTrack && currentTrack.id === item.id ? '1px solid var(--primary)' : '1px solid var(--dark-border)',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer'
                }}
                onClick={() => onPlayClick(item, activeTab === 'recent' ? recentPlays : favoriteSongs)}
              >
                <img
                  src={item.artwork && item.artwork['150x150'] ? item.artwork['150x150'] : 'https://via.placeholder.com/150'}
                  alt={item.title}
                  style={{ width: '36px', height: '36px', objectFit: 'cover', borderRadius: '6px' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.title}
                  </div>
                  <div style={{ color: 'var(--dark-text-muted)', fontSize: '11px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.user?.name || 'Unknown Artist'}
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '4px' }}>
                  <Heart 
                    size={18} 
                    fill={favoriteSongs.some(t => t.id === item.id) ? "var(--primary)" : "none"}
                    color={favoriteSongs.some(t => t.id === item.id) ? "var(--primary)" : "var(--dark-text-muted)"}
                    onClick={(e) => toggleFavorite(item, e)}
                    style={{ cursor: 'pointer' }}
                  />
                  <button
                    onClick={(e) => { e.stopPropagation(); onPlayClick(item, activeTab === 'recent' ? recentPlays : favoriteSongs); }}
                    style={{
                      background: 'var(--primary)',
                      border: 'none',
                      color: 'white',
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    {currentTrack && currentTrack.id === item.id && isPlaying ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: '2px' }} />}
                  </button>
                </div>
              </div>
            ))}
            
            {(activeTab === 'recent' ? recentPlays : favoriteSongs).length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--dark-text-muted)', marginTop: '20px', fontSize: '14px' }}>
                {activeTab === 'recent' ? 'Belum ada lagu yang diputar.' : 'Belum ada lagu favorit.'}
              </div>
            )}
          </div>
        </div>
      )}

      {!isLoading && !error && debouncedQuery && musicResults.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {musicResults.map((item) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: currentTrack && currentTrack.id === item.id ? 'rgba(101, 31, 255, 0.15)' : 'var(--dark-surface)',
                padding: '12px',
                borderRadius: '12px',
                border: currentTrack && currentTrack.id === item.id ? '1px solid var(--primary)' : '1px solid var(--dark-border)',
                transition: 'all 0.2s ease'
              }}
            >
              <img
                src={item.artwork && item.artwork['150x150'] ? item.artwork['150x150'] : 'https://via.placeholder.com/150'}
                alt={item.title}
                style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px' }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 'bold', fontSize: '15px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.title}
                </div>
                <div style={{ color: 'var(--dark-text-muted)', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.user?.name || 'Unknown Artist'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginRight: '4px' }}>
                <Heart 
                  size={20} 
                  fill={favoriteSongs.some(t => t.id === item.id) ? "var(--primary)" : "none"}
                  color={favoriteSongs.some(t => t.id === item.id) ? "var(--primary)" : "var(--dark-text-muted)"}
                  onClick={(e) => toggleFavorite(item, e)}
                  style={{ cursor: 'pointer' }}
                />
                <button
                  onClick={() => onPlayClick(item, musicResults)}
                  style={{
                    background: 'var(--primary)',
                    border: 'none',
                    color: 'white',
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    cursor: 'pointer',
                    flexShrink: 0
                  }}
                >
                  {currentTrack && currentTrack.id === item.id && isPlaying ? (
                    <Pause size={14} fill="white" />
                  ) : (
                    <Play size={14} fill="white" style={{ marginLeft: '2px' }} />
                  )}
                </button>
              </div>>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Music;
