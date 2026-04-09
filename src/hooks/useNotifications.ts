import { useState, useEffect } from 'react';
import { db } from '../api/firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot,
  doc,
  updateDoc,
  addDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'success' | 'warning' | 'info' | 'error';
  read: boolean;
  createdAt: Timestamp;
  link?: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs: AppNotification[] = [];
      let unread = 0;
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        notifs.push({ id: doc.id, ...data } as AppNotification);
        if (!data.read) unread++;
      });
      
      setNotifications(notifs);
      setUnreadCount(unread);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const markAsRead = async (notificationId: string) => {
    try {
      const ref = doc(db, 'notifications', notificationId);
      await updateDoc(ref, { read: true });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    const unreadNotifs = notifications.filter(n => !n.read);
    for (const notif of unreadNotifs) {
      await markAsRead(notif.id);
    }
  };

  const createNotification = async (data: Omit<AppNotification, 'id' | 'userId' | 'read' | 'createdAt'>) => {
    if (!user?.uid) return;
    try {
      await addDoc(collection(db, 'notifications'), {
        ...data,
        userId: user.uid,
        read: false,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  };

  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    createNotification
  };
}
