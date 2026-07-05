import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { AuthProvider, useAuth } from './hooks/useAuth';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import Layout from './components/Layout';

// API configuration
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Routes sub-rendering shell inside AuthProvider context
function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      
      {/* Public Home Page or Protected Dashboard based on session state */}
      <Route
        path="/"
        element={
          user ? (
            <Layout>
              <Dashboard />
            </Layout>
          ) : (
            <Home />
          )
        }
      />

      {/* Protected Settings View */}
      <Route
        path="/settings"
        element={
          <PrivateRoute>
            <Layout>
              <Settings />
            </Layout>
          </PrivateRoute>
        }
      />

      {/* Protected Chat View */}
      <Route
        path="/chat/:docId?"
        element={
          <PrivateRoute>
            <Chat />
          </PrivateRoute>
        }
      />

      {/* Redirection Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// Main App Entry
export default function App() {
  const [serverStatus, setServerStatus] = useState('checking');

  // Fetch health check status
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await axios.get(`${API_URL}/health`);
        if (response.data && response.data.status === 'ok') {
          setServerStatus('ok');
        } else {
          setServerStatus('error');
        }
      } catch (err) {
        setServerStatus('error');
      }
    };
    checkHealth();
  }, []);

  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}
