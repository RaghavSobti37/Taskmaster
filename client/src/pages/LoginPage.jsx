import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Auth.css';

const LoginPage = () => {
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(loginIdentifier, password);
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.response?.data?.errors?.[0]?.msg || 'Failed to login';
      console.error('Login error:', errorMessage);
      setError(errorMessage);
    }
  };

  return (
    <div className="auth-container">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h1>Login</h1>
        {error && <div style={{ color: 'red', marginBottom: '10px' }}>{error}</div>}
        <div className="form-group">
          <label htmlFor="login">Email or Username</label>
          <input type="text" id="login" value={loginIdentifier} onChange={(e) => setLoginIdentifier(e.target.value)} required />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button type="submit" className="auth-button">
          Login
        </button>
        <p className="auth-switch">
          Don't have an account? <Link to="/register">Register</Link>
        </p>
      </form>
    </div>
  );
};

export default LoginPage;