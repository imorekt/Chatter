import React, { useState, useEffect } from 'react';
import { User, Mail, Lock, EyeOff, Eye, Loader2, ArrowLeft, KeyRound } from 'lucide-react';
import { notify } from './utils/toast';

const Register = ({ onBackToLogin }) => {
  const [step, setStep] = useState('form'); // 'form' | 'otp'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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

  // Fallback to localhost:3001 if API_URL not set
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  const handleRegisterForm = async (e) => {
    e.preventDefault();
    
    if (!username) return notify.error('Username wajib diisi.');
    if (username.length < 6) return notify.error('Username minimal 6 karakter.');
    if (!email) return notify.error('Email wajib diisi.');
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return notify.error('Format email tidak valid.');
    }
    
    if (password.length < 8) {
      return notify.error('Password minimal 8 karakter.');
    }
    
    const numberRegex = /\d/;
    if (!numberRegex.test(password)) {
      return notify.error('Password wajib mengandung angka.');
    }
    
    if (password !== confirmPassword) {
      return notify.error('Konfirmasi password tidak cocok.');
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        notify.success('Kode OTP telah dikirim ke email Anda.');
        setStep('otp');
        setCooldown(60);
      } else {
        notify.error(data.error || 'Gagal mengirim OTP.');
      }
    } catch (error) {
      console.error(error);
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
      const response = await fetch(`${API_URL}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await response.json();
      if (response.ok) {
        notify.success('Kode OTP baru telah dikirim!');
        setCooldown(60);
      } else {
        notify.error(data.error || 'Gagal mengirim ulang OTP.');
      }
    } catch (error) {
      console.error(error);
      notify.error('Terjadi kesalahan jaringan.');
    } finally {
      setIsResending(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    
    if (otp.length !== 6) {
      return notify.error('Masukkan 6 digit kode OTP.');
    }

    setIsLoading(true);
    
    try {
      const response = await fetch(`${API_URL}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, otp })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        notify.success('Akun berhasil dibuat dan diverifikasi!');
        onBackToLogin();
      } else {
        notify.error(data.error || 'Kode OTP salah.');
      }
    } catch (error) {
      console.error(error);
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
          {step === 'form' ? 'Buat akun baru untuk mulai chat.' : 'Verifikasi email Anda.'}
        </p>
      </div>

      <div className="login-card">
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '6cqh' }}>
          <button onClick={() => step === 'otp' ? setStep('form') : onBackToLogin()} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <ArrowLeft size={20} />
          </button>
          <h2 className="login-card-title" style={{ flex: 1, textAlign: 'center', margin: 0, paddingRight: '5cqw' }}>
            {step === 'form' ? 'Daftar Akun' : 'Verifikasi OTP'}
          </h2>
        </div>

        {step === 'form' ? (
          <form onSubmit={handleRegisterForm}>
            <div className="input-group">
              <User className="input-icon" />
              <input 
                type="text" 
                className="input-field" 
                placeholder="Username" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <Mail className="input-icon" />
              <input 
                type="email" 
                className="input-field" 
                placeholder="Email" 
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

            <div className="input-group" style={{ marginBottom: '8cqh' }}>
              <Lock className="input-icon" />
              <input 
                type={showConfirmPassword ? "text" : "password"} 
                className="input-field" 
                placeholder="Konfirmasi Kata Sandi" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              {showConfirmPassword ? (
                <Eye className="password-toggle" onClick={() => setShowConfirmPassword(false)} />
              ) : (
                <EyeOff className="password-toggle" onClick={() => setShowConfirmPassword(true)} />
              )}
            </div>

            <button type="submit" className="btn-primary" disabled={isLoading} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2cqw' }}>
              {isLoading && <Loader2 className="animate-spin" size={20} />}
              Lanjut Verifikasi
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp}>
            <p style={{ textAlign: 'center', marginBottom: '6cqh', fontSize: 'var(--font-body)', color: 'var(--dark-text-muted)' }}>
              Kami telah mengirimkan 6 digit kode ke <b>{email}</b>. (Cek folder spam jika email tidak ditemukan)
            </p>
            
            <div className="input-group" style={{ marginBottom: '8cqh' }}>
              <KeyRound className="input-icon" />
              <input 
                type="text" 
                className="input-field" 
                placeholder="Kode 6 Digit" 
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                style={{ textAlign: 'center', letterSpacing: '2cqw', fontSize: '5cqw', paddingLeft: '5cqw' }}
                required
              />
            </div>

            <button type="submit" className="btn-primary" disabled={isLoading} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '2cqw' }}>
              {isLoading && <Loader2 className="animate-spin" size={20} />}
              Verifikasi & Buat Akun
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
        )}

        {step === 'form' ? (
          <p className="signup-text" style={{ marginTop: '6cqh' }}>
            Sudah punya akun? <a href="#" onClick={(e) => { e.preventDefault(); onBackToLogin(); }} className="signup-link">Masuk di sini</a>
          </p>
        ) : (
          <p className="signup-text" style={{ marginTop: '6cqh' }}>
            Salah Email? <a href="#" onClick={(e) => { e.preventDefault(); setConfirmPassword(''); setStep('form'); }} className="signup-link">Klik Disini</a>
          </p>
        )}
      </div>
    </div>
  );
};

export default Register;
