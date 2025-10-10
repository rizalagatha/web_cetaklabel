import React, { createContext, useState, useContext, useEffect } from "react";
import axios from "axios";

const AuthContext = createContext();

const apiClient = axios.create({
  baseURL: "http://103.94.238.252:3000/api",
});

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem("authToken"));

  useEffect(() => {
    if (token) {
      apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      localStorage.setItem("authToken", token);
    } else {
      delete apiClient.defaults.headers.common["Authorization"];
      localStorage.removeItem("authToken");
    }
  }, [token]);

  const login = async (userKode, password) => {
    const response = await apiClient.post("/auth/login", {
      user_kode: userKode,
      user_password: password,
    });
    const newToken = response.data.data.token;
    if (newToken) {
      setToken(newToken);
    }
    return response;
  };

  const logout = () => {
    setToken(null);
  };

  return (
    <AuthContext.Provider value={{ token, login, logout, apiClient }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};
