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
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async function(OneSignal) {
        await OneSignal.init({
          appId: appId,
          notifyButton: {
            enable: true,
          },
        });
        OneSignal.Slidedown.promptPush();
        if (user) {
          await OneSignal.login(user);
        }
      });
    }
  }, []);

  useEffect(() => {
    if (window.OneSignal) {
      if (user) {
        window.OneSignal.login(user);
      } else {
        window.OneSignal.logout();
      }
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
