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
import pusher from './pusher';

export const RestrictionsContext = React.createContext({
  disable_chat_image: false,
  disable_moment_image: false,
  disable_chat: false,
  disable_moment: false,
  full_mute: false
});

function App() {
  const [user, setUser] = useState(() => localStorage.getItem('chat_user') || null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);
  const [updateUrl, setUpdateUrl] = useState('');
  const [isDownloadingUpdate, setIsDownloadingUpdate] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [restrictions, setRestrictions] = useState({
    disable_chat_image: false,
    disable_moment_image: false,
    disable_chat: false,
    disable_moment: false,
    full_mute: false
  });

  const fetchRestrictions = async (username) => {
    try {
      const API_URL = window.APP_CONFIG?.API_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const res = await fetch(`${API_URL}/api/restrictions/${username}`);
      if (res.ok) {
        const data = await res.json();
        setRestrictions(data);
      }
    } catch (e) {
      console.error('Failed to fetch restrictions:', e);
    }
  };

  useEffect(() => {
    if (user) {
      fetchRestrictions(user);
    }
  }, [user]);

  useEffect(() => {
    const channel = pusher.subscribe('global-events');
    channel.bind('restriction-updated', (data) => {
      if (data.username === user || data.username === 'GLOBAL') {
        fetchRestrictions(user);
      }
    });
    return () => {
      channel.unbind('restriction-updated');
      pusher.unsubscribe('global-events');
    };
  }, [user]);

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
            if (data) {
              if (data.type === 'chat' && data.sender) {
                window.dispatchEvent(new CustomEvent('openChat', { detail: data.sender }));
              } else if (data.type === 'friend') {
                window.dispatchEvent(new CustomEvent('openContact'));
              } else if (data.type === 'moment' && data.moment_id) {
                window.dispatchEvent(new CustomEvent('openMoment', { detail: data.moment_id }));
              }
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
            if (data) {
              if (data.type === 'chat' && data.sender) {
                window.dispatchEvent(new CustomEvent('openChat', { detail: data.sender }));
              } else if (data.type === 'friend') {
                window.dispatchEvent(new CustomEvent('openContact'));
              } else if (data.type === 'moment' && data.moment_id) {
                window.dispatchEvent(new CustomEvent('openMoment', { detail: data.moment_id }));
              }
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
        // const API_URL = window.APP_CONFIG?.API_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001';
        // const res = await fetch(`${API_URL}/api/version`);
        // const data = await res.json();
        // const currentVersion = parseInt(import.meta.env.VITE_APP_VERSION || '1');
        // // Jangan tampilkan peringatan update jika sedang jalan di localhost port 3111 (untuk development web)
        // const isNative = !!(window.Capacitor && window.Capacitor.isNativePlatform());
        // const isLocalWebDev = !isNative && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port === '3111';
        // if (!isLocalWebDev && data.latest_version > currentVersion && data.update_url) {
        //   setUpdateUrl(data.update_url);
        //   setShowUpdate(true);
        // }
      } catch (err) {
        // console.error("Failed to check update", err);
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
      {/* Update popup removed completely */}
      <Toaster containerStyle={{ position: 'absolute', top: '10px' }} />
      {!user ? (
        isRegistering ? (
          <Register onBackToLogin={() => setIsRegistering(false)} />
        ) : (
          <Login onLogin={handleLogin} onGoToRegister={() => setIsRegistering(true)} />
        )
      ) : (
        <RestrictionsContext.Provider value={restrictions}>
          <ChatList currentUser={user} onLogout={() => { localStorage.removeItem('chat_user'); setUser(null); }} />
        </RestrictionsContext.Provider>
      )}
    </div>
  );
}

export default App;