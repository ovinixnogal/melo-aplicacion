import React, { createContext, useContext, useEffect, useState } from 'react';
import { signOut, onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import { auth, db } from '../api/firebase';

/**
 * Interface for User Profile Data stored in Firestore
 */
export interface UserSubscription {
  status: 'active' | 'inactive' | 'trial';
  currentPeriodStart: Timestamp | null;
  currentPeriodEnd: Timestamp | null;
  plan: 'monthly';
  price: number;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  isAdmin: boolean;
  banned?: boolean;
  photoURL?: string;
  subscription?: UserSubscription;
  [key: string]: any; // Allow for other metadata
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  firebaseUser: User | null; // Keep original firebase user if needed
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  firebaseUser: null,
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    // 1. Auth State Listener
    const unsubscribeAuth = onAuthStateChanged(auth, (fUser) => {
      setFirebaseUser(fUser);

      // Clean up previous profile listener
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (fUser) {
        // PRE-POPULATE: Immediately give a basic profile so the app doesn't crash/hang
        // This is crucial for new registrations where the Firestore doc may take a second to exist.
        setUser({
          uid: fUser.uid,
          email: fUser.email,
          displayName: fUser.displayName,
          photoURL: fUser.photoURL || undefined,
          isAdmin: false,
          banned: false,
        });

        // 2. Real-time Profile Listener
        const userDocRef = doc(db, 'users', fUser.uid);
        
        unsubscribeProfile = onSnapshot(userDocRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            
            // SECURITY: Check for ban
            if (data.banned) {
              signOut(auth); // Sign out (async, triggered but we don't await here)
              alert('Tu cuenta ha sido restringida por seguridad.');
              setLoading(false);
              return;
            }

            // MERGE: Firestore data onto the auth user
            setUser({
              uid: fUser.uid,
              email: fUser.email,
              displayName: fUser.displayName || data.displayName || data.name,
              photoURL: fUser.photoURL || data.photoURL || undefined,
              isAdmin: data.isAdmin || false,
              banned: data.banned || false,
              subscription: data.subscription,
              ...data,
            });
          }
          // We call setLoading(false) once we get at least one snapshot back (exists or not)
          setLoading(false);
        }, (error) => {
          console.error("Profile listener error:", error);
          // If Firestore fails (e.g. permission error during registration), 
          // we at least have the pre-populated base profile from above.
          setLoading(false);
        });

      } else {
        // Logged out
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const value = {
    user,
    loading,
    firebaseUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
