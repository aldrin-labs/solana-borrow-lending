# Netlify Deployment Guide

This repository is configured for automatic deployment to Netlify with optimized settings for the analytics dashboard.

## Deployment Configuration

- **Build Command**: `cd ui && npm install --legacy-peer-deps && npm run build`
- **Publish Directory**: `ui/out`
- **Node.js Version**: 18
- **Environment**: Optimized for React 19 and Next.js 15.3.2

## Enhanced Features

### Analytics Dashboard Optimizations
- **Chart Caching**: Optimized caching headers for chart assets and static resources
- **Security Headers**: Enhanced CSP headers allowing Solana RPC connections
- **Performance**: Static pre-rendering for key routes (`/lend`, `/borrow`, `/farm`)
- **SEO**: Proper meta tags and structured redirects for analytics pages

### Build Optimizations
- **Legacy Peer Dependencies**: Configured for React 19 compatibility
- **Telemetry Disabled**: Faster builds with Next.js telemetry disabled
- **Asset Optimization**: Minification and bundling enabled for CSS/JS
- **Cache Control**: Aggressive caching for static assets (fonts, images, charts)

## Manual Deployment

To deploy manually to Netlify:

1. **Build the application locally:**
   ```bash
   cd ui
   npm install --legacy-peer-deps
   npm run build
   ```

2. **Deploy to Netlify:**
   - Upload the `ui/out` directory to Netlify
   - Or use Netlify CLI: `netlify deploy --prod --dir=ui/out`

## Automatic Deployment

The repository includes an enhanced `netlify.toml` configuration file that:

- Builds the Next.js application automatically with legacy peer dependency support
- Configures client-side routing for the SPA with pre-rendered routes
- Sets up enhanced security headers with Solana RPC allowlist
- Optimizes caching for static assets, fonts, and chart components
- Disables Next.js telemetry for faster builds
- Includes function directory setup for future API endpoints

## Features

The deployed application includes:

- **Analytics Dashboard**: Real-time charts and persona-based views with Recharts integration
- **Dashboard**: Market overview and user positions with 3-tab navigation
- **Lending Interface**: Lending functionality at `/lend` with supply analytics
- **Borrowing Interface**: Borrowing functionality at `/borrow` with health factor monitoring
- **Yield Farming**: Farming interface at `/farm` with APY tracking
- **Wallet Integration**: Support for Phantom, Solflare, and other Solana wallets
- **Responsive Design**: Optimized for desktop and mobile with dark theme support

## Technical Stack

- Next.js 15.3.2 with static export
- React 19.0.0 with strict mode
- TypeScript with strict type checking
- Tailwind CSS for styling
- Recharts for analytics visualization
- Solana Web3.js and Wallet Adapter
- SWR for data fetching and real-time updates

## Environment Variables

Set these environment variables in your Netlify site settings:

### Required Variables
- `NEXT_PUBLIC_SOLANA_NETWORK` - Solana network (devnet/mainnet-beta)
- `NEXT_PUBLIC_RPC_ENDPOINT` - Custom RPC endpoint URL

### Optional Variables
- `NEXT_PUBLIC_ANALYTICS_ENABLED` - Enable/disable analytics features (default: true)
- `NEXT_PUBLIC_REFRESH_INTERVAL` - Data refresh interval in ms (default: 10000)
- `NEXT_PUBLIC_CHART_THEME` - Chart color theme (default: dark)
- `NEXT_TELEMETRY_DISABLED` - Disable Next.js telemetry (set to "1")

### Example Configuration
```
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_RPC_ENDPOINT=https://api.devnet.solana.com
NEXT_PUBLIC_ANALYTICS_ENABLED=true
NEXT_PUBLIC_REFRESH_INTERVAL=10000
NEXT_TELEMETRY_DISABLED=1
```

## Notes

- The application uses legacy peer dependencies due to React 19 compatibility
- Static export is enabled for optimal performance on Netlify
- All client-side routing is handled via redirects in `netlify.toml`
- Analytics dashboard includes real-time data simulation for demo purposes
- Chart components are optimized for performance with proper caching headers
- Security headers include Solana RPC endpoint allowlist for wallet connections
- Build process automatically generates package-lock.json if not present

## Performance Optimizations

### Caching Strategy
- **Static Assets**: 1 year cache with immutable flag
- **Images/Fonts**: 24 hour cache for optimal loading
- **HTML Pages**: Pre-rendered for faster initial load
- **Chart Data**: Optimized bundle splitting for analytics components

### Security Features
- **CSP Headers**: Strict content security policy with Solana RPC allowlist
- **Frame Protection**: X-Frame-Options set to DENY
- **XSS Protection**: Enhanced XSS protection headers
- **Permissions Policy**: Restricted access to device APIs

## Troubleshooting

### Build Issues
- If build fails, ensure package-lock.json is committed
- Use `npm install --legacy-peer-deps` for React 19 compatibility
- Clear Netlify build cache if experiencing persistent issues

### Runtime Issues
- Check environment variables are properly set in Netlify dashboard
- Verify RPC endpoints are accessible and CORS-enabled
- Ensure wallet extensions are properly installed for full functionality