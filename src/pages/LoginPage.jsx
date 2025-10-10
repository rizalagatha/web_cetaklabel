import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './LoginPage.css';

const LoginPage = () => {
  const [userKode, setUserKode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await login(userKode, password);
      navigate('/'); // Arahkan ke halaman utama setelah login berhasil
    } catch (err) {
      setError('Kode user atau password salah.', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page-container">
      <form className="login-form" onSubmit={handleLogin}>
        <h2>Login Cetak Label</h2>
        <p>Silakan masuk untuk melanjutkan</p>
        <div className="input-group">
          <label htmlFor="userKode">Kode User</label>
          <input
            id="userKode"
            type="text"
            value={userKode}
            onChange={(e) => setUserKode(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div className="input-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Login'}
        </button>
      </form>
    </div>
  );
};

export default LoginPage;
