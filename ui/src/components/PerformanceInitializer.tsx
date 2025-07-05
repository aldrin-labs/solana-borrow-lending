/**
 * Performance Initializer Component
 * Initializes performance monitoring and animation optimization
 */

"use client";

import { useEffect } from 'react';
import { injectPerformanceCSS } from '../utils/performance';

export const PerformanceInitializer: React.FC = () => {
  useEffect(() => {
    // Initialize performance monitoring and inject CSS
    injectPerformanceCSS();
    
    // Additional performance optimizations
    const optimizePerformance = () => {
      // Optimize images loading
      if ('loading' in HTMLImageElement.prototype) {
        const images = document.querySelectorAll('img[data-src]');
        images.forEach((img) => {
          (img as HTMLImageElement).src = (img as HTMLImageElement).dataset.src || '';
        });
      }
      
      // Optimize scroll events
      let ticking = false;
      const handleScroll = () => {
        if (!ticking) {
          requestAnimationFrame(() => {
            // Perform scroll-based optimizations
            ticking = false;
          });
          ticking = true;
        }
      };
      
      window.addEventListener('scroll', handleScroll, { passive: true });
      
      return () => {
        window.removeEventListener('scroll', handleScroll);
      };
    };
    
    // Run optimizations after component mount
    const cleanup = optimizePerformance();
    
    return cleanup;
  }, []);
  
  return null;
};