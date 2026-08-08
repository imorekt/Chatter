import React, { useState, useEffect } from 'react';
import { Search, Play, X, Music as MusicIcon, Loader2, Pause, Clock } from 'lucide-react';
import { notify } from './utils/toast';
import localforage from 'localforage';

const Music = ({ currentTrack, isPlaying, handlePlayPause, musicResults, setMusicResults }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [recentPlays, setRecentPlays] = useState([]);

  // Load recent plays
  useEffect(() => {
    localforage.getItem('music_recent_plays').then((data) => {
      if (data) setRecentPlays(data);
    });
  }, []);

  const onPlayClick = (item) => {
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

      {!debouncedQuery && !isLoading && recentPlays.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', color: 'var(--dark-text-muted)' }}>
            <Clock size={16} />
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: '600' }}>Terakhir Diputar</h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {recentPlays.map((item) => (
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
                <button
                  onClick={() => onPlayClick(item)}
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
                    <Pause size={20} />
                  ) : (
                    <Play size={20} style={{ marginLeft: '2px' }} />
                  )}
                </button>
              </div>
            ))}
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
              <button
                onClick={() => onPlayClick(item)}
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
                  <Pause size={20} />
                ) : (
                  <Play size={20} style={{ marginLeft: '2px' }} />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Music;
