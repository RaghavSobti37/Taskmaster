import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './LoadingProgress.css';

const LoadingProgress = () => {
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let interval;
    const handleLoadingStart = () => {
      setIsVisible(true);
      setProgress(10);
      
      // Simulate real-time loading progress up to 90%
      interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval);
            return prev;
          }
          return prev + Math.random() * 5 + 2; // Increments of 2% - 7%
        });
      }, 300);
    };

    const handleLoadingStop = () => {
      clearInterval(interval);
      setProgress(100);
      
      // Hide after animation completes
      setTimeout(() => {
        setIsVisible(false);
        setTimeout(() => setProgress(0), 300); // Reset for next time
      }, 400); 
    };

    window.addEventListener('global-loading-start', handleLoadingStart);
    window.addEventListener('global-loading-stop', handleLoadingStop);

    return () => {
      window.removeEventListener('global-loading-start', handleLoadingStart);
      window.removeEventListener('global-loading-stop', handleLoadingStop);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="loading-progress-container">
      <AnimatePresence>
        {isVisible && (
          <motion.div
            className="loading-progress-bar"
            initial={{ width: 0, opacity: 1 }}
            animate={{ width: `${progress}%`, opacity: progress === 100 ? 0 : 1 }}
            exit={{ opacity: 0 }}
            transition={{ 
              width: { duration: 0.2, ease: "linear" },
              opacity: { duration: 0.3, ease: "easeOut" }
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default LoadingProgress;
