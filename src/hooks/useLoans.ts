import { useState, useCallback, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter, 
  getDocs, 
  getDoc,
  updateDoc, 
  doc, 
  runTransaction,
  serverTimestamp,
  increment,
  Timestamp,
} from 'firebase/firestore';
import type {
  DocumentData,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { db } from '../api/firebase';
import { useNotifications } from './useNotifications';

// --- TYPES ---

export type LoanStatus = 'active' | 'completed' | 'overdue' | 'cancelled';
export type PaymentFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type Currency = 'USD' | 'VES';

export interface Loan {
  id: string;
  clientId: string;
  clientName: string;
  userId: string;
  amount: number;
  interestRate: number; // e.g., 15 for 15%
  totalToPay: number;
  currency: Currency;
  startDate: Timestamp;
  endDate: Timestamp;
  frequency: PaymentFrequency;
  numberOfInstallments: number;
  paidInstallmentsCount: number;
  installmentAmount: number;
  status: LoanStatus;
  createdAt: Timestamp;
  notes?: string;
  cancelledAt?: Timestamp;
  cancellationReason?: string;
  // BCV Rate Support
  amountVES?: number;
  rateAtCreation?: number;
  amountUSDEquivalent?: number; 
  isIndexed?: boolean;
}

export interface Installment {
  id: string;
  loanId: string;
  amount: number;        // monto original de la cuota (en la moneda del préstamo)
  principalAmount: number; // parte de capital de esta cuota
  interestAmount: number;  // parte de interés de esta cuota
  amountUSD?: number;      // solo si es indexado
  principalAmountUSD?: number; // solo si es indexado
  interestAmountUSD?: number;  // solo si es indexado
  paidAmount: number;    // lo que se ha pagado de esta cuota (en la moneda del préstamo)
  status: 'pending' | 'partial' | 'paid';
  dueDate: Timestamp;
  paymentDate: Timestamp | null; // última fecha de pago aplicado a esta cuota
  installmentIndex: number;
  createdAt: Timestamp;
}

export interface Payment {
  id: string;
  loanId: string;
  installmentId: string;
  userId: string;
  amountPaid: number;
  principalPaid: number; // Cuánto de este pago es capital
  interestPaid: number;  // Cuánto de este pago es interés
  paymentDate: Timestamp;
  currency: Currency;
  method?: string;
  createdAt: Timestamp;
}

// --- HOOK ---

const PAGE_SIZE = 10;

export const useLoans = (userId: string | undefined) => {
  const { createNotification } = useNotifications();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [installments, setInstallments] = useState<Installment[]>([]);

  // 1. CARGA INICIAL
  const fetchInitialLoans = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const q = query(
        collection(db, 'loans'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE)
      );
      
      const snapshot = await getDocs(q);
      const loansData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Loan));
      
      setLoans(loansData);
      setLastVisible(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === PAGE_SIZE);
    } catch (err: any) {
      console.error("Error fetching loans:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchInitialLoans();
  }, [fetchInitialLoans]);

  // FETCH ALL INSTALLMENTS (Global for Calendar/Stats)
  useEffect(() => {
    if (!userId || loans.length === 0) return;
    
    const fetchGlobalInstallments = async () => {
      try {
        // Collect all active/pending installments for the user
        // Using collectionGroup if available or per-loan basis
        // Per-loan is safer for standard Firestore rules
        const installmentPromises = loans.map(loan => 
          getDocs(query(collection(db, `loans/${loan.id}/installments`)))
        );
        
        const snapshots = await Promise.all(installmentPromises);
        const allInst: Installment[] = [];
        
        snapshots.forEach(snapshot => {
          snapshot.docs.forEach(doc => {
            allInst.push({ id: doc.id, ...doc.data() } as Installment);
          });
        });
        
        setInstallments(allInst);
      } catch (err) {
        console.error("Error fetching global installments:", err);
      }
    };

    fetchGlobalInstallments();
  }, [userId, loans]);

  // 2. PAGINACIÓN
  const loadMoreLoans = async () => {
    if (!userId || !lastVisible || !hasMore || loading) return;
    
    setLoading(true);
    try {
      const q = query(
        collection(db, 'loans'),
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        startAfter(lastVisible),
        limit(PAGE_SIZE)
      );

      const snapshot = await getDocs(q);
      const nextLoans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Loan));
      
      setLoans(prev => [...prev, ...nextLoans]);
      setLastVisible(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === PAGE_SIZE);
    } catch (err: any) {
      console.error("Error loading more loans:", err);
    } finally {
      setLoading(false);
    }
  };

  // 3. CREAR PRÉSTAMO (CON CUOTAS)
  const createLoan = useCallback(async (data: {
    clientId: string;
    clientName: string;
    currency: Currency;
    amount: number;
    interestRate: number;
    startDate: Date;
    endDate: Date;
    frequency: PaymentFrequency;
    amountVES?: number;
    rateAtCreation?: number;
    amountUSDEquivalent?: number;
    isIndexed?: boolean;
  }) => {
    if (!userId) throw new Error("ID de usuario no disponible");

    try {
      const start = new Date(data.startDate);
      const end = new Date(data.endDate);
      
      let numberOfInstallments = 0;

      if (data.frequency === 'monthly') {
        const yearDiff = end.getFullYear() - start.getFullYear();
        const monthDiff = end.getMonth() - start.getMonth();
        numberOfInstallments = yearDiff * 12 + monthDiff;
        
        // Si el día final es mayor que el día inicial, y la diferencia es significativa (>15 días),
        // podría considerarse un mes extra, pero si es 09 a 09, debe ser exacto.
        // Si termina antes del día del mes de inicio, restamos uno si queremos ser estrictos, 
        // pero usualmente se cuenta el mes en curso.
        if (numberOfInstallments === 0) numberOfInstallments = 1;
      } else if (data.frequency === 'yearly') {
        numberOfInstallments = end.getFullYear() - start.getFullYear();
        if (numberOfInstallments === 0) numberOfInstallments = 1;
      } else {
        const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        const freqDaysMap: Record<PaymentFrequency, number> = { daily: 1, weekly: 7, monthly: 30, yearly: 365 };
        const freqDays = freqDaysMap[data.frequency];
        numberOfInstallments = Math.max(1, Math.round(diffDays / freqDays));
      }

      const totalInterest = data.amount * (data.interestRate / 100);
      const totalToPay = data.amount + totalInterest;
      const installmentAmount = parseFloat((totalToPay / numberOfInstallments).toFixed(2));

      // Cálculo de proporciones para separar capital e intereses
      const interestRatio = totalInterest / totalToPay;

      let installments = [];
      let remainingTotal = totalToPay;
      let remainingPrincipal = data.amount;

      const rate = data.rateAtCreation || 1;
      for (let i = 0; i < numberOfInstallments; i++) {
        let amount = installmentAmount;
        if (i === numberOfInstallments - 1) {
          amount = parseFloat(remainingTotal.toFixed(2));
        } else {
          remainingTotal -= amount;
        }

        // Calcular principal e interés de esta cuota
        let iAmount = parseFloat((amount * interestRatio).toFixed(2));
        let pAmount = parseFloat((amount - iAmount).toFixed(2));

        // Ajuste en la última cuota para el principal
        if (i === numberOfInstallments - 1) {
          pAmount = parseFloat(remainingPrincipal.toFixed(2));
          iAmount = parseFloat((amount - pAmount).toFixed(2));
        } else {
          remainingPrincipal -= pAmount;
        }

        const dueDate = new Date(data.startDate);
        if (data.frequency === 'monthly') {
          dueDate.setMonth(dueDate.getMonth() + (i + 1));
        } else if (data.frequency === 'yearly') {
          dueDate.setFullYear(dueDate.getFullYear() + (i + 1));
        } else {
          const freqDaysMap: Record<string, number> = { daily: 1, weekly: 7 };
          const daysToAdd = (i + 1) * (freqDaysMap[data.frequency] || 1);
          dueDate.setDate(dueDate.getDate() + daysToAdd);
        }

        // Si la fecha excede endDate, ajustar a endDate solo en la última cuota
        const finalDueDate = (i === numberOfInstallments - 1) ? data.endDate : (dueDate > data.endDate ? data.endDate : dueDate);
        
        installments.push({
          dueDate: Timestamp.fromDate(finalDueDate),
          amount,
          principalAmount: pAmount,
          interestAmount: iAmount,
          // Indexation logic
          ...(data.isIndexed && {
             amountUSD: parseFloat((amount / rate).toFixed(2)),
             principalAmountUSD: parseFloat((pAmount / rate).toFixed(2)),
             interestAmountUSD: parseFloat((iAmount / rate).toFixed(2))
          }),
          paidAmount: 0,
          status: 'pending' as const,
          paymentDate: null,
          installmentIndex: i
        });
      }

      const loanRef = doc(collection(db, 'loans'));
      const userRef = doc(db, 'users', userId);
      const capHistoryRef = doc(collection(db, 'capital_history'));
      
      const loanId = loanRef.id;

      await runTransaction(db, async (transaction) => {
        // 1. ATOMIC READ: Get current user balance
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw new Error("Documento de usuario no encontrado");
        
        const userData = userSnap.data();
        const capField = data.currency === 'USD' ? 'availableCapital' : 'availableCapitalVES';
        const currentCapital = userData?.[capField] || 0;

        // 2. VALIDATION: Check if enough capital exists
        if (currentCapital < data.amount) {
          throw new Error(`Capital insuficiente en ${data.currency}. Tienes ${data.currency === 'USD' ? '$' : 'Bs.'}${currentCapital.toLocaleString()}, pero el préstamo es de ${data.currency === 'USD' ? '$' : 'Bs.'}${data.amount.toLocaleString()}.`);
        }

        // 3. ATOMIC WRITES
        
        // A. Update User Capital
        transaction.update(userRef, {
          [capField]: increment(-data.amount)
        });

        // B. Capital History Entry (Disbursement)
        transaction.set(capHistoryRef, {
          userId,
          loanId: loanId,
          clientId: data.clientId,
          clientName: data.clientName,
          type: 'extraction',
          currency: data.currency,
          amount: data.amount,
          note: `Desembolso: Préstamo a ${data.clientName}${data.isIndexed ? ' (Indexado)' : ''}`,
          createdAt: serverTimestamp()
        });

        // C. Create Loan Document
        transaction.set(loanRef, {
          id: loanId,
          userId: userId,
          clientId: data.clientId,
          clientName: data.clientName,
          currency: data.currency,
          amount: data.amount,
          interestRate: data.interestRate,
          totalToPay,
          startDate: Timestamp.fromDate(data.startDate),
          endDate: Timestamp.fromDate(data.endDate),
          frequency: data.frequency,
          numberOfInstallments,
          installmentAmount,
          paidInstallmentsCount: 0,
          status: 'active',
          createdAt: serverTimestamp(),
          isIndexed: !!data.isIndexed,
          // BCV fields if applicable
          ...(data.amountVES && { amountVES: data.amountVES }),
          ...(data.rateAtCreation && { rateAtCreation: data.rateAtCreation }),
          ...(data.amountUSDEquivalent && { amountUSDEquivalent: data.amountUSDEquivalent }),
        });

        // D. Create Installments
        for (const installment of installments) {
          const installmentRef = doc(collection(db, `loans/${loanId}/installments`));
          transaction.set(installmentRef, {
            ...installment,
            id: installmentRef.id,
            loanId: loanId,
            createdAt: serverTimestamp(),
          });
        }
      });
      
      // Emitir notificación (fuera de la transacción por seguridad UX)
      createNotification({
        title: 'Préstamo Activo',
        message: `Has creado un préstamo de ${data.currency === 'USD' ? '$' : 'Bs.'}${data.amount.toLocaleString()} para ${data.clientName}`,
        type: 'info',
        link: `/prestamos/${loanId}`
      });

      fetchInitialLoans(); 
      return loanId;
    } catch (error) {
      console.error('Error creating loan within transaction:', error);
      throw error;
    }
  }, [userId, fetchInitialLoans]);

  // 4. ACTUALIZAR PRÉSTAMO
  const updateLoan = async (loanId: string, updates: Partial<Pick<Loan, 'status' | 'notes'>>) => {
    try {
      const loanRef = doc(db, 'loans', loanId);
      await updateDoc(loanRef, updates);
      setLoans(prev => prev.map(l => l.id === loanId ? { ...l, ...updates } : l));
    } catch (err: any) {
      console.error("Error updating loan:", err);
      throw err;
    }
  };

  const deleteLoan = async (loanId: string) => {
    if (!userId) return;
    try {
      const loanRef = doc(db, 'loans', loanId);
      const userRef = doc(db, 'users', userId);
      const capHistoryRef = doc(collection(db, 'capital_history'));

      await runTransaction(db, async (transaction) => {
        // A. ATOMIC READS
        const loanSnap = await transaction.get(loanRef);
        if (!loanSnap.exists()) throw new Error("Préstamo no encontrado");
        const loanData = loanSnap.data() as Loan;

        // Validation inside transaction: Cannot delete if payments exist
        if ((loanData.paidInstallmentsCount || 0) > 0) {
          throw new Error("No se puede eliminar un préstamo que ya tiene pagos registrados por seguridad contable.");
        }

        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw new Error("Documento de usuario no encontrado");

        // B. ATOMIC WRITES
        const capField = loanData.currency === 'USD' ? 'availableCapital' : 'availableCapitalVES';

        // Eliminar préstamo
        transaction.delete(loanRef);
        
        // Reintegrar capital al usuario
        transaction.update(userRef, {
          [capField]: increment(loanData.amount)
        });

        // Registrar en historial
        transaction.set(capHistoryRef, {
          userId,
          loanId: loanId,
          clientId: loanData.clientId,
          clientName: loanData.clientName,
          type: 'injection',
          currency: loanData.currency,
          amount: loanData.amount,
          note: `Reintegro: Préstamo Eliminado (${loanData.clientName})`,
          createdAt: serverTimestamp()
        });
      });

      setLoans(prev => prev.filter(l => l.id !== loanId));
    } catch (err: any) {
      console.error("Error deleting loan within transaction:", err);
      throw err;
    }
  };

  // 6. OBTENER PRÉSTAMO CON CUOTAS
  const getLoanById = useCallback(async (loanId: string) => {
    try {
      const loanDoc = await getDoc(doc(db, 'loans', loanId));
      if (!loanDoc.exists()) return null;

      const installmentsSnapshot = await getDocs(
        query(collection(db, `loans/${loanId}/installments`), orderBy('installmentIndex', 'asc'))
      );

      const installments = installmentsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Installment));
      const loan = { id: loanDoc.id, ...loanDoc.data() } as Loan;

      // --- AUTOMATIC OVERDUE CHECK ---
      if (loan.status === 'active' || loan.status === 'overdue') {
        const now = new Date();
        const hasOverdue = installments.some(inst => 
          inst.status !== 'paid' && inst.dueDate.toDate() < now
        );
        const shouldBeStatus = hasOverdue ? 'overdue' : 'active';

        if (loan.status !== shouldBeStatus) {
           await updateDoc(doc(db, 'loans', loanId), { status: shouldBeStatus });
           loan.status = shouldBeStatus;
           // Actualizar estado local si es necesario
           setLoans(prev => prev.map(l => l.id === loanId ? { ...l, status: shouldBeStatus } : l));
        }
      }

      return {
        loan,
        installments
      };
    } catch (err: any) {
      console.error("Error getting loan details:", err);
      throw err;
    }
  }, []);

  // 7. MARCAR CUOTA COMO PAGADA
  const markInstallmentAsPaid = async (
    loanId: string, 
    installmentId: string, 
    paymentData: { amount: number, method: string, currency: Currency, currentRate?: number }
  ) => {
    if (!userId) return;

    try {
      const now = Timestamp.now();
      const installmentRef = doc(db, `loans/${loanId}/installments`, installmentId);
      const loanRef = doc(db, 'loans', loanId);
      const userRef = doc(db, 'users', userId);
      const paymentRef = doc(collection(db, 'payments'));
      const capHistoryRef = doc(collection(db, 'capital_history'));

      await runTransaction(db, async (transaction) => {
        // 1. ATOMIC READS
        const instSnap = await transaction.get(installmentRef);
        if (!instSnap.exists()) throw new Error("Cuota no encontrada");
        const instData = instSnap.data() as Installment;

        const loanSnap = await transaction.get(loanRef);
        if (!loanSnap.exists()) throw new Error("Préstamo no encontrado");
        const loanData = loanSnap.data() as Loan;

        // 2. LOGIC & CALCULATIONS
        const rate = paymentData.currentRate || 1;
        let principalPaid = instData.principalAmount || paymentData.amount;
        let interestPaid = instData.interestAmount || 0;

        // INDEXATION ADJUSTMENT
        if (loanData.isIndexed && loanData.currency === 'VES' && paymentData.currentRate) {
           if (instData.principalAmountUSD !== undefined && instData.interestAmountUSD !== undefined) {
              principalPaid = parseFloat((instData.principalAmountUSD * rate).toFixed(2));
              interestPaid = parseFloat((instData.interestAmountUSD * rate).toFixed(2));
           }
        }
        
        const currentPaidCount = (loanData.paidInstallmentsCount || 0) + 1;
        const isCompleted = currentPaidCount === loanData.numberOfInstallments;

        // 3. ATOMIC WRITES (Update Installment, Loan, Payment, and User Capital)
        transaction.update(installmentRef, {
          status: 'paid',
          paidAmount: paymentData.amount,
          paymentDate: now,
          ...(paymentData.currentRate && { rateAtPayment: paymentData.currentRate })
        });

        transaction.update(loanRef, {
            paidInstallmentsCount: currentPaidCount,
            status: isCompleted ? 'completed' : 'active'
        });

        transaction.set(paymentRef, {
          loanId,
          installmentId,
          userId,
          amountPaid: paymentData.amount,
          principalPaid,
          interestPaid,
          paymentDate: now,
          currency: paymentData.currency,
          method: paymentData.method,
          rateUsed: paymentData.currentRate || null,
          createdAt: serverTimestamp()
        });

        const capField = paymentData.currency === 'USD' ? 'availableCapital' : 'availableCapitalVES';
        const intField = paymentData.currency === 'USD' ? 'earnedInterest' : 'earnedInterestVES';
        
        transaction.update(userRef, {
          [capField]: increment(principalPaid),
          [intField]: increment(interestPaid)
        });

        transaction.set(capHistoryRef, {
          userId,
          loanId,
          clientId: loanData.clientId,
          clientName: loanData.clientName,
          installmentId,
          type: 'loan_repayment',
          currency: paymentData.currency,
          amount: paymentData.amount,
          principalRescued: principalPaid,
          interestGained: interestPaid,
          note: `Cobro: Pago de cuota de ${loanData.clientName} (Prop. Principal: ${principalPaid}, Interés: ${interestPaid})`,
          createdAt: serverTimestamp()
        });
      });

      return true;
    } catch (err: any) {
      console.error("Error marking installment as paid:", err);
      throw err;
    }
  };

  // 8. REGISTRAR PAGO FLEXIBLE (SOPORTA ABONOS PARCIALES)
  const recordFlexiblePayment = async (
    loanId: string, 
    installmentId: string, 
    paymentData: { amount: number, method: string, currency: Currency, currentRate?: number }
  ) => {
    if (!userId) return;

    try {
      const now = Timestamp.now();
      const installmentRef = doc(db, `loans/${loanId}/installments`, installmentId);
      const loanRef = doc(db, 'loans', loanId);
      const userRef = doc(db, 'users', userId);
      const paymentRef = doc(collection(db, 'payments'));
      const capHistoryRef = doc(collection(db, 'capital_history'));

      let newStatus: Installment['status'] = 'pending';

      await runTransaction(db, async (transaction) => {
        // 1. ATOMIC READS
        const instSnap = await transaction.get(installmentRef);
        if (!instSnap.exists()) throw new Error("La cuota no existe");
        const installment = instSnap.data() as Installment;

        const loanSnap = await transaction.get(loanRef);
        if (!loanSnap.exists()) throw new Error("El préstamo no existe");
        const loanData = loanSnap.data() as Loan;

        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw new Error("Usuario no encontrado");

        // 2. INDEXATION CALCULATION
        const rate = paymentData.currentRate || 1;
        const isIndexedVES = loanData.isIndexed && loanData.currency === 'VES' && !!paymentData.currentRate;
        
        const realInstallmentAmount = isIndexedVES 
          ? parseFloat(((installment.amountUSD || 0) * rate).toFixed(2))
          : installment.amount;

        // 3. LOGIC
        const newPaidAmount = (installment.paidAmount || 0) + paymentData.amount;
        
        if (newPaidAmount >= realInstallmentAmount) {
          newStatus = 'paid';
        } else if (newPaidAmount <= 0) {
          newStatus = 'pending';
        } else {
          newStatus = 'partial';
        }

        // Calcula cuánto del ABONO ACTUAL va a principal vs interés basado en la proporción original
        const interestRatio = (installment.interestAmount || 0) / installment.amount;
        
        // Pero el capital recuperado real depende de la indexación si aplica
        let interestPaid = parseFloat((paymentData.amount * interestRatio).toFixed(2));
        let principalPaid = parseFloat((paymentData.amount - interestPaid).toFixed(2));

        if (isIndexedVES) {
           // Si es indexado, usamos la proporción en USD para el balance del usuario
           const interestRatioUSD = (installment.interestAmountUSD || 0) / (installment.amountUSD || 1);
           interestPaid = parseFloat((paymentData.amount * interestRatioUSD).toFixed(2));
           principalPaid = parseFloat((paymentData.amount - interestPaid).toFixed(2));
        }

        // 4. ATOMIC WRITES
        transaction.update(installmentRef, {
          status: newStatus,
          paidAmount: newPaidAmount,
          paymentDate: now
        });

        // 5. UPDATE LOAN STATUS (Dynamic check)
        const currentPaidCount = (newStatus === 'paid' && installment.status !== 'paid') 
          ? (loanData.paidInstallmentsCount || 0) + 1 
          : (loanData.paidInstallmentsCount || 0);

        const isCompleted = currentPaidCount === (loanData.numberOfInstallments || 0);
        
        let finalStatus: LoanStatus = isCompleted ? 'completed' : 'active';
        
        if (!isCompleted) {
           // Si no está completado, verificamos si queda algo en mora (excluyendo la que acabamos de pagar si quedó paga)
           // Para ser 100% precisos en una transacción, necesitaríamos leer todas las cuotas.
           // Pero podemos inferir: si pagamos esta cuota y era la única en mora, vuelve a active.
           // Como no tenemos todas las cuotas aquí, marcamos como active por defecto y 
           // dejaremos que getLoanById corrija a overdue si persisten otras deudas en mora.
           // O mejor: si todavía es un abono parcial y ya estaba vencida, sigue Overdue.
           if (loanData.status === 'overdue') {
              finalStatus = 'overdue'; // Mantener preventivamente
           }
        }

        transaction.update(loanRef, {
          paidInstallmentsCount: currentPaidCount,
          status: finalStatus
        });

        transaction.set(paymentRef, {
          loanId,
          installmentId,
          userId,
          amountPaid: paymentData.amount,
          principalPaid,
          interestPaid,
          paymentDate: now,
          currency: paymentData.currency,
          method: paymentData.method,
          statusAtPayment: newStatus,
          rateUsed: paymentData.currentRate || null,
          createdAt: serverTimestamp()
        });

        const capField = paymentData.currency === 'USD' ? 'availableCapital' : 'availableCapitalVES';
        const intField = paymentData.currency === 'USD' ? 'earnedInterest' : 'earnedInterestVES';
        
        transaction.update(userRef, {
          [capField]: increment(principalPaid),
          [intField]: increment(interestPaid)
        });

        transaction.set(capHistoryRef, {
          userId,
          loanId,
          clientId: loanData.clientId,
          clientName: loanData.clientName,
          installmentId,
          type: 'loan_repayment',
          currency: paymentData.currency,
          amount: paymentData.amount,
          principalRescued: principalPaid,
          interestGained: interestPaid,
          note: `Cobro: Abono flexible a ${loanData.clientName} (Prop. Principal: ${principalPaid}, Interés: ${interestPaid})`,
          createdAt: serverTimestamp()
        });
      });

      return { success: true, status: newStatus };
    } catch (err: any) {
      console.error("Error recording flexible payment within transaction:", err);
      throw err;
    }
  };

  const syncAllActiveLoans = async () => {
    if (!userId) return;
    try {
      const activeQuery = query(
        collection(db, 'loans'),
        where('userId', '==', userId),
        where('status', 'in', ['active', 'overdue'])
      );
      
      const snap = await getDocs(activeQuery);
      let updatedCount = 0;
      const now = new Date();

      for (const loanDoc of snap.docs) {
         const loan = { id: loanDoc.id, ...loanDoc.data() } as Loan;
         
         // Buscar si tiene alguna cuota vencida
         const installmentsSnap = await getDocs(
           query(
             collection(db, `loans/${loan.id}/installments`),
             where('status', '!=', 'paid')
           )
         );
         
         const hasOverdue = installmentsSnap.docs.some(d => d.data().dueDate.toDate() < now);
         const shouldStatus = hasOverdue ? 'overdue' : 'active';
         
         if (loan.status !== shouldStatus) {
            await updateDoc(loanDoc.ref, { status: shouldStatus });
            updatedCount++;
         }
      }
      
      if (updatedCount > 0) fetchInitialLoans();
      return updatedCount;
    } catch (err: any) {
      console.error("Error syncing loan statuses:", err);
      throw err;
    }
  };

  return {
    loans,
    loading,
    error,
    hasMore,
    loadMoreLoans,
    createLoan,
    updateLoan,
    deleteLoan,
    getLoanById,
    markInstallmentAsPaid,
    recordFlexiblePayment,
    syncAllActiveLoans,
    recordGlobalPayment: async (
      loanId: string,
      paymentAmount: number,
      paymentData: { method: string, currency: string, note?: string, originalAmount?: number, currentRate?: number }
    ) => {
      if (!userId) return;
      try {
        const now = Timestamp.now();
        const loanRef = doc(db, 'loans', loanId);
        const userRef = doc(db, 'users', userId);
        const installmentsQuery = query(collection(db, `loans/${loanId}/installments`), orderBy('installmentIndex', 'asc'));
        const paymentRef = doc(collection(db, 'payments'));
        const capHistoryRef = doc(collection(db, 'capital_history'));

        let isCompleted = false;
        let loanClientName = "";

        await runTransaction(db, async (transaction) => {
          // 1. ATOMIC READS
          const loanSnap = await transaction.get(loanRef);
          if (!loanSnap.exists()) throw new Error("Préstamo no encontrado");
          const loanData = loanSnap.data() as Loan;
          loanClientName = loanData.clientName;

          const userSnap = await transaction.get(userRef);
          if (!userSnap.exists()) throw new Error("Documento de usuario no encontrado");

          const installmentsSnap = await getDocs(installmentsQuery);
          const installmentRefs = installmentsSnap.docs.map(d => d.ref);
          
          // REALIZAR TODAS LAS LECTURAS TRANSACCIONALES PRIMERO
          const installmentSnaps = await Promise.all(installmentRefs.map(ref => transaction.get(ref)));
          
          let remainingToApply = paymentAmount;
          let completedInstallmentsCount = 0;
          let affectedIndices: number[] = [];
          let totalPrincipalPaid = 0;
          let totalInterestPaid = 0;
          let anyRemainingOverdue = false;
          
          const installmentUpdates: { ref: any, data: any }[] = [];

          const rate = paymentData.currentRate || 1;
          const isIndexedVES = loanData.isIndexed && loanData.currency === 'VES' && !!paymentData.currentRate;
          const nowDt = now.toDate();

          // 2. LOGIC (Sin escrituras directas aún)
          for (let i = 0; i < installmentSnaps.length; i++) {
            const snap = installmentSnaps[i];
            const ref = installmentRefs[i];
            const inst = snap.data() as Installment;
            
            if (inst.status === 'paid') continue;

            if (remainingToApply > 0) {
                // Recalcula el monto requerido de esta cuota si es indexado
                const realAmount = isIndexedVES 
                   ? parseFloat(((inst.amountUSD || 0) * rate).toFixed(2))
                   : inst.amount;

                const unpaidOfThisInst = realAmount - (inst.paidAmount || 0);
                
                let applyToThis = Math.min(remainingToApply, unpaidOfThisInst);
                const newPaidAmount = (inst.paidAmount || 0) + applyToThis;
                const newStatus = newPaidAmount >= realAmount ? 'paid' : 'partial';
                
                // Proporciones para el principal/interés (se usa la proporción USD para indexado)
                const ratio = isIndexedVES
                   ? (inst.interestAmountUSD || 0) / (inst.amountUSD || 1)
                   : (inst.interestAmount || 0) / inst.amount;

                const iPaid = parseFloat((applyToThis * ratio).toFixed(2));
                const pPaid = parseFloat((applyToThis - iPaid).toFixed(2));
                
                totalPrincipalPaid += pPaid;
                totalInterestPaid += iPaid;

                if (newStatus === 'paid') completedInstallmentsCount++;
                affectedIndices.push(inst.installmentIndex + 1);
                
                installmentUpdates.push({
                   ref,
                   data: {
                      status: newStatus,
                      paidAmount: newPaidAmount,
                      paymentDate: now
                   }
                });
                
                remainingToApply = parseFloat((remainingToApply - applyToThis).toFixed(2));

                // Check if this installment remains overdue
                if (newStatus !== 'paid' && inst.dueDate.toDate() < nowDt) {
                  anyRemainingOverdue = true;
                }
            } else {
                // Si no hay más dinero, revisamos si las cuotas pendientes restantes están vencidas
                if (inst.dueDate.toDate() < nowDt) {
                  anyRemainingOverdue = true;
                }
            }
          }

          // APLICAR ESCRITURAS TRANSACCIONALES
          for (const update of installmentUpdates) {
             transaction.update(update.ref, update.data);
          }

          // 3. ATOMIC WRITES (Audit & Master Doc)
          transaction.set(paymentRef, {
            loanId,
            userId,
            amountPaid: paymentAmount,
            principalPaid: totalPrincipalPaid,
            interestPaid: totalInterestPaid,
            paymentDate: now,
            currency: paymentData.currency,
            method: paymentData.method,
            originalAmount: paymentData.originalAmount || paymentAmount,
            note: paymentData.note || '',
            affectedInstallments: affectedIndices,
            rateUsed: paymentData.currentRate || null,
            createdAt: serverTimestamp()
          });

          const capField = paymentData.currency === 'USD' ? 'availableCapital' : 'availableCapitalVES';
          const intField = paymentData.currency === 'USD' ? 'earnedInterest' : 'earnedInterestVES';

          transaction.update(userRef, {
            [capField]: increment(totalPrincipalPaid),
            [intField]: increment(totalInterestPaid)
          });

          transaction.set(capHistoryRef, {
            userId,
            loanId,
            clientId: loanData.clientId,
            clientName: loanData.clientName,
            type: 'loan_repayment',
            currency: paymentData.currency as Currency,
            amount: paymentAmount,
            principalRescued: totalPrincipalPaid,
            interestGained: totalInterestPaid,
            note: `Cobro: Pago global de ${loanData.clientName} (Prop. Principal: ${totalPrincipalPaid}, Interés: ${totalInterestPaid})`,
            createdAt: serverTimestamp()
          });

          const oldPaid = loanData.paidInstallmentsCount || 0;
          const newPaidTotal = oldPaid + completedInstallmentsCount;
          isCompleted = newPaidTotal >= (loanData.numberOfInstallments || 0);

          transaction.update(loanRef, {
            paidInstallmentsCount: newPaidTotal,
            status: isCompleted ? 'completed' : (anyRemainingOverdue ? 'overdue' : 'active')
          });
        });

        if (isCompleted) {
          createNotification({
            title: '¡Préstamo Completado!',
            message: `El préstamo de ${loanClientName} ha sido saldado en su totalidad.`,
            type: 'success',
            link: `/prestamos/${loanId}`
          });
        }

        createNotification({
          title: 'Abono Recibido',
          message: `Recibiste un pago de ${paymentData.currency === 'USD' ? '$' : 'Bs.'}${paymentAmount.toLocaleString()}`,
          type: 'success',
          link: `/prestamos/${loanId}`
        });

        return true;
      } catch (err) {
        console.error("Error doing global payment:", err);
        throw err;
      }
    },
    refresh: fetchInitialLoans,
    cancelLoan: async (loanId: string, reason?: string) => {
      if (!userId) return;
      try {
        const loanRef = doc(db, 'loans', loanId);
        await runTransaction(db, async (transaction) => {
           const snap = await transaction.get(loanRef);
           if (!snap.exists()) throw new Error("Loan not found");
           const data = snap.data() as Loan;
           
           if (data.status === 'completed') throw new Error("No se puede cancelar un préstamo ya finalizado.");
           if (data.status === 'cancelled') throw new Error("El préstamo ya está cancelado.");

           transaction.update(loanRef, {
             status: 'cancelled',
             cancelledAt: serverTimestamp(),
             cancellationReason: reason || ''
           });
        });
        return true;
      } catch (err: any) {
        console.error("Error cancelling loan within transaction:", err);
        throw err;
      }
    },
    updateLoanStructure: async (loanId: string, data: Partial<Loan>) => {
      if (!userId) return;
      try {
        const now = Timestamp.now();
        const loanRef = doc(db, 'loans', loanId);

        await runTransaction(db, async (transaction) => {
          // 1. Get current data for recalculation
          const oldSnap = await transaction.get(loanRef);
          if (!oldSnap.exists()) throw new Error("Loan not found");
          const oldData = oldSnap.data() as Loan;
          
          // Only allow update if no payments have been made yet for safety
          if ((oldData.paidInstallmentsCount || 0) > 0) {
            throw new Error("No se puede cambiar la estructura de un préstamo que ya tiene pagos. Cancela y crea uno nuevo si es necesario.");
          }

          const finalData = { ...oldData, ...data };
          
          // Helper to get Date from Timestamp or Date
          const toDate = (val: any) => val.toDate ? val.toDate() : new Date(val);

          // 2. Recalculate installments
          const start = toDate(finalData.startDate);
          const end = toDate(finalData.endDate);
          const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          const freqDays = ({ daily: 1, weekly: 7, monthly: 30, yearly: 365 } as any)[finalData.frequency];
          let numberOfInstallments = Math.ceil(diffDays / freqDays);
          if (numberOfInstallments === 0) numberOfInstallments = 1;

          const totalInterest = finalData.amount * (finalData.interestRate / 100);
          const totalToPay = finalData.amount + totalInterest;
          const installmentAmount = parseFloat((totalToPay / numberOfInstallments).toFixed(2));

          // 3. Delete old installments (First fetch them)
          const oldInstallments = await getDocs(collection(db, `loans/${loanId}/installments`));
          for (const d of oldInstallments.docs) {
            transaction.delete(d.ref);
          }

          // 4. Create new installments
          for (let i = 0; i < numberOfInstallments; i++) {
            const dueDate = new Date(start);
            dueDate.setDate(dueDate.getDate() + ((i + 1) * freqDays));
            
            const instRef = doc(collection(db, `loans/${loanId}/installments`));
            transaction.set(instRef, {
              id: instRef.id,
              dueDate: Timestamp.fromDate(dueDate),
              amount: installmentAmount,
              paidAmount: 0,
              status: 'pending',
              paymentDate: null,
              createdAt: now,
              installmentIndex: i,
              loanId
            });
          }

          // 5. Update Master Document
          transaction.update(loanRef, {
            ...data,
            numberOfInstallments,
            paidInstallmentsCount: 0,
            totalToPay,
            installmentAmount,
            status: 'active'
          });
        });

        return true;
      } catch (err) {
        console.error("Error updating structure within transaction:", err);
        throw err;
      }
    },
    getClientFinancials: useCallback(async (clientId: string) => {
      if (!userId) return { totalPaid: 0, totalPending: 0, activeLoans: 0 };
      try {
        const q = query(
          collection(db, 'loans'),
          where('userId', '==', userId),
          where('clientId', '==', clientId)
        );
        const snapshot = await getDocs(q);
        const clientLoans = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Loan));
        
        let totalPaid = 0;
        let totalPending = 0;
        let activeLoans = 0;

        for (const loan of clientLoans) {
          if (loan.status === 'cancelled') continue;
          
          const instSnap = await getDocs(collection(db, `loans/${loan.id}/installments`));
          instSnap.docs.forEach(d => {
            const inst = d.data() as Installment;
            totalPaid += (inst.paidAmount || 0);
            totalPending += (inst.amount - (inst.paidAmount || 0));
          });
          
          if (loan.status === 'active' || loan.status === 'overdue') {
            activeLoans++;
          }
        }

        return { totalPaid, totalPending, activeLoans };
      } catch (err) {
        console.error("Error calculating client financials:", err);
        return { totalPaid: 0, totalPending: 0, activeLoans: 0 };
      }
    }, [userId]),
    fetchAllUserLoans: useCallback(async () => {
      /* ... existing fetchAllUserLoans logic ... */
      if (!userId) return [];
      try {
        const q = query(
          collection(db, 'loans'),
          where('userId', '==', userId)
        );
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Loan));
      } catch (err) {
        console.error("Error fetching all loans for user:", err);
        return [];
      }
    }, [userId]),
    installments
  };
};
