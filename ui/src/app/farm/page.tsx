import { Header } from '@/components/Header';
import { YieldFarmingDashboard } from '@/components/YieldFarmingDashboard';

export default function YieldFarmingPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Yield Farming</h1>
        <YieldFarmingDashboard />
      </div>
    </main>
  );
}