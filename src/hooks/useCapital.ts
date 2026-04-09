import { useState, useEffect } from 'react';
import { 
  doc, 
  onSnapshot, 
  increment, 
  collection, 
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  runTransaction
} from 'firebase/firestore';
import { db } from '../api/firebase';
import { useNotifications } from './useNotifications';

export interface CapitalTransaction {
  id: string;
  type: 'injection' | 'extraction' | 'loan_disbursement' | 'loan_repayment';
  amount: number;
  currency: 'USD' | 'VES';
  principalRescued?: number;
  interestGained?: number;
  note: string;
  createdAt: any;
}

export const useCapital = (userId: string | undefined) => {
  const { createNotification } = useNotifications();
  const [balances, setBalances] = useState<{ 
    USD: number; 
    VES: number;
    earnedUSD: number;
    earnedVES: number;
  }>({ USD: 0, VES: 0, earnedUSD: 0, earnedVES: 0 });
  const [history, setHistory] = useState<CapitalTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [itemLimit, setItemLimit] = useState(50);

  useEffect(() => {
    if (!userId) {
       setLoading(false);
       return;
    }

    const userRef = doc(db, 'users', userId);
    
    // Listen to user capital (both currencies)
    const unsubUser = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBalances({
          USD: data.availableCapital || 0,
          VES: data.availableCapitalVES || 0,
          earnedUSD: data.earnedInterest || 0,
          earnedVES: data.earnedInterestVES || 0
        });
      }
      setLoading(false);
    });

    // Listen to transaction history with dynamic limit
    const historyQuery = query(
      collection(db, 'capital_history'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(itemLimit)
    );

    const unsubHistory = onSnapshot(historyQuery, (snapshot) => {
      const txs = snapshot.docs.map(d => ({ 
        id: d.id, 
        ...d.data() 
      } as CapitalTransaction));
      setHistory(txs);
      setHasMore(snapshot.docs.length === itemLimit);
    });

    return () => {
      unsubUser();
      unsubHistory();
    };
  }, [userId, itemLimit]);

  const loadMore = () => {
    if (hasMore) setItemLimit(prev => prev + 50);
  };

  const updateCapital = async (amount: number, type: 'injection' | 'extraction', currency: 'USD' | 'VES', note: string) => {
    if (!userId) return;

    const userRef = doc(db, 'users', userId);
    const capHistoryRef = doc(collection(db, 'capital_history'));
    const finalAmount = type === 'extraction' ? -Math.abs(amount) : Math.abs(amount);
    const field = currency === 'USD' ? 'availableCapital' : 'availableCapitalVES';

    try {
      await runTransaction(db, async (transaction) => {
        // 1. ATOMIC READ
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw new Error("Documento de usuario no encontrado");
        
        const currentBalance = userSnap.data()[field] || 0;

        // 2. VALIDATION for extractions
        if (type === 'extraction' && currentBalance < Math.abs(amount)) {
          throw new Error(`Fondos insuficientes para retirar ${currency === 'USD' ? '$' : 'Bs.'}${amount.toLocaleString()}. Balance actual: ${currency === 'USD' ? '$' : 'Bs.'}${currentBalance.toLocaleString()}`);
        }

        // 3. ATOMIC WRITES
        transaction.update(userRef, {
          [field]: increment(finalAmount)
        });

        transaction.set(capHistoryRef, {
          userId,
          type,
          currency,
          amount: Math.abs(amount),
          note,
          createdAt: serverTimestamp()
        });
      });

      // 4. Trigger Notification (Outside transaction)
      createNotification({
        title: type === 'injection' ? 'Capital Inyectado' : 'Retiro de Capital',
        message: `${type === 'injection' ? 'Has sumado' : 'Has retirado'} ${currency === 'USD' ? '$' : 'Bs.'}${amount.toLocaleString()} a tu balance general.`,
        type: type === 'injection' ? 'success' : 'info'
      });

      return { success: true };
    } catch (err: any) {
      console.error("Error updating capital within transaction:", err);
      throw err;
    }
  };

  return {
    balances,
    history,
    loading,
    updateCapital,
    hasMore,
    loadMore
  };
};
