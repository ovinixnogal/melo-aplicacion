import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

const Input: React.FC<InputProps> = ({ label, error, icon, className = '', ...props }) => {
  return (
    <div className="space-y-2 w-full">
      {label && (
        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">
          {label}
        </label>
      )}
      <div className="relative group">
        {icon && (
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300 group-focus-within:text-slate transition-colors">
            {icon}
          </div>
        )}
        <input
          className={`
            w-full py-4 bg-[#F5F5F3]/50 border-2 rounded-2xl text-[14px] font-bold text-slate 
            placeholder:text-gray-300 focus:outline-none focus:bg-white transition-all
            min-w-0 max-w-full
            ${icon ? 'pl-12 pr-10' : 'px-6'}
            ${error ? 'border-rose-100 focus:border-rose-400' : 'border-transparent focus:border-pear'}
            ${className}
          `}
          {...props}
        />
      </div>
      {error && (
        <p className="text-[11px] text-rose-500 font-bold ml-1 animate-in fade-in slide-in-from-top-1 duration-200">
          {error}
        </p>
      )}
    </div>
  );
};

export default Input;
