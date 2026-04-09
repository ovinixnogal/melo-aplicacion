import { useState } from 'react';
import {
  collection, 
  getDocs, 
  getDoc, 
  setDoc,
  doc, 
  updateDoc, 
  serverTimestamp, 
  Timestamp, 
  query, 
  where, 
  orderBy,
  runTransaction
} from 'firebase/firestore';
import { 
  initializeApp, 
  deleteApp as deleteSecondaryApp 
} from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  updateProfile 
} from 'firebase/auth';
import { db, firebaseConfig } from '../api/firebase';

export interface AdminUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  isAdmin: boolean;
  banned: boolean;
  createdAt: Timestamp | null;
  subscription?: {
    status: 'active' | 'inactive' | 'trial';
    currentPeriodEnd: Timestamp | null;
    currentPeriodStart: Timestamp | null;
    plan: string;
    price: number;
  };
  subscriptionHistory?: Array<{ 
    date: Timestamp | Date; 
    status: string; 
    note?: string;
    amount?: number;
    method?: string;
    notes?: string;
    end?: Timestamp | Date;
  }>;
  clientsCount?: number;
  loansCount?: number;
}

export interface SubscriptionPayment {
  id: string;
  userId: string;
  userName?: string;
  amount: number;
  currency: string;
  date: Timestamp;
  status: 'paid' | 'pending' | 'failed' | 'annulled';
  paymentMethod: 'manual' | 'stripe' | 'other';
  notes: string;
  exchangeRate?: number;
  amountBs?: number;
  createdBy?: string;
  createdAt: Timestamp;
}

export const useAdmin = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      const userList: AdminUser[] = [];

      // Count clients/loans per user in parallel
      await Promise.all(snapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        const uid = docSnap.id;

        const [clientsSnap, loansSnap] = await Promise.all([
          getDocs(query(collection(db, 'clients'), where('userId', '==', uid))),
          getDocs(query(collection(db, 'loans'), where('userId', '==', uid), where('status', '==', 'active'))),
        ]);

        userList.push({
          uid,
          displayName: data.displayName || null,
          email: data.email || null,
          isAdmin: data.isAdmin || false,
          banned: data.banned || false,
          createdAt: data.createdAt || null,
          subscription: data.subscription,
          subscriptionHistory: data.subscriptionHistory || [],
          clientsCount: clientsSnap.size,
          loansCount: loansSnap.size,
        });
      }));

      setUsers(userList.sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return b.createdAt.toMillis() - a.createdAt.toMillis();
      }));
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchPayments = async () => {
    setLoadingPayments(true);
    try {
      const snapshot = await getDocs(
        query(collection(db, 'subscription_payments'), orderBy('createdAt', 'desc'))
      );
      setPayments(
        snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SubscriptionPayment))
      );
    } catch (err) {
      console.error('Error fetching payments:', err);
    } finally {
      setLoadingPayments(false);
    }
  };

  const banUser = async (uid: string) => {
    await updateDoc(doc(db, 'users', uid), { banned: true });
    setUsers(prev => prev.map(u => u.uid === uid ? { ...u, banned: true } : u));
  };

  const unbanUser = async (uid: string) => {
    await updateDoc(doc(db, 'users', uid), { banned: false });
    setUsers(prev => prev.map(u => u.uid === uid ? { ...u, banned: false } : u));
  };

  const editUser = async (uid: string, data: { displayName?: string; email?: string }) => {
    await updateDoc(doc(db, 'users', uid), data);
    setUsers(prev => prev.map(u => u.uid === uid ? { ...u, ...data } : u));
  };

  const registerManualPayment = async (
    userId: string,
    amount: number,
    currency: string,
    exchangeRate: number,
    amountBs: number,
    notes: string,
    adminUid: string
  ) => {
    try {
      await runTransaction(db, async (transaction) => {
        const now = new Date();
        const userRef = doc(db, 'users', userId);
        const userSnap = await transaction.get(userRef);

        if (!userSnap.exists()) {
          throw new Error("El usuario no existe en Firestore.");
        }

        const userData = userSnap.data();
        const currentEnd = userData.subscription?.currentPeriodEnd?.toDate();
        
        let newStart: Date;
        let newEnd: Date;

        if (!currentEnd || currentEnd < now) {
          newStart = now;
          newEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        } else {
          newStart = currentEnd;
          newEnd = new Date(currentEnd.getTime() + 30 * 24 * 60 * 60 * 1000);
        }

        // 1. Create payment doc
        const paymentRef = doc(collection(db, 'subscription_payments'));
        transaction.set(paymentRef, {
          userId,
          userName: userData.displayName || userData.email || 'Desconocido',
          amount,
          amountBs,
          currency,
          exchangeRate,
          date: serverTimestamp(),
          status: 'paid',
          paymentMethod: 'manual',
          notes,
          createdBy: adminUid,
          createdAt: serverTimestamp(),
        });

        // 2. Update user subscription
        const history = userData.subscriptionHistory || [];
        transaction.update(userRef, {
          subscription: {
            status: 'active',
            currentPeriodStart: newStart,
            currentPeriodEnd: newEnd,
            plan: 'monthly',
            price: amount,
            currency: 'USD'
          },
          subscriptionHistory: [
            ...history,
            {
              amount,
              amountBs,
              currency,
              exchangeRate,
              date: now,
              method: 'admin_manual',
              notes,
              end: newEnd
            }
          ]
        });
      });

      await fetchUsers();
      await fetchPayments();
    } catch (err) {
      console.error("Error registering manual payment:", err);
      alert("Error al registrar el pago manual.");
    }
  };

  const approvePayment = async (paymentId: string, userId: string, adminUid: string) => {
    try {
      await runTransaction(db, async (transaction) => {
        const paymentRef = doc(db, 'subscription_payments', paymentId);
        const userRef = doc(db, 'users', userId);
        
        const [paymentSnap, userSnap] = await Promise.all([
          transaction.get(paymentRef),
          transaction.get(userRef)
        ]);

        if (!paymentSnap.exists() || paymentSnap.data().status !== 'pending') {
          throw new Error("El pago ya no está pendiente o no existe.");
        }

        if (!userSnap.exists()) {
          throw new Error("El usuario no existe.");
        }

        const userData = userSnap.data();
        const paymentData = paymentSnap.data();
        const now = new Date();
        const currentEnd = userData.subscription?.currentPeriodEnd?.toDate();

        let newStart: Date;
        let newEnd: Date;

        if (!currentEnd || currentEnd < now) {
          newStart = now;
          newEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        } else {
          newStart = currentEnd;
          newEnd = new Date(currentEnd.getTime() + 30 * 24 * 60 * 60 * 1000);
        }

        // 1. Update Payment
        transaction.update(paymentRef, { 
          status: 'paid',
          approvedBy: adminUid,
          approvedAt: serverTimestamp()
        });

        // 2. Update User Subscription
        const history = userData.subscriptionHistory || [];
        transaction.update(userRef, {
          subscription: {
            status: 'active',
            currentPeriodStart: newStart,
            currentPeriodEnd: newEnd,
            plan: 'monthly',
            price: paymentData.amount || 3,
          },
          subscriptionHistory: [
            ...history,
            {
              amount: paymentData.amount || 3,
              date: now,
              method: 'manual_approval',
              notes: 'Pago aprobado por administración',
              end: newEnd
            }
          ]
        });
      });

      await fetchPayments();
      await fetchUsers();
    } catch (err: any) {
      console.error("Error approving payment:", err);
      alert(err.message || "Error al procesar el pago.");
    }
  };

  const grantFreeAccess = async (userId: string, adminUid: string) => {
    try {
      const now = new Date();
      const userRef = doc(db, 'users', userId);
      
      const userSnapFirestore = await getDoc(userRef);
      if (!userSnapFirestore.exists()) throw new Error("Usuario no encontrado.");
      
      const userData = userSnapFirestore.data();
      const currentEnd = userData.subscription?.currentPeriodEnd?.toDate();

      let newStart: Date;
      let newEnd: Date;

      if (!currentEnd || currentEnd < now) {
        newStart = now;
        newEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      } else {
        newStart = currentEnd;
        newEnd = new Date(currentEnd.getTime() + 30 * 24 * 60 * 60 * 1000);
      }

      const history = userData.subscriptionHistory || [];
      await updateDoc(userRef, {
        subscription: {
          status: 'active',
          currentPeriodStart: newStart,
          currentPeriodEnd: newEnd,
          plan: 'monthly',
          price: 0,
        },
        subscriptionHistory: [
          ...history,
          { 
            date: now, 
            status: 'free_month', 
            note: `Acceso gratuito otorgado por admin (${adminUid}).`,
            end: newEnd 
          }
        ],
      });

      await fetchUsers();
    } catch (err) {
      console.error("Error granting free access:", err);
      alert("Error al otorgar acceso gratuito.");
    }
  };

  const registerUser = async (data: { 
    email: string; 
    password: string; 
    displayName: string; 
    hasSubscription?: boolean;
    adminUid: string;
  }) => {
    // Usamos una app secundaria para no cerrar la sesión del admin actual
    const secondaryApp = initializeApp(firebaseConfig, 'SecondaryRegistration');
    const secondaryAuth = getAuth(secondaryApp);
    
    try {
      const { user: newUser } = await createUserWithEmailAndPassword(secondaryAuth, data.email, data.password);
      await updateProfile(newUser, { displayName: data.displayName });

      const now = new Date();
      const end = new Date(now.getTime() + (data.hasSubscription ? 30 : 7) * 24 * 60 * 60 * 1000);
      
      const userRef = doc(db, 'users', newUser.uid);
      await setDoc(userRef, {
        uid: newUser.uid,
        email: data.email,
        displayName: data.displayName,
        name: data.displayName,
        isAdmin: false,
        banned: false,
        createdAt: serverTimestamp(),
        subscription: {
          status: data.hasSubscription ? 'active' : 'trial',
          currentPeriodStart: now,
          currentPeriodEnd: end,
          plan: 'monthly',
          price: data.hasSubscription ? 3 : 0,
        },
        subscriptionHistory: [
          {
            date: now,
            status: data.hasSubscription ? 'manual_registration_with_payment' : 'manual_trial_started',
            note: data.hasSubscription ? 'Registro manual con pago inicial.' : 'Registro manual (7 días pba)',
            end: end
          }
        ]
      });

      // Si tiene suscripción, registrar pago en el historial global
      if (data.hasSubscription) {
        const paymentRef = doc(collection(db, 'subscription_payments'));
        await setDoc(paymentRef, {
          userId: newUser.uid,
          userName: data.displayName,
          amount: 3,
          currency: 'USD',
          date: serverTimestamp(),
          status: 'paid',
          paymentMethod: 'manual',
          notes: 'Pago inicial en registro manual',
          createdBy: data.adminUid,
          createdAt: serverTimestamp(),
        });
      }

      await fetchUsers();
      await fetchPayments();
    } catch (error: any) {
      console.error("Error registering user:", error);
      throw error;
    } finally {
      await deleteSecondaryApp(secondaryApp);
    }
  };

  const cancelSubscriptionEntry = async (userId: string, entryIndex: number) => {
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', userId);
        const userSnap = await transaction.get(userRef);

        if (!userSnap.exists()) throw new Error("Usuario no encontrado.");

        const userData = userSnap.data();
        const history = [...(userData.subscriptionHistory || [])];
        
        if (entryIndex < 0 || entryIndex >= history.length) {
          throw new Error("Índice de historial inválido.");
        }

        // 1. Quitar la entrada del historial
        history.splice(entryIndex, 1);

        // 2. Ajustar la fecha de vencimiento (restar 30 días si fue una extensión)
        const currentEnd = userData.subscription?.currentPeriodEnd?.toDate();
        let newEnd = currentEnd;

        if (currentEnd) {
          // Si la entrada removida tenía una fecha de fin, calculamos el retroceso.
          // Para simplificar, restamos 30 días.
          newEnd = new Date(currentEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
        }

        const newStatus = (newEnd && newEnd > new Date()) ? 'active' : 'inactive';

        transaction.update(userRef, {
          subscriptionHistory: history,
          'subscription.currentPeriodEnd': newEnd,
          'subscription.status': newStatus
        });
      });

      await fetchUsers();
      await fetchPayments();
    } catch (err: any) {
      console.error("Error cancelling subscription entry:", err);
      alert(err.message || "Error al cancelar la suscripción.");
    }
  };

  return {
    users, payments,
    loadingUsers, loadingPayments,
    fetchUsers, fetchPayments,
    banUser, unbanUser, editUser, registerUser,
    registerManualPayment, approvePayment, grantFreeAccess,
    cancelSubscriptionEntry,
    annulPayment: async (paymentId: string, adminUid: string) => {
      try {
        await runTransaction(db, async (transaction) => {
          const paymentRef = doc(db, 'subscription_payments', paymentId);
          const paymentSnap = await transaction.get(paymentRef);
          
          if (!paymentSnap.exists()) throw new Error("Pago no encontrado.");
          const pData = paymentSnap.data();
          if (pData.status === 'annulled') throw new Error("El pago ya está anulado.");

          const userRef = doc(db, 'users', pData.userId);
          const userSnap = await transaction.get(userRef);

          // 1. Anular Pago
          transaction.update(paymentRef, { 
            status: 'annulled',
            annulledBy: adminUid,
            annulledAt: serverTimestamp()
          });

          // 2. Si estaba pagado, revertir suscripción
          if (pData.status === 'paid' && userSnap.exists()) {
            const userData = userSnap.data();
            const currentEnd = userData.subscription?.currentPeriodEnd?.toDate();
            if (currentEnd) {
              const newEnd = new Date(currentEnd.getTime() - 30 * 24 * 60 * 60 * 1000);
              const newStatus = newEnd > new Date() ? 'active' : 'inactive';
              
              // Intentar remover del historial (coincidencia aproximada por fecha o monto)
              const history = [...(userData.subscriptionHistory || [])];
              const matchIdx = history.findIndex(h => h.amount === pData.amount && (h.method === 'admin_manual' || h.method === 'manual_approval'));
              if (matchIdx > -1) history.splice(matchIdx, 1);

              transaction.update(userRef, {
                'subscription.currentPeriodEnd': newEnd,
                'subscription.status': newStatus,
                subscriptionHistory: history
              });
            }
          }
        });
        await fetchPayments();
        await fetchUsers();
      } catch (err: any) {
        console.error("Error annulling payment:", err);
        alert(err.message || "Error al anular el pago.");
      }
    }
  };
};
