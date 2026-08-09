import React, { useState, useEffect } from 'react';
import { App as CapApp } from '@capacitor/app';
import OneSignalCapacitor from '@onesignal/capacitor-plugin';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { Download } from 'lucide-react';
import Login from './Login';
import Register from './Register';
import ChatList from './ChatList';
import { Toaster } from 'react-hot-toast';

function App() {
  const [user, setUser] = useState(() => localStorage.getItem('chat_user') || null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);
  const [updateUrl, setUpdateUrl] = useState('');
  const [isDownloadingUpdate, setIsDownloadingUpdate] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => {
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      CapApp.addListener('backButton', () => {
        const event = new Event('hardwareBack', { cancelable: true });
        window.dispatchEvent(event);
        if (!event.defaultPrevented) {
          CapApp.exitApp();
        }
      });
    }
  }, []);

  useEffect(() => {
    const appId = import.meta.env.VITE_ONESIGNAL_APP_ID;
    if (appId) {
      if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        // NATIVE ANDROID INIT
        try {
          OneSignalCapacitor.initialize(appId);
          OneSignalCapacitor.Notifications.requestPermission(true).then((success) => {
            console.log("Notification permission granted: " + success);
          });
          OneSignalCapacitor.Notifications.addEventListener('click', (event) => {
            const data = event.notification.additionalData;
            if (data && data.type === 'chat' && data.sender) {
              window.dispatchEvent(new CustomEvent('openChat', { detail: data.sender }));
            }
          });
          if (user) {
            OneSignalCapacitor.login(user);
          }
        } catch (e) {
          console.error("OneSignal Native Init Error:", e);
        }
      } else {
        // WEB BROWSER INIT
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(async function (OneSignal) {
          await OneSignal.init({
            appId: appId,
            notifyButton: { enable: true },
          });
          OneSignal.Slidedown.promptPush();
          OneSignal.Notifications.addEventListener('click', (event) => {
            const data = event.notification.additionalData;
            if (data && data.type === 'chat' && data.sender) {
              window.dispatchEvent(new CustomEvent('openChat', { detail: data.sender }));
            }
          });
          if (user) {
            await OneSignal.login(user);
          }
        });
      }
    }
  }, []);

  useEffect(() => {
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
      try {
        if (user) {
          OneSignalCapacitor.login(user);
        } else {
          OneSignalCapacitor.logout();
        }
      } catch (e) {
        console.error("OneSignal User Change Error:", e);
      }
    } else {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async function (OneSignal) {
        if (user) {
          await OneSignal.login(user);
        } else {
          await OneSignal.logout();
        }
      });
    }
  }, [user]);

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const API_URL = window.APP_CONFIG?.API_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const res = await fetch(`${API_URL}/api/version`);
        const data = await res.json();
        const currentVersion = parseInt(import.meta.env.VITE_APP_VERSION || '1');
        // Jangan tampilkan peringatan update jika sedang jalan di localhost (kecuali di Android/Capacitor yang memang pakai localhost)
        const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform());
        const isLocalhost = !isNative && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        if (!isLocalhost && data.latest_version > currentVersion && data.update_url) {
          setUpdateUrl(data.update_url);
          setShowUpdate(true);
        }
      } catch (err) {
        console.error("Failed to check update", err);
      }
    };
    checkUpdate();
  }, []);

  const handleUpdate = async () => {
    if (!updateUrl) return;

    // Jika di web browser biasa
    if (!window.Capacitor || !window.Capacitor.isNativePlatform()) {
      window.location.href = updateUrl;
      return;
    }

    setIsDownloadingUpdate(true);
    setDownloadProgress(0);
    try {
      const fileName = `update-${Date.now()}.apk`;

      const progressListener = await Filesystem.addListener('progress', (status) => {
        if (status.contentLength > 0) {
          const percent = Math.round((status.bytes / status.contentLength) * 100);
          setDownloadProgress(percent);
        }
      });

      const downloadRes = await Filesystem.downloadFile({
        url: updateUrl,
        path: fileName,
        directory: Directory.Cache,
        progress: true
      });

      await progressListener.remove();

      setIsDownloadingUpdate(false);

      await FileOpener.open({
        filePath: downloadRes.path,
        contentType: 'application/vnd.android.package-archive'
      });
    } catch (err) {
      console.error("Update download failed", err);
      alert("Gagal mengunduh update. Silakan coba lagi.");
      setIsDownloadingUpdate(false);
    }
  };

  const handleLogin = (username) => {
    localStorage.setItem('chat_user', username);
    setUser(username);
  };

  return (
    <div className="app-container">
      {showUpdate && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(5px)'
        }}>
          <div style={{
            backgroundColor: 'var(--surface)', padding: '2rem',
            borderRadius: '16px', width: '85%', maxWidth: '400px',
            textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
          }}>
            <h2 style={{ marginBottom: '1rem', color: '#a086ffff' }}>Update Tersedia!</h2>
            <p style={{ color: 'var(--dark-text-muted)', marginBottom: '2rem', lineHeight: '1.5' }}>
              Kiw versi baru tersedia,, tolong update ya!
            </p>
            <button
              onClick={handleUpdate}
              disabled={isDownloadingUpdate}
              style={{
                width: '100%', padding: '12px', borderRadius: '12px',
                backgroundColor: 'var(--primary)', color: 'white',
                border: 'none', fontWeight: 'bold', fontSize: '1rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '8px'
              }}
            >
              {isDownloadingUpdate ? (
                <>Mengunduh... {downloadProgress}%</>
              ) : (
                <><Download size={20} /> Update Sekarang</>
              )}
            </button>
          </div>
        </div>
      )}
      <Toaster containerStyle={{ position: 'absolute', top: '10px' }} />
      {!user ? (
        isRegistering ? (
          <Register onBackToLogin={() => setIsRegistering(false)} />
        ) : (
          <Login onLogin={handleLogin} onGoToRegister={() => setIsRegistering(true)} />
        )
      ) : (
        <ChatList currentUser={user} onLogout={() => { localStorage.removeItem('chat_user'); setUser(null); }} />
      )}
    </div>
  );
}

export default App;