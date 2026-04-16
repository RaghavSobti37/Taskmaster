import React from 'react';
import { motion } from 'framer-motion';
import './PageLoader.css';

const PageLoader = ({ text = "Loading..." }) => {
  return (
    <div className="page-loader-container">
      <motion.div 
        className="loader-circles"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <motion.div
          className="circle circle-1"
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 180, 360],
            borderRadius: ["50%", "20%", "50%"]
          }}
          transition={{
            duration: 2,
            ease: "easeInOut",
            times: [0, 0.5, 1],
            repeat: Infinity,
          }}
        />
        <motion.div
          className="circle circle-2"
          animate={{
            scale: [1, 1.5, 1],
            rotate: [360, 180, 0],
            borderRadius: ["20%", "50%", "20%"]
          }}
          transition={{
            duration: 2,
            ease: "easeInOut",
            times: [0, 0.5, 1],
            repeat: Infinity,
          }}
        />
      </motion.div>
      <motion.p 
        className="page-loader-text"
        initial={{ opacity: 0.5 }}
        animate={{ opacity: 1 }}
        transition={{ repeat: Infinity, duration: 1, repeatType: "reverse" }}
      >
        {text}
      </motion.p>
    </div>
  );
};

export default PageLoader;
