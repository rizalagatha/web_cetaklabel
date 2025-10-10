import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const ProtectedRoute = ({ children }) => {
  const { token } = useAuth();

  if (!token) {
    // Jika tidak ada token, "tendang" pengguna ke halaman login
    return <Navigate to="/login" />;
  }

  return children; // Jika ada token, tampilkan halaman yang diproteksi
};

export default ProtectedRoute;
