"use client";

import React, { FC, useState, useEffect } from "react";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  targetElementId?: string; // Use element ID instead of CSS selector
  targetComponent?: string; // Component name for ref-based targeting
  action?: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    title: "WELCOME TO MAGA",
    description: "Experience DeFi with MAGA - Make Aldrin Great Again. This interface provides real-time lending protocol data with a professional banking-grade feel.",
    action: "START TOUR",
  },
  {
    id: "wallet",
    title: "CONNECT YOUR WALLET",
    description: "Connect your Solana wallet to access lending and borrowing features. Your positions and transactions will be displayed in real-time.",
    targetElementId: "wallet-connect-button",
    targetComponent: "WalletButton",
    action: "CONNECT WALLET",
  },
  {
    id: "dashboard",
    title: "PROTOCOL DASHBOARD",
    description: "View total value locked, borrowing volumes, and protocol health metrics. All data is fetched live from the Solana blockchain.",
    targetElementId: "dashboard-stats-section",
    targetComponent: "DashboardStats",
    action: "VIEW ANALYTICS",
  },
  {
    id: "lending",
    title: "SUPPLY ASSETS",
    description: "Supply your tokens to earn yield. View supply markets, APY rates, and collateral ratios in the lending section.",
    targetElementId: "lending-navigation",
    targetComponent: "LendingNavigation",
    action: "EXPLORE LENDING",
  },
  {
    id: "borrowing",
    title: "BORROW AGAINST COLLATERAL",
    description: "Use your supplied assets as collateral to borrow other tokens. Monitor your health factor to avoid liquidation.",
    targetElementId: "borrowing-navigation", 
    targetComponent: "BorrowingNavigation",
    action: "EXPLORE BORROWING",
  },
  {
    id: "terminal",
    title: "MAGA FEATURES",
    description: "This professional banking interface includes: real-time data updates, clean aesthetics, advanced charting, and offline PWA support.",
    action: "COMPLETE TOUR",
  },
];

interface OnboardingModalProps {
  isVisible: boolean;
  onClose: () => void;
  onComplete: () => void;
}

// Element targeting utility for onboarding
class OnboardingTargetingService {
  private static instance: OnboardingTargetingService;
  private elementRegistry = new Map<string, HTMLElement>();
  private componentRefs = new Map<string, React.RefObject<HTMLElement>>();

  static getInstance(): OnboardingTargetingService {
    if (!OnboardingTargetingService.instance) {
      OnboardingTargetingService.instance = new OnboardingTargetingService();
    }
    return OnboardingTargetingService.instance;
  }

  // Register an element by ID for targeting
  registerElement(id: string, element: HTMLElement): void {
    this.elementRegistry.set(id, element);
  }

  // Register a component ref for targeting
  registerComponentRef(componentName: string, ref: React.RefObject<HTMLElement>): void {
    this.componentRefs.set(componentName, ref);
  }

  // Get element by ID with fallback strategies
  getTargetElement(step: OnboardingStep): HTMLElement | null {
    // Strategy 1: Use registered element by ID
    if (step.targetElementId) {
      const registeredElement = this.elementRegistry.get(step.targetElementId);
      if (registeredElement && document.body.contains(registeredElement)) {
        return registeredElement;
      }

      // Fallback: Try to find by DOM ID
      const domElement = document.getElementById(step.targetElementId);
      if (domElement) {
        this.registerElement(step.targetElementId, domElement);
        return domElement;
      }
    }

    // Strategy 2: Use component ref
    if (step.targetComponent) {
      const componentRef = this.componentRefs.get(step.targetComponent);
      if (componentRef?.current && document.body.contains(componentRef.current)) {
        return componentRef.current;
      }
    }

    // Strategy 3: Try to find by data attributes (fallback compatibility)
    if (step.targetElementId) {
      const dataTestElement = document.querySelector(`[data-onboarding-id="${step.targetElementId}"]`) as HTMLElement;
      if (dataTestElement) {
        this.registerElement(step.targetElementId, dataTestElement);
        return dataTestElement;
      }
    }

    return null;
  }

  // Get element position for overlay positioning
  getElementPosition(element: HTMLElement): { top: number; left: number; width: number; height: number } {
    const rect = element.getBoundingClientRect();
    return {
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
      height: rect.height,
    };
  }

  // Clear registry (useful for cleanup)
  clear(): void {
    this.elementRegistry.clear();
    this.componentRefs.clear();
  }
}

// Hook to register elements and refs for onboarding
export const useOnboardingTarget = (
  id: string, 
  ref?: React.RefObject<HTMLElement>,
  componentName?: string
) => {
  useEffect(() => {
    const service = OnboardingTargetingService.getInstance();
    
    if (ref?.current) {
      service.registerElement(id, ref.current);
      if (componentName) {
        service.registerComponentRef(componentName, ref);
      }
    }

    return () => {
      // Cleanup if needed
    };
  }, [id, ref, componentName]);
};

export const OnboardingModal: FC<OnboardingModalProps> = ({
  isVisible,
  onClose,
  onComplete,
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-surface border border-border rounded-lg p-6 max-w-md mx-4 shadow-lg">
        <h3 className="text-lg font-semibold mb-4">Welcome to MAGA</h3>
        <p className="text-sm mb-4">Complete the onboarding to get started.</p>
        <div className="flex space-x-2">
          <button onClick={onClose} className="btn-secondary">Skip</button>
          <button onClick={onComplete} className="btn-primary">Complete</button>
        </div>
      </div>
    </div>
  );
};

export const Onboarding: FC = () => {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  useEffect(() => {
    // Check if user has completed onboarding
    const completed = localStorage.getItem('maga-aldrin-onboarding-completed');
    setHasCompletedOnboarding(!!completed);

    // Show onboarding for new users after a short delay
    if (!completed) {
      const timer = setTimeout(() => {
        setShowOnboarding(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleComplete = () => {
    localStorage.setItem('maga-aldrin-onboarding-completed', 'true');
    setHasCompletedOnboarding(true);
    setShowOnboarding(false);
  };

  const handleClose = () => {
    setShowOnboarding(false);
  };

  const handleRestart = () => {
    setShowOnboarding(true);
  };

  return (
    <div>
      <OnboardingModal
        isVisible={showOnboarding}
        onClose={handleClose}
        onComplete={handleComplete}
      />
      
      {hasCompletedOnboarding && (
        <button
          onClick={handleRestart}
          className="fixed bottom-4 right-4 btn-secondary text-sm z-40"
          title="Restart Tour"
        >
          ? HELP
        </button>
      )}
    </div>
  );
};