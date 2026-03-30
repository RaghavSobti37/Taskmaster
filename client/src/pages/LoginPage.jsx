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
    
    console.log('🔑 [LOGIN PAGE] Form submitted');
    console.log('🔑 [LOGIN PAGE] Values:', { loginIdentifier, passwordLength: password.length });
    
    try {
      console.log('🔑 [LOGIN PAGE] Calling login function...');
      await login(loginIdentifier, password);
      console.log('🔑 [LOGIN PAGE] Login succeeded');
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to login';
      console.error('🔑 [LOGIN PAGE] Login failed:', errorMessage);
      setError(errorMessage);
    }
  };

  return (
    <div className="auth-container">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h1>Login</h1>
        {error && <div style={{ color: 'red', marginBottom: '10px' }}>⚠️ {error}</div>}
        <div className="form-group">
          <label htmlFor="login">Email or Username</label>
          <input 
            type="text" 
            id="login" 
            value={loginIdentifier} 
            onChange={(e) => {
              console.log('🔑 [LOGIN PAGE] Login identifier changed:', e.target.value);
              setLoginIdentifier(e.target.value);
            }} 
            required 
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input 
            type="password" 
            id="password" 
            value={password} 
            onChange={(e) => {
              console.log('🔑 [LOGIN PAGE] Password changed, length:', e.target.value.length);
              setPassword(e.target.value);
            }} 
            required 
          />
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