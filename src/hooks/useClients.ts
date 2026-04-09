import { useState, useEffect, useCallback } from 'react';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  orderBy,
  limit,
  startAfter,
} from 'firebase/firestore';
import type { 
  DocumentData,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../api/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from './useNotifications';

export interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  photoURL?: string;
  userId: string;
  createdAt: any;
}

const PAGE_SIZE = 20;

export const useClients = () => {
  const { user } = useAuth();
  const { createNotification } = useNotifications();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // Carga inicial
  const fetchInitialClients = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const q = query(
        collection(db, 'clients'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(PAGE_SIZE)
      );

      const snapshot = await getDocs(q);
      const clientList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Client[];

      setClients(clientList);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === PAGE_SIZE);
    } catch (err) {
      console.error("Error fetching clients:", err);
      // Solo mostramos error si es fatal (no por falta de índices, aunque el aviso al usuario sigue siendo relevante)
      setError("No se pudo cargar la lista de clientes. Verifica tu conexión o índices de Firestore.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchInitialClients();
  }, [fetchInitialClients]);

  // Cargar siguiente página
  const fetchNextPage = async () => {
    if (!user || !lastDoc || !hasMore || isFetchingNextPage) return;

    setIsFetchingNextPage(true);
    try {
      const q = query(
        collection(db, 'clients'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        limit(PAGE_SIZE)
      );

      const snapshot = await getDocs(q);
      const nextClients = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Client[];

      setClients(prev => [...prev, ...nextClients]);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === PAGE_SIZE);
    } catch (err) {
      console.error("Error fetching next page:", err);
    } finally {
      setIsFetchingNextPage(false);
    }
  };

  // Crear cliente
  const addClient = async (clientData: Omit<Client, 'id' | 'userId' | 'createdAt'>) => {
    if (!user) throw new Error("Debes estar autenticado.");
    try {
      const docRef = await addDoc(collection(db, 'clients'), {
        ...clientData,
        userId: user.uid,
        createdAt: serverTimestamp(),
      });
      
      createNotification({
        title: 'Nuevo Cliente',
        message: `${clientData.name} se ha unido a tu ecosistema.`,
        type: 'info'
      });

      fetchInitialClients();
      return docRef.id;
    } catch (err) {
      console.error("Error adding client:", err);
      throw err;
    }
  };

  // Actualizar cliente
  const updateClient = async (clientId: string, data: Partial<Omit<Client, 'id' | 'userId' | 'createdAt'>>) => {
    try {
      const clientRef = doc(db, 'clients', clientId);
      await updateDoc(clientRef, data);
      setClients(prev => prev.map(c => c.id === clientId ? { ...c, ...data } : c));
    } catch (err) {
      console.error("Error updating client:", err);
      throw err;
    }
  };

  // Eliminar cliente
  const deleteClient = async (clientId: string) => {
    try {
      await deleteDoc(doc(db, 'clients', clientId));
      setClients(prev => prev.filter(c => c.id !== clientId));
    } catch (err) {
      console.error("Error deleting client:", err);
      throw err;
    }
  };

  return {
    clients,
    loading,
    isFetchingNextPage,
    error,
    hasMore,
    addClient,
    updateClient,
    deleteClient,
    fetchNextPage,
    refresh: fetchInitialClients
  };
};
