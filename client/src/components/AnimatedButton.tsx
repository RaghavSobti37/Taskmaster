import React from 'react';
import { motion, MotionProps } from 'framer-motion';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

interface AnimatedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  animate?: boolean;
}

const AnimatedButton = React.forwardRef<HTMLButtonElement, AnimatedButtonProps>(
  ({
    variant = 'primary',
    size = 'md',
    loading = false,
    icon,
    children,
    animate = true,
    className = '',
    disabled,
    ...props
  }, ref) => {
    const variantClasses = {
      primary: 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-lg hover:shadow-xl hover:from-primary-700 hover:to-primary-800',
      secondary: 'bg-gradient-to-r from-secondary-600 to-secondary-700 text-white shadow-lg hover:shadow-xl hover:from-secondary-700 hover:to-secondary-800',
      ghost: 'bg-gray-100 dark:bg-gray-800 text-gray-950 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700',
      danger: 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg hover:shadow-xl hover:from-red-700 hover:to-red-800',
      success: 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg hover:shadow-xl hover:from-green-700 hover:to-green-800'
    };

    const sizeClasses = {
      sm: 'px-3 py-1.5 text-xs font-bold uppercase tracking-wide rounded-lg',
      md: 'px-4 py-2 text-sm font-bold uppercase tracking-wide rounded-xl',
      lg: 'px-6 py-3 text-base font-bold uppercase tracking-wide rounded-xl'
    };

    const baseClasses = 'inline-flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-bold';

    const allClasses = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

    if (!animate) {
      return (
        <button
          ref={ref}
          className={allClasses}
          disabled={disabled || loading}
          {...props}
        >
          {loading && (
            <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          )}
          {icon}
          {children}
        </button>
      );
    }

    return (
      <motion.button
        ref={ref}
        className={allClasses}
        disabled={disabled || loading}
        whileHover={!disabled ? { scale: 1.05 } : undefined}
        whileTap={!disabled ? { scale: 0.95 } : undefined}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        {...props}
      >
        {loading && (
          <motion.span
            className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
        )}
        {icon}
        {children}
      </motion.button>
    );
  }
);

AnimatedButton.displayName = 'AnimatedButton';

export default AnimatedButton;

// Additional utility button components
export const PrimaryButton: React.FC<Omit<AnimatedButtonProps, 'variant'>> = (props) => (
  <AnimatedButton variant="primary" {...props} />
);

export const SecondaryButton: React.FC<Omit<AnimatedButtonProps, 'variant'>> = (props) => (
  <AnimatedButton variant="secondary" {...props} />
);

export const GhostButton: React.FC<Omit<AnimatedButtonProps, 'variant'>> = (props) => (
  <AnimatedButton variant="ghost" {...props} />
);

export const DangerButton: React.FC<Omit<AnimatedButtonProps, 'variant'>> = (props) => (
  <AnimatedButton variant="danger" {...props} />
);

export const SuccessButton: React.FC<Omit<AnimatedButtonProps, 'variant'>> = (props) => (
  <AnimatedButton variant="success" {...props} />
);
