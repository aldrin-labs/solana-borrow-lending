# Netlify Deployment Guide

This repository is configured for automatic deployment to Netlify.

## Deployment Configuration

- **Build Command**: `cd ui && npm ci --legacy-peer-deps && npm run build`
- **Publish Directory**: `ui/out`
- **Node.js Version**: 18

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

The repository includes a `netlify.toml` configuration file that:

- Builds the Next.js application automatically
- Configures client-side routing for the SPA
- Sets up security headers
- Optimizes caching for static assets

## Features

The deployed application includes:

- **Dashboard**: Market overview and user positions
- **Lending Interface**: Lending functionality at `/lend`
- **Borrowing Interface**: Borrowing functionality at `/borrow`  
- **Yield Farming**: Farming interface at `/farm`
- **Wallet Integration**: Support for Phantom, Solflare, and other Solana wallets
- **Responsive Design**: Optimized for desktop and mobile

## Technical Stack

- Next.js 15.3.2 with static export
- React 19.0.0
- TypeScript
- Tailwind CSS
- Solana Web3.js and Wallet Adapter

## Environment Variables

If you need to configure environment variables for your deployment, add them in your Netlify site settings under "Environment variables".

Common variables you might need:
- `NEXT_PUBLIC_SOLANA_NETWORK` - Solana network (devnet/mainnet-beta)
- `NEXT_PUBLIC_RPC_ENDPOINT` - Custom RPC endpoint URL

## Notes

- The application uses legacy peer dependencies due to React 19 compatibility
- Static export is enabled for optimal performance on Netlify
- All client-side routing is handled via redirects in `netlify.toml`