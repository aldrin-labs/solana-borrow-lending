# Solana Borrow-Lending Protocol UI

A high-performance UI for the Solana Borrow-Lending Protocol built with Next.js and React 19.0.0.

## Features

- **Enhanced Dashboard**: Comprehensive overview with real-time analytics and charts
  - **Protocol Analytics**: TVL trends, utilization rates, and market health indicators
  - **Persona-based Views**: Specialized dashboards for lenders and borrowers
  - **Real-time Charts**: Interactive visualizations using Recharts library
  - **Health Factor Monitoring**: Visual indicators for position health and liquidation risk
- **Lending**: Supply assets to earn interest with advanced analytics
- **Borrowing**: Borrow assets against your collateral with risk management tools
- **Yield Farming**: Leverage your positions for yield farming
- **Wallet Integration**: Connect with popular Solana wallets (Phantom, Solflare, Backpack)
- **Real-time Updates**: Stay informed with real-time market prices, user balance updates, and protocol statistics

## Technology Stack

- **Next.js**: React framework for server-rendered applications
- **React 19.0.0**: Latest version of React with improved performance
- **Tailwind CSS**: Utility-first CSS framework for rapid UI development
- **Recharts**: Modern chart library for React with responsive design
- **Solana Web3.js**: Solana blockchain integration
- **Wallet Adapter**: Solana wallet connection library
- **SWR**: React Hooks for data fetching

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone https://github.com/your-username/solana-borrow-lending-ui.git
cd solana-borrow-lending-ui
```

2. Install dependencies
```bash
npm install
# or
yarn install
```

3. Start the development server
```bash
npm run dev
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

- `/src/app`: Next.js app router pages
- `/src/components`: React components
  - `/charts`: Reusable chart components (TrendChart, UtilizationChart, APYComparisonChart)
- `/src/hooks`: Custom React hooks
- `/src/utils`: Utility functions
- `/public`: Static assets

## Dashboard Features

### Main Dashboard
The main dashboard provides a comprehensive overview with three main tabs:
- **Market Overview**: Real-time market data and trading opportunities
- **Your Positions**: Personal portfolio management
- **Analytics**: Advanced charts and protocol insights

### Specialized Dashboards

#### Lender Dashboard (`/lend`)
- **Supply Markets**: Browse available lending opportunities
- **Your Positions**: Manage your supplied assets and collateral settings
- **Analytics**: Lender-focused metrics including:
  - Supply volume trends
  - Interest earnings over time
  - APY comparisons across assets

#### Borrower Dashboard (`/borrow`)
- **Borrow Markets**: Explore borrowing opportunities
- **Your Borrows**: Monitor borrowed positions and repayment status
- **Analytics**: Borrower-focused metrics including:
  - Health factor monitoring with visual indicators
  - Liquidation risk assessment
  - Borrow capacity and utilization

### Real-time Analytics
- **Interactive Charts**: Built with Recharts for responsive, accessible visualizations
- **Live Data Updates**: Simulated real-time updates every 10 seconds
- **Health Monitoring**: Visual health factor indicators with color-coded risk levels
- **Trend Analysis**: Historical data visualization for informed decision making

## Deployment

This application can be deployed to Vercel, Netlify, or any other static site hosting service.

```bash
npm run build
# or
yarn build
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.