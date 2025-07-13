"use client";

import React, { FC, useState, useEffect, useRef, useContext, createContext } from "react";

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  targetElementId?: string;
  targetComponent?: string;
  action?: string;
  ariaLabel?: string;
  screenReaderText?: string;
  skipCondition?: () => boolean;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "welcome",
    title: "WELCOME TO MAGA",
    description: "Experience DeFi with MAGA - Make Aldrin Great Again. This interface provides real-time lending protocol data with a professional banking-grade feel.",
    action: "START TOUR",
    ariaLabel: "Welcome to MAGA Finance lending protocol",
    screenReaderText: "Welcome to MAGA Finance. This tour will guide you through the lending protocol interface. Press Enter to start the tour or Escape to skip.",
  },
  {
    id: "wallet",
    title: "CONNECT YOUR WALLET",
    description: "Connect your Solana wallet to access lending and borrowing features. Your positions and transactions will be displayed in real-time.",
    targetElementId: "wallet-connect-button",
    targetComponent: "WalletButton",
    action: "CONNECT WALLET",
    ariaLabel: "Wallet connection area",
    screenReaderText: "This is the wallet connection button. Click here to connect your Solana wallet and access lending features.",
  },
  {
    id: "dashboard",
    title: "PROTOCOL DASHBOARD",
    description: "View total value locked, borrowing volumes, and protocol health metrics. All data is fetched live from the Solana blockchain.",
    targetElementId: "dashboard-stats-section",
    targetComponent: "DashboardStats",
    action: "VIEW ANALYTICS",
    ariaLabel: "Protocol analytics dashboard",
    screenReaderText: "This section displays protocol statistics including total value locked and borrowing volumes.",
  },
  {
    id: "lending",
    title: "SUPPLY ASSETS",
    description: "Supply your tokens to earn yield. View supply markets, APY rates, and collateral ratios in the lending section.",
    targetElementId: "lending-navigation",
    targetComponent: "LendingNavigation",
    action: "EXPLORE LENDING",
    ariaLabel: "Lending markets navigation",
    screenReaderText: "Navigate to the lending section to supply assets and earn yield on your tokens.",
  },
  {
    id: "borrowing",
    title: "BORROW AGAINST COLLATERAL",
    description: "Use your supplied assets as collateral to borrow other tokens. Monitor your health factor to avoid liquidation.",
    targetElementId: "borrowing-navigation", 
    targetComponent: "BorrowingNavigation",
    action: "EXPLORE BORROWING",
    ariaLabel: "Borrowing markets navigation",
    screenReaderText: "Navigate to the borrowing section to borrow assets against your collateral.",
  },
  {
    id: "terminal",
    title: "MAGA FEATURES",
    description: "This professional banking interface includes: real-time data updates, clean aesthetics, advanced charting, and offline PWA support.",
    action: "COMPLETE TOUR",
    ariaLabel: "Features overview",
    screenReaderText: "Tour complete. The interface includes real-time data updates, advanced charting, and offline support.",
  },
];

// Enhanced targeting service with accessibility
class AccessibleOnboardingService {
  private static instance: AccessibleOnboardingService;
  private elementRegistry = new Map<string, HTMLElement>();
  private componentRefs = new Map<string, React.RefObject<HTMLElement>>();
  private focusTracker = new Map<string, HTMLElement>();
  private previousFocus: HTMLElement | null = null;

  static getInstance(): AccessibleOnboardingService {
    if (!AccessibleOnboardingService.instance) {
      AccessibleOnboardingService.instance = new AccessibleOnboardingService();
    }
    return AccessibleOnboardingService.instance;
  }

  // Register element with accessibility attributes
  registerElement(id: string, element: HTMLElement, ariaLabel?: string): void {
    this.elementRegistry.set(id, element);
    
    // Add accessibility attributes
    if (!element.getAttribute('data-onboarding-target')) {
      element.setAttribute('data-onboarding-target', id);
    }
    
    if (ariaLabel && !element.getAttribute('aria-label')) {
      element.setAttribute('aria-describedby', `onboarding-description-${id}`);
    }
  }

  // Register component ref with accessibility
  registerComponentRef(componentName: string, ref: React.RefObject<HTMLElement>, ariaLabel?: string): void {
    this.componentRefs.set(componentName, ref);
    
    if (ref.current && ariaLabel) {
      this.registerElement(componentName, ref.current, ariaLabel);
    }
  }

  // Get target element with accessibility checks
  getTargetElement(step: OnboardingStep): HTMLElement | null {
    let targetElement: HTMLElement | null = null;

    // Strategy 1: Use registered element by ID
    if (step.targetElementId) {
      targetElement = this.elementRegistry.get(step.targetElementId) || 
                    document.getElementById(step.targetElementId);
    }

    // Strategy 2: Use component ref
    if (!targetElement && step.targetComponent) {
      const componentRef = this.componentRefs.get(step.targetComponent);
      targetElement = componentRef?.current || null;
    }

    // Strategy 3: Try data attributes
    if (!targetElement && step.targetElementId) {
      targetElement = document.querySelector(`[data-onboarding-id="${step.targetElementId}"]`) as HTMLElement;
    }

    // Ensure element is accessible
    if (targetElement) {
      this.ensureAccessibility(targetElement, step);
    }

    return targetElement;
  }

  // Ensure element has proper accessibility attributes
  private ensureAccessibility(element: HTMLElement, step: OnboardingStep): void {
    // Add tabindex if not focusable
    if (!this.isFocusable(element)) {
      element.setAttribute('tabindex', '0');
    }

    // Add ARIA attributes
    if (!element.getAttribute('aria-label') && step.ariaLabel) {
      element.setAttribute('aria-label', step.ariaLabel);
    }

    // Add description
    if (step.screenReaderText) {
      const descId = `onboarding-description-${step.id}`;
      element.setAttribute('aria-describedby', descId);
      
      // Create hidden description element if it doesn't exist
      if (!document.getElementById(descId)) {
        const desc = document.createElement('div');
        desc.id = descId;
        desc.className = 'sr-only';
        desc.textContent = step.screenReaderText;
        document.body.appendChild(desc);
      }
    }
  }

  // Check if element is focusable
  private isFocusable(element: HTMLElement): boolean {
    const focusableSelectors = [
      'a[href]',
      'button',
      'input',
      'select',
      'textarea',
      '[tabindex]:not([tabindex="-1"])',
    ];
    
    return focusableSelectors.some(selector => element.matches(selector)) ||
           element.hasAttribute('tabindex');
  }

  // Focus management
  saveFocus(): void {
    this.previousFocus = document.activeElement as HTMLElement;
  }

  restoreFocus(): void {
    if (this.previousFocus && this.previousFocus.focus) {
      this.previousFocus.focus();
    }
  }

  focusElement(element: HTMLElement): void {
    this.focusTracker.set('current', element);
    element.focus();
    
    // Scroll element into view if needed
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center'
    });
  }

  // Cleanup
  clear(): void {
    // Remove added descriptions
    ONBOARDING_STEPS.forEach(step => {
      const descElement = document.getElementById(`onboarding-description-${step.id}`);
      if (descElement) {
        descElement.remove();
      }
    });

    this.elementRegistry.clear();
    this.componentRefs.clear();
    this.focusTracker.clear();
    this.restoreFocus();
  }
}

// Onboarding context for accessibility
interface OnboardingContextValue {
  isActive: boolean;
  currentStep: number;
  totalSteps: number;
  currentStepData: OnboardingStep | null;
  isCompleted: boolean;
  
  // Navigation
  nextStep: () => void;
  previousStep: () => void;
  goToStep: (stepIndex: number) => void;
  skipTour: () => void;
  completeTour: () => void;
  
  // Accessibility
  announceToScreenReader: (message: string) => void;
  focusCurrentTarget: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

// Hook to use onboarding context
export const useOnboarding = (): OnboardingContextValue => {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider');
  }
  return context;
};

// Screen reader announcement utility
const useScreenReaderAnnouncement = () => {
  const announcementRef = useRef<HTMLDivElement>(null);

  const announce = (message: string) => {
    if (announcementRef.current) {
      announcementRef.current.textContent = message;
      // Clear after announcement
      setTimeout(() => {
        if (announcementRef.current) {
          announcementRef.current.textContent = '';
        }
      }, 1000);
    }
  };

  const AnnouncementRegion = () => (
    <div
      ref={announcementRef}
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
      role="status"
    />
  );

  return { announce, AnnouncementRegion };
};

// Enhanced onboarding provider
export const OnboardingProvider: FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const { announce, AnnouncementRegion } = useScreenReaderAnnouncement();
  const serviceRef = useRef<AccessibleOnboardingService>();

  // Initialize service
  useEffect(() => {
    serviceRef.current = AccessibleOnboardingService.getInstance();
  }, []);

  const currentStepData = currentStep < ONBOARDING_STEPS.length ? ONBOARDING_STEPS[currentStep] : null;

  // Navigation functions
  const nextStep = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
      announce(`Step ${currentStep + 2} of ${ONBOARDING_STEPS.length}: ${ONBOARDING_STEPS[currentStep + 1].title}`);
    } else {
      completeTour();
    }
  };

  const previousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      announce(`Step ${currentStep} of ${ONBOARDING_STEPS.length}: ${ONBOARDING_STEPS[currentStep - 1].title}`);
    }
  };

  const goToStep = (stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < ONBOARDING_STEPS.length) {
      setCurrentStep(stepIndex);
      announce(`Navigated to step ${stepIndex + 1}: ${ONBOARDING_STEPS[stepIndex].title}`);
    }
  };

  const skipTour = () => {
    setIsActive(false);
    setIsCompleted(true);
    localStorage.setItem('maga-aldrin-onboarding-completed', 'true');
    announce('Tour skipped');
    serviceRef.current?.clear();
  };

  const completeTour = () => {
    setIsActive(false);
    setIsCompleted(true);
    localStorage.setItem('maga-aldrin-onboarding-completed', 'true');
    announce('Tour completed successfully');
    serviceRef.current?.clear();
  };

  const announceToScreenReader = (message: string) => {
    announce(message);
  };

  const focusCurrentTarget = () => {
    if (currentStepData && serviceRef.current) {
      const targetElement = serviceRef.current.getTargetElement(currentStepData);
      if (targetElement) {
        serviceRef.current.focusElement(targetElement);
      }
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'Escape':
          skipTour();
          break;
        case 'ArrowRight':
        case 'ArrowDown':
          event.preventDefault();
          nextStep();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          event.preventDefault();
          previousStep();
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          nextStep();
          break;
        case 'Home':
          event.preventDefault();
          goToStep(0);
          break;
        case 'End':
          event.preventDefault();
          goToStep(ONBOARDING_STEPS.length - 1);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isActive, currentStep]);

  // Focus management when step changes
  useEffect(() => {
    if (isActive && currentStepData) {
      // Announce step change
      announce(`${currentStepData.screenReaderText || currentStepData.description}`);
      
      // Focus target element after a brief delay
      setTimeout(() => {
        focusCurrentTarget();
      }, 500);
    }
  }, [currentStep, isActive]);

  // Save focus when starting tour
  useEffect(() => {
    if (isActive) {
      serviceRef.current?.saveFocus();
    }
  }, [isActive]);

  const contextValue: OnboardingContextValue = {
    isActive,
    currentStep,
    totalSteps: ONBOARDING_STEPS.length,
    currentStepData,
    isCompleted,
    nextStep,
    previousStep,
    goToStep,
    skipTour,
    completeTour,
    announceToScreenReader,
    focusCurrentTarget,
  };

  return (
    <OnboardingContext.Provider value={contextValue}>
      {children}
      <AnnouncementRegion />
    </OnboardingContext.Provider>
  );
};

// Enhanced onboarding target hook
export const useOnboardingTarget = (
  id: string, 
  ref?: React.RefObject<HTMLElement>,
  componentName?: string,
  ariaLabel?: string
) => {
  useEffect(() => {
    const service = AccessibleOnboardingService.getInstance();
    
    if (ref?.current) {
      service.registerElement(id, ref.current, ariaLabel);
      if (componentName) {
        service.registerComponentRef(componentName, ref, ariaLabel);
      }
    }

    return () => {
      // Cleanup if needed
    };
  }, [id, ref, componentName, ariaLabel]);
};

// Accessible onboarding modal
interface OnboardingModalProps {
  isVisible: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export const OnboardingModal: FC<OnboardingModalProps> = ({
  isVisible,
  onClose,
  onComplete,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const { currentStepData, currentStep, totalSteps, nextStep, previousStep, skipTour } = useOnboarding();

  // Focus management
  useEffect(() => {
    if (isVisible && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isVisible, currentStep]);

  if (!isVisible || !currentStepData) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
      aria-describedby="onboarding-description"
    >
      <div 
        ref={modalRef}
        className="bg-surface border border-border rounded-lg p-6 max-w-md mx-4 shadow-lg"
        tabIndex={-1}
      >
        {/* Progress indicator */}
        <div className="mb-4" role="progressbar" aria-valuenow={currentStep + 1} aria-valuemin={1} aria-valuemax={totalSteps}>
          <div className="text-xs text-muted mb-2">
            Step {currentStep + 1} of {totalSteps}
          </div>
          <div className="w-full bg-border rounded-full h-2">
            <div 
              className="bg-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        <h3 id="onboarding-title" className="text-lg font-semibold mb-4">
          {currentStepData.title}
        </h3>
        
        <p id="onboarding-description" className="text-sm mb-6">
          {currentStepData.description}
        </p>

        {/* Navigation buttons */}
        <div className="flex justify-between items-center">
          <button 
            onClick={skipTour} 
            className="btn-secondary"
            aria-label="Skip tour"
          >
            Skip
          </button>
          
          <div className="flex space-x-2">
            {currentStep > 0 && (
              <button 
                onClick={previousStep}
                className="btn-secondary"
                aria-label="Previous step"
              >
                Previous
              </button>
            )}
            
            <button 
              onClick={currentStep === totalSteps - 1 ? onComplete : nextStep}
              className="btn-primary"
              aria-label={currentStep === totalSteps - 1 ? "Complete tour" : "Next step"}
            >
              {currentStep === totalSteps - 1 ? 'Complete' : 'Next'}
            </button>
          </div>
        </div>

        {/* Keyboard shortcuts help */}
        <div className="mt-4 text-xs text-muted">
          <p>Keyboard shortcuts: Arrow keys or Enter to navigate, Escape to skip</p>
        </div>
      </div>
    </div>
  );
};

// Main onboarding component
export const Onboarding: FC = () => {
  const { isActive, isCompleted, announceToScreenReader } = useOnboarding();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // Check if user has completed onboarding
    const completed = localStorage.getItem('maga-aldrin-onboarding-completed');
    
    // Show onboarding for new users after a short delay
    if (!completed) {
      const timer = setTimeout(() => {
        setShowOnboarding(true);
        announceToScreenReader('Welcome tour is starting. Press Escape to skip or Enter to continue.');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [announceToScreenReader]);

  const handleComplete = () => {
    setShowOnboarding(false);
  };

  const handleClose = () => {
    setShowOnboarding(false);
    localStorage.setItem('maga-aldrin-onboarding-completed', 'true');
  };

  const handleRestart = () => {
    setShowOnboarding(true);
    announceToScreenReader('Restarting welcome tour');
  };

  return (
    <div>
      <OnboardingModal
        isVisible={showOnboarding}
        onClose={handleClose}
        onComplete={handleComplete}
      />
      
      {isCompleted && (
        <button
          onClick={handleRestart}
          className="fixed bottom-4 right-4 btn-secondary text-sm z-40"
          title="Restart Tour"
          aria-label="Restart welcome tour"
        >
          ? HELP
        </button>
      )}
    </div>
  );
};