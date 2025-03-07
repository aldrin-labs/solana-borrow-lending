import { Header } from '@/components/Header';
import { BorrowingDashboard } from '@/components/BorrowingDashboard';

export default function BorrowingPage() {
  return (
    <main className="min-h-screen">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Borrowing</h1>
        <BorrowingDashboard />
      </div>
    </main>
  );
}