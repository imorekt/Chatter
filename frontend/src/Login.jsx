import React, { useState, useEffect } from 'react';
import { User, Mail, Lock, EyeOff, Eye, Loader2, ArrowLeft, KeyRound } from 'lucide-react';
import { notify } from './utils/toast';

const Login = ({ onLogin, onGoToRegister }) => {
  const [view, setView] = useState('login'); // 'login' | 'forgot_email' | 'forgot_otp'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => setCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const API_URL = window.APP_CONFIG?.API_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001';

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!email) return notify.error('Email wajib diisi.');
    if (!password) return notify.error('Password wajib diisi.');

    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        notify.success('Login berhasil!');
        setTimeout(() => {
          setIsLoading(false);
          onLogin(data.username);
        }, 3000);
      } else {
        notify.error(data.error || 'Login gagal');
        setIsLoading(false);
      }
    } catch (error) {
      console.error(error);
      notify.error('Terjadi kesalahan jaringan.');
      setIsLoading(false);
    }
  };

  const handleForgotEmailSubmit = async (e) => {
    e.preventDefault();
    if (!email) return notify.error('Email wajib diisi.');

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/forgot-password-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await response.json();
      if (response.ok) {
        notify.success('Kode OTP pemulihan telah dikirim!');
        setView('forgot_otp');
        setCooldown(60);
      } else {
        notify.error(data.error || 'Gagal mengirim OTP');
      }
    } catch (error) {
      notify.error('Terjadi kesalahan jaringan.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async (e) => {
    if (e) e.preventDefault();
    if (cooldown > 0 || isResending) return;

    setIsResending(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/forgot-password-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await response.json();
      if (response.ok) {
        notify.success('Kode OTP pemulihan baru telah dikirim!');
        setCooldown(60);
      } else {
        notify.error(data.error || 'Gagal mengirim ulang OTP');
      }
    } catch (error) {
      notify.error('Terjadi kesalahan jaringan.');
    } finally {
      setIsResending(false);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) return notify.error('Masukkan 6 digit kode OTP.');
    if (newPassword.length < 8) return notify.error('Password minimal 8 karakter.');

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword })
      });
      const data = await response.json();
      if (response.ok) {
        notify.success('Kata sandi berhasil diubah! Silakan login.');
        setPassword('');
        setOtp('');
        setNewPassword('');
        setView('login');
      } else {
        notify.error(data.error || 'Gagal mereset kata sandi');
      }
    } catch (error) {
      notify.error('Terjadi kesalahan jaringan.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="blob-1"></div>
      <div className="blob-2"></div>
      
      <div className="login-header">
        <div className="logo-icon">
          <div className="logo-dots">
            <div className="logo-dot"></div>
            <div className="logo-dot"></div>
            <div className="logo-dot"></div>
          </div>
        </div>
        <h1 className="app-title">Chatter</h1>
        <p className="app-subtitle">
          {view === 'login' && 'Chat dengan siapa saja, kapan saja, di mana saja.'}
          {view === 'forgot_email' && 'Masukkan email untuk pemulihan.'}
          {view === 'forgot_otp' && 'Buat kata sandi baru Anda.'}
        </p>
      </div>

      <div className="login-card">
        {view === 'login' ? (
          <>
            <h2 className="login-card-title">Masuk ke Akun Anda</h2>
            <p className="login-card-subtitle">Selamat datang kembali!</p>

            <form onSubmit={handleLoginSubmit}>
              <div className="input-group">
                <Mail className="input-icon" />
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Email / Username" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <Lock className="input-icon" />
                <input 
                  type={showPassword ? "text" : "password"} 
                  className="input-field" 
                  placeholder="Kata Sandi" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                {showPassword ? (
                  <Eye className="password-toggle" onClick={() => setShowPassword(false)} />
                ) : (
                  <EyeOff className="password-toggle" onClick={() => setShowPassword(true)} />
                )}
              </div>

              <a href="#" onClick={(e) => { e.preventDefault(); setView('forgot_email'); }} className="forgot-password">
                Lupa kata sandi?
              </a>

              <button type="submit" className="btn-primary" disabled={isLoading} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2cqw' }}>
                {isLoading && <Loader2 className="animate-spin" size={20} />}
                Masuk
              </button>
            </form>

            <div className="divider">atau masuk dengan</div>

            <div className="social-buttons" style={{ justifyContent: 'center' }}>
              <button className="btn-social" style={{ maxWidth: '55vw' }} onClick={(e) => { e.preventDefault(); notify.info('Fitur Login Google sedang dalam pengembangan (Coming Soon)!'); }}>
                <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google
              </button>
            </div>

            <p className="signup-text" style={{ marginTop: '6cqh' }}>
              Belum punya akun? <a href="#" onClick={(e) => { e.preventDefault(); onGoToRegister(); }} className="signup-link">Daftar sekarang</a>
            </p>
          </>
        ) : view === 'forgot_email' ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6cqh' }}>
              <button onClick={() => setView('login')} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <ArrowLeft size={20} />
              </button>
              <h2 className="login-card-title" style={{ flex: 1, textAlign: 'center', margin: 0, paddingRight: '5cqw' }}>Lupa Password</h2>
            </div>
            
            <form onSubmit={handleForgotEmailSubmit}>
              <div className="input-group" style={{ marginBottom: '8cqh' }}>
                <Mail className="input-icon" />
                <input 
                  type="email" 
                  className="input-field" 
                  placeholder="Masukkan Email Anda" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="btn-primary" disabled={isLoading} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2cqw' }}>
                {isLoading && <Loader2 className="animate-spin" size={20} />}
                Kirim Kode OTP
              </button>
            </form>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6cqh' }}>
              <button onClick={() => setView('forgot_email')} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <ArrowLeft size={20} />
              </button>
              <h2 className="login-card-title" style={{ flex: 1, textAlign: 'center', margin: 0, paddingRight: '5cqw' }}>Reset Password</h2>
            </div>
            
            <form onSubmit={handleResetPasswordSubmit}>
              <p style={{ textAlign: 'center', marginBottom: '6cqh', fontSize: 'var(--font-body)', color: 'var(--dark-text-muted)' }}>
                Kode OTP telah dikirim ke <b>{email}</b>
              </p>
              
              <div className="input-group">
                <KeyRound className="input-icon" />
                <input 
                  type="text" 
                  className="input-field" 
                  placeholder="Kode OTP 6 Digit" 
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  style={{ textAlign: 'center', letterSpacing: '1cqw', fontSize: '5cqw' }}
                  required
                />
              </div>

              <div className="input-group" style={{ marginBottom: '8cqh' }}>
                <Lock className="input-icon" />
                <input 
                  type={showPassword ? "text" : "password"} 
                  className="input-field" 
                  placeholder="Kata Sandi Baru" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                {showPassword ? (
                  <Eye className="password-toggle" onClick={() => setShowPassword(false)} />
                ) : (
                  <EyeOff className="password-toggle" onClick={() => setShowPassword(true)} />
                )}
              </div>

              <button type="submit" className="btn-primary" disabled={isLoading} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2cqw' }}>
                {isLoading && <Loader2 className="animate-spin" size={20} />}
                Simpan Password Baru
              </button>
              
              <div style={{ textAlign: 'center', marginTop: '4cqh' }}>
                {isResending ? (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2cqw', color: 'var(--primary)', fontSize: 'var(--font-body)' }}>
                    <Loader2 className="animate-spin" size={16} /> Mengirim...
                  </div>
                ) : (
                  <a 
                    href="#" 
                    onClick={handleResendOtp}
                    className="signup-link"
                    style={{ 
                      color: cooldown > 0 ? 'var(--dark-text-muted)' : 'var(--primary)',
                      pointerEvents: cooldown > 0 ? 'none' : 'auto',
                      textDecoration: 'none',
                      display: 'inline-block'
                    }}
                  >
                    {cooldown > 0 ? `Kirim ulang kode dalam ${cooldown}s` : 'Kirim Ulang Kode'}
                  </a>
                )}
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default Login;

