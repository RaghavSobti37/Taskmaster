import React from 'react';
import { motion, AnimatePresence, MotionProps, HTMLMotionProps } from 'framer-motion';

// Container variants for staggered children animations
export const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      staggerChildren: 0.05,
      staggerDirection: -1,
    },
  },
};

// Item variants for individual item animations
export const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 100, damping: 12 },
  },
  exit: { opacity: 0, y: -20 },
};

// Pop animation variants (for task completion)
export const popVariants = {
  hidden: { scale: 0.8, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { type: 'spring', stiffness: 200, damping: 15 },
  },
  exit: { scale: 0.8, opacity: 0 },
};

// Slide variants (for modals)
export const slideVariants = {
  hidden: { y: '100%', opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: 'spring', stiffness: 300, damping: 30 },
  },
  exit: { y: '100%', opacity: 0 },
};

// Fade variants
export const fadeVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
};

// Bounce variants
export const bounceVariants = {
  initial: { scale: 0 },
  animate: {
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 260,
      damping: 20,
    },
  },
  exit: { scale: 0 },
};

// Rotate variants
export const rotateVariants = {
  initial: { rotate: -180, opacity: 0 },
  animate: {
    rotate: 0,
    opacity: 1,
    transition: { duration: 0.5 },
  },
  exit: { rotate: 180, opacity: 0 },
};

// Stagger container for lists
export const staggerContainer = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { staggerChildren: 0.12 },
  },
  exit: {
    opacity: 0,
    transition: { staggerChildren: 0.05, staggerDirection: -1 },
  },
};

// Stagger item for lists
export const staggerItem = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
};

// Page transition variants
export const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4 },
  },
  exit: {
    opacity: 0,
    y: -20,
    transition: { duration: 0.3 },
  },
};

// Glassmorphism animation
export const glassVariants = {
  hidden: { opacity: 0, backdropFilter: 'blur(0px)' },
  visible: {
    opacity: 1,
    backdropFilter: 'blur(12px)',
    transition: { duration: 0.3 },
  },
  exit: {
    opacity: 0,
    backdropFilter: 'blur(0px)',
    transition: { duration: 0.2 },
  },
};

// Scale & fade on hover
export const hoverScale = {
  whileHover: { scale: 1.05, transition: { duration: 0.2 } },
  whileTap: { scale: 0.95 },
};

// Tap animation
export const tapAnimation = {
  whileTap: { scale: 0.95 },
};

// Component Props
interface StaggerContainerProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

interface AnimatedCardProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  hover?: boolean;
}

interface FadeInProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
}

// Stagger Container Component
export const StaggerContainer: React.FC<StaggerContainerProps> = ({
  children,
  className = '',
  delay = 0.1,
}) => (
  <motion.div
    className={className}
    variants={containerVariants}
    initial="hidden"
    animate="visible"
    transition={{ staggerChildren: delay }}
  >
    {children}
  </motion.div>
);

// Animated Card Component
export const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  className = '',
  delay = 0,
  hover = false,
}) => (
  <motion.div
    className={className}
    variants={itemVariants}
    layout
    whileHover={hover ? { scale: 1.02 } : undefined}
    transition={{ delay, type: 'spring', stiffness: 100 }}
  >
    {children}
  </motion.div>
);

// Fade In Component
export const FadeIn: React.FC<FadeInProps> = ({ children, delay = 0, duration = 0.5 }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ delay, duration }}
  >
    {children}
  </motion.div>
);

// List Wrapper with Stagger
export const StaggerList: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <motion.div
    className={className}
    variants={staggerContainer}
    initial="initial"
    animate="animate"
    exit="exit"
  >
    {children}
  </motion.div>
);

// List Item with Stagger
export const StaggerListItem: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <motion.li className={className} variants={staggerItem}>
    {children}
  </motion.li>
);

export default {
  containerVariants,
  itemVariants,
  popVariants,
  slideVariants,
  fadeVariants,
  bounceVariants,
  rotateVariants,
  staggerContainer,
  staggerItem,
  pageVariants,
  glassVariants,
  hoverScale,
  tapAnimation,
  StaggerContainer,
  AnimatedCard,
  FadeIn,
  StaggerList,
  StaggerListItem,
};
