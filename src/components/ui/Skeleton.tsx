import React from 'react';

interface SkeletonProps {
  className?: string;
  count?: number;
}

const Skeleton: React.FC<SkeletonProps> = ({ className = '', count = 1 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div 
          key={i}
          className={`
            animate-pulse bg-gray-100 rounded-[28px] border border-gray-50
            ${className}
          `}
        />
      ))}
    </>
  );
};

export default Skeleton;
