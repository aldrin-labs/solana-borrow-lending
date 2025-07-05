"use client";

import React, { useEffect } from 'react';

export const WebComponentGuard: React.FC = () => {
  useEffect(() => {
    // Handle custom element conflicts
    const handleCustomElementError = (error: ErrorEvent) => {
      if (error.message && error.message.includes('already been defined')) {
        console.warn('Custom element already defined, ignoring:', error.message);
        error.preventDefault();
        return true;
      }
      return false;
    };

    // Add error listener
    window.addEventListener('error', handleCustomElementError);
    
    // Add unhandled promise rejection handler
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (event.reason && event.reason.message && 
          event.reason.message.includes('already been defined')) {
        console.warn('Custom element promise rejection, ignoring:', event.reason.message);
        event.preventDefault();
        return true;
      }
      return false;
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // Cleanup
    return () => {
      window.removeEventListener('error', handleCustomElementError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null;
};