"use client";

import { FC, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useRouter } from "next/navigation";
import { KeyboardShortcutTooltip } from "./KeyboardShortcutTooltip";

export const QuickActions: FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const { connected } = useWallet();
  const router = useRouter();

  const actions = [
    {
      label: "Supply",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      ),
      onClick: () => router.push("/lend"),
      color: "var(--theme-success)",
      shortcut: { key: 's', shiftKey: true, description: 'Quick Supply', category: 'Quick Actions' },
    },
    {
      label: "Borrow",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      ),
      onClick: () => router.push("/borrow"),
      color: "var(--theme-warning)",
      shortcut: { key: 'b', shiftKey: true, description: 'Quick Borrow', category: 'Quick Actions' },
    },
    {
      label: "Farm",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      onClick: () => router.push("/farm"),
      color: "var(--theme-primary)",
      shortcut: { key: 'f', shiftKey: true, description: 'Quick Farm', category: 'Quick Actions' },
    },
    {
      label: "Dashboard",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
      onClick: () => router.push("/"),
      color: "var(--theme-textSecondary)",
      shortcut: { key: 'd', shiftKey: true, description: 'Quick Dashboard', category: 'Quick Actions' },
    },
  ];

  if (!connected) {
    return null; // Hide quick actions when wallet not connected
  }

  return (
    <div className="quick-actions">
      {/* Expanded action buttons */}
      {isExpanded && (
        <div className="flex flex-col gap-2 animate-slide-up">
          {actions.map((action, index) => (
            <KeyboardShortcutTooltip
              key={action.label}
              shortcut={action.shortcut}
              action={action.onClick}
              element={`quick-action-${action.label.toLowerCase()}`}
            >
              <button
                className="quick-action-button"
                style={{
                  background: action.color,
                  animationDelay: `${index * 50}ms`,
                }}
                onClick={action.onClick}
                title={action.label}
                aria-label={action.label}
              >
                {action.icon}
              </button>
            </KeyboardShortcutTooltip>
          ))}
        </div>
      )}

      {/* Main toggle button */}
      <KeyboardShortcutTooltip
        shortcut={{
          key: 'q',
          description: 'Toggle Quick Actions',
          category: 'Quick Actions',
        }}
        action={() => setIsExpanded(!isExpanded)}
        element="quick-actions-toggle"
      >
        <button
          className="quick-action-button"
          style={{
            background: isExpanded ? 'var(--theme-error)' : 'var(--theme-gradient-primary)',
            transform: isExpanded ? 'rotate(45deg)' : 'rotate(0deg)',
          }}
          onClick={() => setIsExpanded(!isExpanded)}
          aria-label={isExpanded ? "Close quick actions" : "Open quick actions"}
          title={isExpanded ? "Close" : "Quick Actions"}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
      </KeyboardShortcutTooltip>
    </div>
  );
};