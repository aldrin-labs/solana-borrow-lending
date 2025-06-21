#!/bin/bash

# Simple test script to verify dashboard functionality
cd "$(dirname "$0")"

echo "🧪 Testing Solana Borrow-Lending Dashboard..."
echo "========================================"

# Test 1: Check if dependencies are installed
echo "✅ Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo "❌ Dependencies not installed. Run 'npm install --legacy-peer-deps' first."
    exit 1
fi

# Test 2: Check if TypeScript compiles
echo "✅ Checking TypeScript compilation..."
npx tsc --noEmit
if [ $? -ne 0 ]; then
    echo "❌ TypeScript compilation failed"
    exit 1
fi

# Test 3: Check if linting passes
echo "✅ Running linter..."
npm run lint
if [ $? -ne 0 ]; then
    echo "❌ Linting failed"
    exit 1
fi

# Test 4: Check if build succeeds
echo "✅ Testing build process..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

# Test 5: Check if key files exist
echo "✅ Checking dashboard components..."
components=(
    "src/components/Dashboard.tsx"
    "src/components/AnalyticsDashboard.tsx"
    "src/components/LendingDashboard.tsx"
    "src/components/BorrowingDashboard.tsx"
    "src/components/charts/TrendChart.tsx"
    "src/components/charts/UtilizationChart.tsx"
    "src/components/charts/APYComparisonChart.tsx"
    "src/hooks/useBorrowLending.ts"
)

for component in "${components[@]}"; do
    if [ ! -f "$component" ]; then
        echo "❌ Missing component: $component"
        exit 1
    fi
done

echo ""
echo "🎉 All tests passed! Dashboard is ready."
echo ""
echo "📊 Features Available:"
echo "   • Real-time analytics with interactive charts"
echo "   • Persona-based dashboard views (lender/borrower)"
echo "   • Health factor monitoring and risk indicators"
echo "   • TVL trends and utilization rate visualization"
echo "   • APY comparison charts across assets"
echo ""
echo "🚀 To start the development server:"
echo "   npm run dev"
echo ""
echo "🌐 To access the dashboard:"
echo "   http://localhost:3000"
echo ""