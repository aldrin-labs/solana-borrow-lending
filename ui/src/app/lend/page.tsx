import { Header } from '@/components/Header';
import { LendingDashboard } from '@/components/LendingDashboard';

export default function LendingPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Lending</h1>
        <LendingDashboard />
      </div>
    </main>
  );
}