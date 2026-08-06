import React, { useState, useEffect } from 'react';
import Login from './Login';
import Register from './Register';
import ChatList from './ChatList';
import { Toaster } from 'react-hot-toast';

function App() {
  const [user, setUser] = useState(() => localStorage.getItem('chat_user') || null);
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    const appId = import.meta.env.VITE_ONESIGNAL_APP_ID;
    if (appId) {
      if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        // NATIVE ANDROID INIT
        const OneSignal = window.plugins.OneSignal;
        OneSignal.setAppId(appId);
        OneSignal.promptForPushNotificationsWithUserResponse((accepted) => {
          console.log("User accepted notifications: " + accepted);
        });
        if (user) {
          OneSignal.setExternalUserId(user);
        }
      } else {
        // WEB BROWSER INIT
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(async function(OneSignal) {
          await OneSignal.init({
            appId: appId,
            notifyButton: { enable: true },
          });
          OneSignal.Slidedown.promptPush();
          if (user) {
            await OneSignal.login(user);
          }
        });
      }
    }
  }, []);

  useEffect(() => {
    if (window.Capacitor && window.Capacitor.isNativePlatform() && window.plugins && window.plugins.OneSignal) {
      if (user) {
        window.plugins.OneSignal.setExternalUserId(user);
      } else {
        window.plugins.OneSignal.removeExternalUserId();
      }
    } else {
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async function(OneSignal) {
        if (user) {
          await OneSignal.login(user);
        } else {
          await OneSignal.logout();
        }
      });
    }
  }, [user]);

  const handleLogin = (username) => {
    localStorage.setItem('chat_user', username);
    setUser(username);
  };

  return (
    <div className="app-container">
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
