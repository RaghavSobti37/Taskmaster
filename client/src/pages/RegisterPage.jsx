import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Auth.css';

const RegisterPage = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    console.log('📝 [REGISTER PAGE] Form submitted');
    console.log('📝 [REGISTER PAGE] Values:', { username, email, passwordLength: password.length });
    
    try {
      console.log('📝 [REGISTER PAGE] Calling register function...');
      await register(username, email, password);
      console.log('📝 [REGISTER PAGE] Register succeeded');
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to register';
      console.error('📝 [REGISTER PAGE] Register failed:', errorMessage);
      setError(errorMessage);
    }
  };

  return (
    <div className="auth-container">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h1>Create Account</h1>
        {error && <div style={{ color: 'red', marginBottom: '10px' }}>⚠️ {error}</div>}
        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input 
            type="text" 
            id="username" 
            value={username} 
            onChange={(e) => {
              console.log('📝 [REGISTER PAGE] Username changed:', e.target.value);
              setUsername(e.target.value);
            }} 
            required 
          />
        </div>
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input 
            type="email" 
            id="email" 
            value={email} 
            onChange={(e) => {
              console.log('📝 [REGISTER PAGE] Email changed:', e.target.value);
              setEmail(e.target.value);
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
              console.log('📝 [REGISTER PAGE] Password changed, length:', e.target.value.length);
              setPassword(e.target.value);
            }} 
            required 
          />
        </div>
        <button type="submit" className="auth-button">
          Register
        </button>
        <p className="auth-switch">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
};

export default RegisterPage;