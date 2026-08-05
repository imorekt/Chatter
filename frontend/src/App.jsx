import React, { useState } from 'react';
import Login from './Login';
import Register from './Register';
import ChatList from './ChatList';
import { Toaster } from 'react-hot-toast';

function App() {
  const [user, setUser] = useState(() => localStorage.getItem('chat_user') || null);
  const [isRegistering, setIsRegistering] = useState(false);

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
