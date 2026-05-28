import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Phone, ArrowRight, Check, Copy, AlertCircle } from 'lucide-react';
import axios from 'axios';
import { useToast } from '../../contexts/ToastContext';

const OTPVerificationPage = () => {
  const [verificationMode, setVerificationMode] = useState('email'); // 'email' or 'phone'
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [verificationCode, setVerificationCode] = useState(null);
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const { addToast } = useToast();

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = verificationMode === 'email' ? '/api/otp/send-email' : '/api/otp/send-phone';
      const payload = verificationMode === 'email' 
        ? { email: identifier }
        : { phone: identifier };

      const res = await axios.post(endpoint, payload);
      setVerificationCode(res.data.code); // For demo/dev purposes
      setOtpSent(true);
      addToast({
        title: 'OTP Sent',
        message: `Verification code sent to your ${verificationMode}.`,
        type: 'success'
      });
    } catch (err) {
      setError(err.response?.data?.error || `Failed to send OTP to ${verificationMode}`);
      addToast({
        title: 'Error',
        message: error,
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = verificationMode === 'email' ? '/api/otp/verify-email' : '/api/otp/verify-phone';
      const payload = {
        [verificationMode]: identifier,
        code: otp
      };

      const res = await axios.post(endpoint, payload);
      setVerified(true);
      addToast({
        title: 'Verified',
        message: 'Your identity has been verified successfully.',
        type: 'success'
      });

      // Could redirect or store verification state
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid OTP. Please try again.');
      addToast({
        title: 'Verification Failed',
        message: error,
        type: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const copyCodeToClipboard = () => {
    if (verificationCode) {
      navigator.clipboard.writeText(verificationCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const resetForm = () => {
    setOtpSent(false);
    setVerified(false);
    setOtp('');
    setIdentifier('');
    setError('');
    setVerificationCode(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-800 text-foreground relative overflow-hidden grid place-items-center p-6">
      {/* Animated background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 dark:opacity-10 animate-blob" />
        <div className="absolute top-40 right-10 w-72 h-72 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 dark:opacity-10 animate-blob animation-delay-2000" />
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 dark:opacity-10 animate-blob animation-delay-4000" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="tm-modal-panel max-w-md relative z-10 bg-white dark:bg-slate-800 p-8 rounded-3xl border border-gray-200 dark:border-slate-700 shadow-xl backdrop-blur-xl"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl mx-auto flex items-center justify-center text-white text-3xl font-black mb-4 shadow-lg shadow-blue-500/30">
            {verified ? <Check size={32} /> : 'CK'}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Identity Verification</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-3">Secure verification via OTP</p>
        </div>

        {verified ? (
          // Verified success state
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-4 text-center"
          >
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
              <p className="text-green-700 dark:text-green-400 font-semibold flex items-center justify-center gap-2">
                <Check size={20} /> Verified Successfully
              </p>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              You will be redirected to dashboard in a moment.
            </p>
          </motion.div>
        ) : otpSent ? (
          // OTP verification form
          <form onSubmit={handleVerifyOTP} className="space-y-6">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
              <p className="text-sm text-blue-700 dark:text-blue-400 font-medium">
                {`Verification code sent to your ${verificationMode}`}
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-500 mt-1 opacity-70">
                {verificationMode === 'email' ? identifier : `+...${identifier.slice(-4)}`}
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-xl flex gap-2 items-start">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 block">
                Enter OTP Code
              </label>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength="6"
                className="w-full px-4 py-3 text-2xl font-bold tracking-widest text-center bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                Check your {verificationMode} for the 6-digit code
              </p>
            </div>

            {verificationCode && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl flex items-center justify-between">
                <span className="text-xs font-mono text-yellow-700 dark:text-yellow-400">
                  Demo Code: <strong>{verificationCode}</strong>
                </span>
                <button
                  type="button"
                  onClick={copyCodeToClipboard}
                  className="p-1.5 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded transition-colors"
                >
                  {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} className="text-yellow-600" />}
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? 'Verifying...' : 'Verify OTP'}
              {!loading && <ArrowRight size={18} />}
            </button>

            <button
              type="button"
              onClick={resetForm}
              className="w-full py-2 text-gray-600 dark:text-gray-400 text-sm font-medium hover:text-gray-900 dark:hover:text-gray-300 transition-colors"
            >
              Try Different Method
            </button>
          </form>
        ) : (
          // Initial identifier form
          <form onSubmit={handleSendOTP} className="space-y-6">
            {/* Mode selector */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setVerificationMode('email'); setError(''); }}
                className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                  verificationMode === 'email'
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                }`}
              >
                <Mail size={18} /> Email
              </button>
              <button
                type="button"
                onClick={() => { setVerificationMode('phone'); setError(''); }}
                className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                  verificationMode === 'phone'
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                }`}
              >
                <Phone size={18} /> Phone
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-xl flex gap-2 items-start">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 block">
                {verificationMode === 'email' ? 'Email Address' : 'Phone Number'}
              </label>
              <div className="relative">
                {verificationMode === 'email' ? (
                  <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                ) : (
                  <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                )}
                <input
                  type={verificationMode === 'email' ? 'email' : 'tel'}
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={verificationMode === 'email' ? 'your@email.com' : '+1 (555) 000-0000'}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all placeholder:text-gray-400"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !identifier.trim()}
              className="w-full py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? 'Sending...' : 'Send Verification Code'}
              {!loading && <ArrowRight size={18} />}
            </button>
          </form>
        )}

        {/* Footer info */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-slate-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            This verification helps keep your account secure. Your data is encrypted.
          </p>
        </div>
      </motion.div>

      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
};

export default OTPVerificationPage;
