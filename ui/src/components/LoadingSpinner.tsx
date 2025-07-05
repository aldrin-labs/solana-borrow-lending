"use client";

import { FC } from "react";

export const LoadingSpinner: FC = () => {
  return (
    <div 
      className="flex items-center justify-center min-h-screen"
      style={{ 
        backgroundColor: 'var(--theme-background, #ffffff)',
        color: 'var(--theme-textPrimary, #2d3748)'
      }}
    >
      <div className="flex flex-col items-center space-y-4">
        <div 
          className="animate-spin rounded-full h-12 w-12 border-b-2"
          style={{
            borderColor: 'var(--theme-primary, #3182ce)'
          }}
        ></div>
        <p style={{ color: 'var(--theme-textSecondary, #4a5568)' }}>
          Loading MAGA Finance...
        </p>
      </div>
    </div>
  );
};