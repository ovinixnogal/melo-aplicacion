import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

const Card: React.FC<CardProps> = ({ children, className = '', onClick, hoverable = true }) => {
  return (
    <div 
      onClick={onClick}
      className={`
        bg-white rounded-[44px] border border-slate/5 p-8 
        transition-all duration-500 relative overflow-hidden
        ${onClick ? 'cursor-pointer active:scale-[0.98]' : ''}
        ${hoverable ? 'hover:border-pear hover:shadow-2xl hover:-translate-y-1' : ''}
        ${className}
      `}
    >
      {/* Decorative Blur Background Element */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-gray-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
      
      <div className="relative z-10 h-full flex flex-col">
        {children}
      </div>
    </div>
  );
};

export default Card;
