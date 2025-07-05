"use client";

import { useState, useEffect, ReactNode } from 'react';
import { LoadingSpinner } from './LoadingSpinner';

interface ClientOnlyProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export const ClientOnly: React.FC<ClientOnlyProps> = ({ 
  children, 
  fallback = <LoadingSpinner /> 
}) => {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};