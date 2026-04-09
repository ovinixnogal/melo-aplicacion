import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'xl',
}) => {
  const [shouldRender, setShouldRender] = useState(false);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      document.body.style.overflow = 'hidden';
      // Pequeno timeout para garantir a animacao de entrada
      setTimeout(() => setAnimate(true), 10);
    } else {
      setAnimate(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
        document.body.style.overflow = 'auto';
      }, 300);
      return () => {
        clearTimeout(timer);
        document.body.style.overflow = 'auto';
      };
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  if (!shouldRender) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center">
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-slate/60 backdrop-blur-sm transition-opacity duration-300 ${animate ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />

      {/* Content Panel */}
      <div 
        className={`
          relative w-full ${maxWidthClasses[maxWidth]} bg-white md:rounded-[48px] rounded-t-[40px] 
          shadow-3xl overflow-hidden transition-all duration-300 ease-out transform
          ${animate ? 'translate-y-0 opacity-100' : 'translate-y-full md:translate-y-8 md:opacity-0 md:scale-95'}
          max-h-[92vh] flex flex-col
        `}
      >
        {/* Mobile Handle */}
        <div className="md:hidden w-12 h-1.5 bg-gray-100 rounded-full mx-auto my-6 shrink-0"></div>

        {/* Header */}
        <div className="px-8 md:px-12 py-6 md:py-10 flex items-start justify-between shrink-0">
          <div>
            {subtitle && (
              <h4 className="text-[10px] font-black tracking-[0.4em] uppercase text-gray-400 mb-2 ml-1">
                {subtitle}
              </h4>
            )}
            {title && (
              <h2 className="text-2xl md:text-3xl font-black text-slate tracking-tighter italic leading-none uppercase">
                {title}
              </h2>
            )}
          </div>
          <button 
            onClick={onClose}
            className="p-3 bg-gray-50 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all"
            aria-label="Cerrar modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="px-8 md:px-12 pb-12 overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Modal;
