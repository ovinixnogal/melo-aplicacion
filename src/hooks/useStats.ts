import { useState, useCallback, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
} from 'firebase/firestore';
import { db } from '../api/firebase';

interface Stats {
  totalLentUSD: number;
  totalLentVES: number;
  totalReceivedUSD: number;
  totalReceivedVES: number;
  totalEarnedUSD: number;
  totalEarnedVES: number;
  clientsInDebt: number;
  activeLoansCount: number;
  chartData: { date: string; amount: number }[];
}

export const useStats = (userId: string | undefined) => {
  const [stats, setStats] = useState<Stats>({
    totalLentUSD: 0,
    totalLentVES: 0,
    totalReceivedUSD: 0,
    totalReceivedVES: 0,
    totalEarnedUSD: 0,
    totalEarnedVES: 0,
    clientsInDebt: 0,
    activeLoansCount: 0,
    chartData: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // 1. Fetch Loans
      const loansQuery = query(
        collection(db, 'loans'),
        where('userId', '==', userId),
      );
      const loansSnapshot = await getDocs(loansQuery);
      
      let lentUSD = 0;
      let lentVES = 0;
      let activeCount = 0;
      const debtorsSet = new Set<string>();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const rawChartData: { [key: string]: number } = {};

      loansSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.status === 'active') {
          if (data.currency === 'USD') lentUSD += data.amount || 0;
          else lentVES += data.amount || 0;
          
          activeCount++;
          debtorsSet.add(data.clientId);
        }

        // Prepare chart data (USD Equivalent for Chart)
        const createdAt = data.createdAt ? data.createdAt.toDate() : new Date();
        if (createdAt >= thirtyDaysAgo) {
          const dateStr = createdAt.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
          const val = data.currency === 'USD' ? (data.amount || 0) : ((data.amountUSDEquivalent || 0));
          rawChartData[dateStr] = (rawChartData[dateStr] || 0) + val;
        }
      });

      // 2. Fetch Payments
      const paymentsQuery = query(
        collection(db, 'payments'),
        where('userId', '==', userId)
      );
      const paymentsSnapshot = await getDocs(paymentsQuery);
      let receivedUSD = 0;
      let receivedVES = 0;
      let earnedUSD = 0;
      let earnedVES = 0;
      
      paymentsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.currency === 'USD') {
            receivedUSD += data.amountPaid || 0;
            earnedUSD += data.interestPaid || 0;
        } else {
            receivedVES += data.amountPaid || 0;
            earnedVES += data.interestPaid || 0;
        }
      });

      // Format Chart Data (Only show 7 last days)
      const chartData = Object.entries(rawChartData)
        .map(([date, amount]) => ({ date, amount }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(-7);

      setStats({
        totalLentUSD: lentUSD,
        totalLentVES: lentVES,
        totalReceivedUSD: receivedUSD,
        totalReceivedVES: receivedVES,
        totalEarnedUSD: earnedUSD,
        totalEarnedVES: earnedVES,
        clientsInDebt: debtorsSet.size,
        activeLoansCount: activeCount,
        chartData
      });

    } catch (err: any) {
      console.error("Error calculating stats:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refresh: fetchStats };
};
