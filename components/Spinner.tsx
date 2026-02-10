import React from 'react';

export const Spinner: React.FC<{ size?: 'sm' | 'md' | 'lg', className?: string }> = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-8 h-8 border-4',
    lg: 'w-12 h-12 border-4',
  };

  return (
    <div className={`inline-block animate-spin rounded-full border-current border-t-transparent text-brand-500 ${sizeClasses[size]} ${className}`} role="status" aria-label="loading">
      <span className="sr-only">Loading...</span>
    </div>
  );
};