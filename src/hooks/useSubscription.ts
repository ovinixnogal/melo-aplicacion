import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { UserSubscription } from '../contexts/AuthContext';

export const useSubscription = () => {
  const { user, loading: authLoading } = useAuth();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [daysRemaining, setDaysRemaining] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If auth is still loading, we are loading
    if (authLoading) {
      setLoading(true);
      return;
    }

    if (user?.subscription) {
      const sub = user.subscription;
      setSubscription(sub);
      
      const end = sub.currentPeriodEnd?.toDate();
      const now = new Date();
      const active = (sub.status === 'active' || sub.status === 'trial') && end && end > now;
      
      setIsActive(!!active);
      
      if (end && end > now) {
        const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        setDaysRemaining(diffDays);
      } else {
        setDaysRemaining(0);
      }
      setLoading(false);
    } else if (user) {
      // User is logged in but has no subscription field yet 
      // This could be a new user in registration process.
      // We wait unless loading is false in Auth.
      setSubscription(null);
      setIsActive(false);
      setDaysRemaining(0);
      setLoading(authLoading);
    } else {
      // No user
      setSubscription(null);
      setIsActive(false);
      setDaysRemaining(0);
      setLoading(false);
    }
  }, [user, authLoading]);

  return { subscription, isActive, daysRemaining, isAdmin: user?.isAdmin, loading };
};
