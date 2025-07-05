"use client";

import { FC, ReactNode, useState } from "react";

interface CollapsibleSectionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  headerClassName?: string;
  contentClassName?: string;
  icon?: ReactNode;
}

export const CollapsibleSection: FC<CollapsibleSectionProps> = ({
  title,
  children,
  defaultOpen = false,
  className = "",
  headerClassName = "",
  contentClassName = "",
  icon,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`${className}`}>
      <button
        className={`w-full flex items-center justify-between p-4 text-left transition-all duration-200 hover:bg-opacity-5 focus-visible ${headerClassName}`}
        style={{
          backgroundColor: 'var(--theme-surface)',
          borderRadius: isOpen ? '0.5rem 0.5rem 0 0' : '0.5rem',
          borderBottom: isOpen ? '1px solid var(--theme-border)' : 'none',
        }}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls={`collapsible-content-${title.replace(/\s+/g, '-').toLowerCase()}`}
      >
        <div className="flex items-center gap-3">
          {icon && <span className="text-lg">{icon}</span>}
          <h3 className="typography-h3">{title}</h3>
        </div>
        <svg
          className={`w-5 h-5 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
          style={{ color: 'var(--theme-textSecondary)' }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      
      <div
        id={`collapsible-content-${title.replace(/\s+/g, '-').toLowerCase()}`}
        className={`collapsible ${isOpen ? 'collapsible-open' : 'collapsible-closed'}`}
      >
        <div
          className={`p-4 ${contentClassName}`}
          style={{
            backgroundColor: 'var(--theme-card)',
            borderRadius: '0 0 0.5rem 0.5rem',
            border: '1px solid var(--theme-border)',
            borderTop: 'none',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

// Preset collapsible sections for common use cases
export const AdvancedOptionsSection: FC<{ children: ReactNode }> = ({ children }) => (
  <CollapsibleSection
    title="Advanced Options"
    icon={
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4"
        />
      </svg>
    }
    defaultOpen={false}
    className="mt-4"
  >
    {children}
  </CollapsibleSection>
);

export const DetailedAnalyticsSection: FC<{ children: ReactNode }> = ({ children }) => (
  <CollapsibleSection
    title="Detailed Analytics"
    icon={
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
    }
    defaultOpen={false}
    className="mt-4"
  >
    {children}
  </CollapsibleSection>
);

export const RiskManagementSection: FC<{ children: ReactNode }> = ({ children }) => (
  <CollapsibleSection
    title="Risk Management"
    icon={
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
        />
      </svg>
    }
    defaultOpen={false}
    className="mt-4"
  >
    {children}
  </CollapsibleSection>
);