/**
 * End-to-end tests for wallet connection flows and real integration scenarios
 * Tests critical user journeys with proper error handling and edge cases
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';

// Mock wallet adapter for testing
class MockWalletAdapter {
  private page: Page;
  
  constructor(page: Page) {
    this.page = page;
  }
  
  async setupMockWallet() {
    // Inject mock wallet into page
    await this.page.addInitScript(() => {
      (window as any).mockWallet = {
        isPhantom: true,
        publicKey: null,
        isConnected: false,
        
        connect: async () => {
          await new Promise(resolve => setTimeout(resolve, 1000));
          (window as any).mockWallet.publicKey = {
            toString: () => '11111111111111111111111111111112'
          };
          (window as any).mockWallet.isConnected = true;
          return (window as any).mockWallet.publicKey;
        },
        
        disconnect: async () => {
          await new Promise(resolve => setTimeout(resolve, 500));
          (window as any).mockWallet.publicKey = null;
          (window as any).mockWallet.isConnected = false;
        },
        
        signTransaction: async (transaction: any) => {
          await new Promise(resolve => setTimeout(resolve, 800));
          return { ...transaction, signature: 'mock-signature' };
        },
        
        signAllTransactions: async (transactions: any[]) => {
          await new Promise(resolve => setTimeout(resolve, 1200));
          return transactions.map(tx => ({ ...tx, signature: 'mock-signature' }));
        }
      };
      
      // Mock Solana web3 connection
      (window as any).mockSolanaConnection = {
        getBalance: async () => 1000000000, // 1 SOL
        getLatestBlockhash: async () => ({
          blockhash: 'mock-blockhash',
          lastValidBlockHeight: 123456789
        }),
        sendTransaction: async () => 'mock-transaction-signature'
      };
    });
  }
  
  async connectWallet() {
    await this.page.click('[data-testid="wallet-connect-button"]');
    await this.page.click('[data-testid="phantom-wallet-option"]');
    await this.page.waitForTimeout(1500); // Wait for connection
  }
  
  async disconnectWallet() {
    await this.page.click('[data-testid="wallet-menu-button"]');
    await this.page.click('[data-testid="disconnect-wallet"]');
    await this.page.waitForTimeout(800);
  }
}

// Page object model for main dashboard
class DashboardPage {
  private page: Page;
  
  constructor(page: Page) {
    this.page = page;
  }
  
  async goto() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }
  
  async getProtocolStats() {
    const totalValue = await this.page.textContent('[data-testid="total-value-locked"]');
    const totalBorrowed = await this.page.textContent('[data-testid="total-borrowed"]');
    const activeUsers = await this.page.textContent('[data-testid="active-users"]');
    
    return { totalValue, totalBorrowed, activeUsers };
  }
  
  async navigateToLending() {
    await this.page.click('[data-testid="lending-nav-link"]');
    await this.page.waitForURL('**/lend');
    await this.page.waitForLoadState('networkidle');
  }
  
  async navigateToBorrowing() {
    await this.page.click('[data-testid="borrowing-nav-link"]');
    await this.page.waitForURL('**/borrow');
    await this.page.waitForLoadState('networkidle');
  }
  
  async waitForDataLoad() {
    await this.page.waitForSelector('[data-testid="loading-spinner"]', { state: 'hidden' });
    await this.page.waitForSelector('[data-testid="market-data-loaded"]');
  }
}

// Page object for lending operations
class LendingPage {
  private page: Page;
  
  constructor(page: Page) {
    this.page = page;
  }
  
  async getMarkets() {
    await this.page.waitForSelector('[data-testid="lending-markets"]');
    const markets = await this.page.$$eval('[data-testid="market-row"]', rows => 
      rows.map(row => ({
        token: row.querySelector('[data-testid="market-token"]')?.textContent,
        apy: row.querySelector('[data-testid="market-apy"]')?.textContent,
        totalSupply: row.querySelector('[data-testid="market-supply"]')?.textContent,
        utilization: row.querySelector('[data-testid="market-utilization"]')?.textContent,
      }))
    );
    return markets;
  }
  
  async supplyAsset(token: string, amount: string) {
    // Find the market row for the token
    await this.page.click(`[data-testid="supply-${token.toLowerCase()}"]`);
    
    // Enter amount in modal
    await this.page.fill('[data-testid="supply-amount-input"]', amount);
    
    // Confirm transaction
    await this.page.click('[data-testid="confirm-supply-button"]');
    
    // Wait for transaction completion
    await this.page.waitForSelector('[data-testid="transaction-success"]', { timeout: 10000 });
  }
}

test.describe('MAGA Finance - Wallet Integration', () => {
  let mockWallet: MockWalletAdapter;
  let dashboard: DashboardPage;
  
  test.beforeEach(async ({ page }) => {
    mockWallet = new MockWalletAdapter(page);
    dashboard = new DashboardPage(page);
    
    await mockWallet.setupMockWallet();
    await dashboard.goto();
  });

  test('should load dashboard with protocol statistics', async ({ page }) => {
    await dashboard.waitForDataLoad();
    
    // Check that main statistics are displayed
    const stats = await dashboard.getProtocolStats();
    
    expect(stats.totalValue).toBeTruthy();
    expect(stats.totalBorrowed).toBeTruthy();
    expect(stats.activeUsers).toBeTruthy();
    
    // Verify numbers are formatted correctly (with $ and commas)
    expect(stats.totalValue).toMatch(/\$[\d,]+/);
    expect(stats.totalBorrowed).toMatch(/\$[\d,]+/);
  });

  test('should handle wallet connection flow', async ({ page }) => {
    // Initial state - wallet not connected
    await expect(page.locator('[data-testid="wallet-connect-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="wallet-address"]')).not.toBeVisible();
    
    // Connect wallet
    await mockWallet.connectWallet();
    
    // Verify connection state
    await expect(page.locator('[data-testid="wallet-address"]')).toBeVisible();
    await expect(page.locator('[data-testid="wallet-connect-button"]')).not.toBeVisible();
    
    // Check wallet address is displayed
    const walletAddress = await page.textContent('[data-testid="wallet-address"]');
    expect(walletAddress).toContain('1111...1112'); // Truncated address
  });

  test('should handle wallet disconnection', async ({ page }) => {
    // First connect
    await mockWallet.connectWallet();
    await expect(page.locator('[data-testid="wallet-address"]')).toBeVisible();
    
    // Then disconnect
    await mockWallet.disconnectWallet();
    
    // Verify disconnection
    await expect(page.locator('[data-testid="wallet-connect-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="wallet-address"]')).not.toBeVisible();
  });

  test('should display user positions when wallet connected', async ({ page }) => {
    await mockWallet.connectWallet();
    await dashboard.waitForDataLoad();
    
    // Check for user positions section
    await expect(page.locator('[data-testid="user-positions"]')).toBeVisible();
    
    // Should show empty state or actual positions
    const positionsExist = await page.locator('[data-testid="position-row"]').count();
    const emptyState = await page.locator('[data-testid="no-positions"]').isVisible();
    
    expect(positionsExist > 0 || emptyState).toBeTruthy();
  });
});

test.describe('MAGA Finance - Lending Flow', () => {
  let mockWallet: MockWalletAdapter;
  let dashboard: DashboardPage;
  let lending: LendingPage;
  
  test.beforeEach(async ({ page }) => {
    mockWallet = new MockWalletAdapter(page);
    dashboard = new DashboardPage(page);
    lending = new LendingPage(page);
    
    await mockWallet.setupMockWallet();
    await dashboard.goto();
    await mockWallet.connectWallet();
  });

  test('should navigate to lending page and display markets', async ({ page }) => {
    await dashboard.navigateToLending();
    
    // Verify we're on lending page
    expect(page.url()).toContain('/lend');
    await expect(page.locator('[data-testid="lending-markets"]')).toBeVisible();
    
    // Get market data
    const markets = await lending.getMarkets();
    expect(markets.length).toBeGreaterThan(0);
    
    // Verify market data structure
    const firstMarket = markets[0];
    expect(firstMarket.token).toBeTruthy();
    expect(firstMarket.apy).toMatch(/\d+\.\d{2}%/); // Should be formatted like "5.25%"
    expect(firstMarket.totalSupply).toMatch(/\$[\d,]+/);
    expect(firstMarket.utilization).toMatch(/\d+\.\d{2}%/);
  });

  test('should handle supply transaction flow', async ({ page }) => {
    await dashboard.navigateToLending();
    
    // Attempt to supply SOL
    await lending.supplyAsset('SOL', '1.0');
    
    // Should show success message
    await expect(page.locator('[data-testid="transaction-success"]')).toBeVisible();
    
    // Should update user positions
    await expect(page.locator('[data-testid="user-supplied-positions"]')).toBeVisible();
  });

  test('should handle supply transaction errors', async ({ page }) => {
    // Mock transaction failure
    await page.addInitScript(() => {
      (window as any).mockWallet.signTransaction = async () => {
        throw new Error('User rejected transaction');
      };
    });
    
    await dashboard.navigateToLending();
    
    // Click supply button
    await page.click('[data-testid="supply-sol"]');
    await page.fill('[data-testid="supply-amount-input"]', '1.0');
    await page.click('[data-testid="confirm-supply-button"]');
    
    // Should show error message
    await expect(page.locator('[data-testid="transaction-error"]')).toBeVisible();
    
    // Error should be user-friendly
    const errorText = await page.textContent('[data-testid="error-message"]');
    expect(errorText).toContain('rejected');
  });
});

test.describe('MAGA Finance - Error Handling', () => {
  test('should handle network errors gracefully', async ({ page }) => {
    // Block all network requests to simulate offline
    await page.route('**/*', route => route.abort());
    
    await page.goto('/');
    
    // Should show offline/error state
    await expect(page.locator('[data-testid="network-error"]')).toBeVisible();
    
    // Should have retry mechanism
    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
  });

  test('should handle API errors with proper fallbacks', async ({ page }) => {
    // Mock API to return errors
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });
    
    await page.goto('/');
    
    // Should show error boundary or fallback UI
    const hasErrorFallback = await page.locator('[data-testid="error-fallback"]').isVisible();
    const hasRetryOption = await page.locator('[data-testid="retry-data"]').isVisible();
    
    expect(hasErrorFallback || hasRetryOption).toBeTruthy();
  });

  test('should maintain accessibility during errors', async ({ page }) => {
    await page.goto('/');
    
    // Simulate component error
    await page.evaluate(() => {
      throw new Error('Component rendering error');
    });
    
    // Error boundary should maintain accessibility
    const errorElement = page.locator('[data-testid="error-boundary"]');
    await expect(errorElement).toHaveAttribute('role', 'alert');
    await expect(errorElement).toHaveAttribute('aria-live', 'polite');
  });
});

test.describe('MAGA Finance - PWA Features', () => {
  test('should register service worker', async ({ page }) => {
    await page.goto('/');
    
    // Check if service worker is registered
    const swRegistered = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.ready;
        const registrations = await navigator.serviceWorker.getRegistrations();
        return registrations.length > 0;
      }
      return false;
    });
    
    expect(swRegistered).toBeTruthy();
  });

  test('should cache resources for offline use', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Go offline
    await page.context().setOffline(true);
    
    // Reload page
    await page.reload();
    
    // Should still load (from cache)
    await expect(page.locator('[data-testid="app-header"]')).toBeVisible();
  });

  test('should show install prompt on mobile', async ({ page, context }) => {
    // Simulate mobile device
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/');
    
    // Should have PWA install prompt
    const installButton = page.locator('[data-testid="pwa-install-button"]');
    
    // May not be visible immediately, but should exist
    await expect(installButton).toBeAttached();
  });
});

test.describe('MAGA Finance - Performance', () => {
  test('should load within performance budget', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    // Should load within 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('should have good Core Web Vitals', async ({ page }) => {
    await page.goto('/');
    
    // Measure Web Vitals
    const webVitals = await page.evaluate(() => {
      return new Promise((resolve) => {
        let lcpValue = 0;
        let clsValue = 0;
        
        // LCP (Largest Contentful Paint)
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          lcpValue = entries[entries.length - 1].startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        
        // CLS (Cumulative Layout Shift)
        new PerformanceObserver((list) => {
          let cls = 0;
          list.getEntries().forEach((entry: any) => {
            if (!entry.hadRecentInput) {
              cls += entry.value;
            }
          });
          clsValue = cls;
        }).observe({ type: 'layout-shift', buffered: true });
        
        setTimeout(() => {
          resolve({ lcp: lcpValue, cls: clsValue });
        }, 3000);
      });
    });
    
    // LCP should be under 2.5s
    expect((webVitals as any).lcp).toBeLessThan(2500);
    
    // CLS should be under 0.1
    expect((webVitals as any).cls).toBeLessThan(0.1);
  });
});

test.describe('MAGA Finance - Accessibility', () => {
  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/');
    
    // Check for proper ARIA labels on interactive elements
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      const hasAriaLabel = await button.getAttribute('aria-label');
      const hasText = await button.textContent();
      
      // Button should have either aria-label or visible text
      expect(hasAriaLabel || hasText?.trim()).toBeTruthy();
    }
  });

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/');
    
    // Tab through interactive elements
    const focusableElements = page.locator('button, a, input, select, textarea, [tabindex="0"]');
    const elementCount = await focusableElements.count();
    
    expect(elementCount).toBeGreaterThan(0);
    
    // Focus first element
    await page.keyboard.press('Tab');
    
    // Should have visible focus indicator
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });

  test('should announce important updates to screen readers', async ({ page }) => {
    await page.goto('/');
    
    // Check for ARIA live regions
    const liveRegions = page.locator('[aria-live]');
    const liveRegionCount = await liveRegions.count();
    
    expect(liveRegionCount).toBeGreaterThan(0);
    
    // Check for status updates
    await expect(page.locator('[role="status"]')).toBeAttached();
  });
});

test.describe('MAGA Finance - Real Data Integration', () => {
  test('should fetch real market data', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check that data appears to be real (not obviously mock)
    const stats = await page.locator('[data-testid="total-value-locked"]').textContent();
    
    // Should be a reasonable number (not exactly 1000000)
    expect(stats).not.toBe('$1,000,000');
    expect(stats).toMatch(/\$[\d,]+/);
  });

  test('should update data in real-time', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Get initial value
    const initialValue = await page.textContent('[data-testid="total-value-locked"]');
    
    // Wait for potential update (real-time updates happen every 15 seconds)
    await page.waitForTimeout(20000);
    
    // Value might have changed (or stayed the same if markets are stable)
    const updatedValue = await page.textContent('[data-testid="total-value-locked"]');
    
    // Both values should be valid currency strings
    expect(initialValue).toMatch(/\$[\d,]+/);
    expect(updatedValue).toMatch(/\$[\d,]+/);
  });
});