import React, { useState } from "react";
import axios from "axios";
import "./LoginPage.css"; // Kita akan buat file CSS ini

const API_URL = "http://103.94.238.252:3000/api"; // Sesuaikan jika perlu

const LoginPage = ({ onLoginSuccess }) => {
  const [userKode, setUserKode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        user_kode: userKode,
        user_password: password,
      });

      const { token } = response.data.data;
      if (token) {
        onLoginSuccess(token); // Kirim token ke App.jsx
      }
    } catch (err) {
      setError("Kode user atau password salah.", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
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
          {isLoading ? "Loading..." : "Login"}
        </button>
      </form>
    </div>
  );
};

export default LoginPage;
