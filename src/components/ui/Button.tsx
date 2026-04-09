import React from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  children,
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 disabled:grayscale disabled:scale-100 disabled:cursor-not-allowed overflow-hidden relative group';
  
  const variants = {
    primary: 'bg-slate text-white hover:bg-gray-800 shadow-xl',
    secondary: 'bg-pear text-slate shadow-lg hover:bg-[#d4f034]',
    outline: 'bg-transparent border-2 border-slate/10 text-slate hover:bg-gray-50',
    danger: 'bg-rose-500 text-white hover:bg-rose-600 shadow-lg',
    ghost: 'bg-transparent text-gray-500 hover:text-slate hover:bg-gray-100',
  };

  const sizes = {
    sm: 'px-4 py-2 text-[9px] rounded-xl',
    md: 'px-8 py-4 text-xs rounded-2xl',
    lg: 'px-10 py-5 text-sm rounded-[24px]',
    icon: 'p-3 rounded-xl',
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="animate-spin" size={20} />
      ) : (
        <>
          {leftIcon && <span className="mr-2 group-hover:scale-110 transition-transform">{leftIcon}</span>}
          {children}
          {rightIcon && <span className="ml-2 group-hover:scale-110 transition-transform">{rightIcon}</span>}
          
          {/* Shine effect on hover */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
        </>
      )}
    </button>
  );
};

export default Button;
