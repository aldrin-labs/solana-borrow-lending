"use client";

import { FC, useState, useEffect } from "react";

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
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const targetingService = OnboardingTargetingService.getInstance();

  // Update target element when step changes
  useEffect(() => {
    if (isVisible) {
      const step = ONBOARDING_STEPS[currentStep];
      const element = targetingService.getTargetElement(step);
      setTargetElement(element);
    }
  }, [currentStep, isVisible, targetingService]);

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep(prev => prev + 1);
        setIsAnimating(false);
      }, 200);
    } else {
      onComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep(prev => prev - 1);
        setIsAnimating(false);
      }, 200);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  const step = ONBOARDING_STEPS[currentStep];

  if (!isVisible) return null;

  // Calculate overlay position if we have a target element
  const overlayStyle = targetElement ? (() => {
    const position = targetingService.getElementPosition(targetElement);
    return {
      top: position.top - 4,
      left: position.left - 4,
      width: position.width + 8,
      height: position.height + 8,
    };
  })() : null;

  return (
    <>
      {/* Element highlight overlay */}
      {targetElement && overlayStyle && (
        <div 
          className="fixed z-40 pointer-events-none"
          style={{
            top: overlayStyle.top,
            left: overlayStyle.left,
            width: overlayStyle.width,
            height: overlayStyle.height,
            border: '2px solid var(--theme-primary)',
            borderRadius: '6px',
            boxShadow: '0 0 0 4px rgba(49, 130, 206, 0.2)',
            background: 'rgba(49, 130, 206, 0.1)',
            transition: 'all 0.3s ease-in-out',
          }}
        />
      )}

      {/* Main onboarding modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90">
        <div className="terminal-window w-full max-w-2xl mx-4">
          {/* Terminal Header */}
          <div className="terminal-window-header flex justify-between items-center">
            <span>MAGA_ALDRIN.EXE</span>
            <button 
              onClick={onClose}
              className="text-white hover:text-error"
            >
              ✕
            </button>
          </div>
          
          {/* Terminal Content */}
          <div className="bg-black p-6 min-h-[400px]">
          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-secondary text-sm terminal-text">
                SYSTEM INITIALIZATION
              </span>
              <span className="text-secondary text-sm terminal-text">
                {currentStep + 1}/{ONBOARDING_STEPS.length}
              </span>
            </div>
            <div className="w-full bg-surface h-2 border border-border">
              <div 
                className="bg-primary h-full transition-all duration-300"
                style={{ 
                  width: `${((currentStep + 1) / ONBOARDING_STEPS.length) * 100}%` 
                }}
              />
            </div>
          </div>

          {/* Step Content */}
          <div className={`transition-opacity duration-200 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}>
            <h2 className="section-title mb-4 terminal-glow">
              {step.title}
            </h2>
            
            <div className="mb-6">
              <p className="text-primary text-base leading-relaxed terminal-text">
                {step.description}
              </p>
            </div>

            {/* Command Line Simulation */}
            <div className="bg-surface border border-border p-4 mb-6 font-mono text-sm">
              <div className="text-success">
                C:\MAGA_ALDRIN&gt; {step.id.toUpperCase()}_TUTORIAL.BAT
              </div>
              <div className="text-primary">
                Loading module: {step.title}...
              </div>
              <div className="text-secondary">
                Status: READY <span className="terminal-blink">█</span>
              </div>
            </div>

            {/* Feature Highlights */}
            {currentStep === 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="stats-card">
                  <div className="text-secondary text-xs">REAL-TIME DATA</div>
                  <div className="text-primary text-sm">Live blockchain updates</div>
                </div>
                <div className="stats-card">
                  <div className="text-secondary text-xs">BANKING UI</div>
                  <div className="text-primary text-sm">Professional interface</div>
                </div>
                <div className="stats-card">
                  <div className="text-secondary text-xs">PWA SUPPORT</div>
                  <div className="text-primary text-sm">Install as desktop app</div>
                </div>
                <div className="stats-card">
                  <div className="text-secondary text-xs">MOBILE READY</div>
                  <div className="text-primary text-sm">Responsive design</div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-between items-center">
              <button
                onClick={handlePrevious}
                disabled={currentStep === 0}
                className="btn-secondary disabled:opacity-30"
              >
                &lt; PREVIOUS
              </button>

              <div className="flex gap-2">
                <button
                  onClick={handleSkip}
                  className="btn-accent text-sm"
                >
                  SKIP TOUR
                </button>
                
                <button
                  onClick={handleNext}
                  className="btn-primary"
                >
                  {currentStep === ONBOARDING_STEPS.length - 1 ? 'COMPLETE' : step.action || 'NEXT >'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

// Main Onboarding Component
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
    <>
      <OnboardingModal
        isVisible={showOnboarding}
        onClose={handleClose}
        onComplete={handleComplete}
      />
      
      {/* Help Button */}
      {hasCompletedOnboarding && (
        <button
          onClick={handleRestart}
          className="fixed bottom-4 right-4 btn-secondary text-sm z-40"
          title="Restart Tour"
        >
          ? HELP
        </button>
      )}
    </>
  );
};