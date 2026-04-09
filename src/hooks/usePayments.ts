import { useState, useCallback, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  Timestamp 
} from 'firebase/firestore';
import { db } from '../api/firebase';
import type { Currency } from './useLoans';

export interface PaymentRecord {
  id: string;
  loanId: string;
  amountPaid: number;
  paymentDate: Timestamp;
  method: string;
  currency: Currency;
  note?: string;
  originalAmount?: number;
  affectedInstallments?: number[]; // indices of installments affected
  createdAt: Timestamp;
}

export const usePayments = (loanId: string | undefined) => {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPayments = useCallback(async () => {
    if (!loanId) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'payments'),
        where('loanId', '==', loanId),
        orderBy('paymentDate', 'desc')
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as PaymentRecord));
      setPayments(data);
    } catch (err) {
      console.error("Error fetching payments:", err);
    } finally {
      setLoading(false);
    }
  }, [loanId]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  return { payments, loading, refresh: fetchPayments };
};
