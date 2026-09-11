import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile as updateFirebaseProfile,
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDocFromServer } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import firebaseConfig from '../../firebase-applet-config.json';

export interface User {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  connectionError: string | null;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
        setConnectionError(null);
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        } else {
          console.warn("Firestore connection check notice:", error);
        }
        // Do not block UI or prevent app operation; Firestore manages offline caching and automatic reconnects
        setConnectionError(null);
      }
    }

    testConnection();

    // Listen to real-time Firebase Auth state
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
          email: firebaseUser.email,
          photoURL: firebaseUser.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(firebaseUser.displayName || firebaseUser.email || 'User')}`,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    }, (error) => {
      console.error("Firebase auth state listener error:", error);
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, []);

  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error("Google sign-in failed:", err);
      throw new Error(err?.message || "Google authentication failed.");
    }
  };

  const loginWithEmail = async (email: string, password: string) => {
    try {
      const emailTrim = email.trim().toLowerCase();
      await signInWithEmailAndPassword(auth, emailTrim, password);
    } catch (err: any) {
      console.error("Firebase email login failed:", err);
      let message = "Failed to sign in.";
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        message = "Invalid email or password. Please verify your credentials.";
      } else if (err.code === 'auth/invalid-email') {
        message = "Please enter a valid email address.";
      } else if (err.code === 'auth/too-many-requests') {
        message = "Too many failed attempts. Please try again later or sign in with Google.";
      } else if (err.message) {
        message = err.message;
      }
      throw new Error(message);
    }
  };

  const registerWithEmail = async (email: string, password: string, name: string) => {
    try {
      const emailTrim = email.trim().toLowerCase();
      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters long.");
      }

      const credential = await createUserWithEmailAndPassword(auth, emailTrim, password);
      if (name && credential.user) {
        await updateFirebaseProfile(credential.user, { displayName: name.trim() });
      }
    } catch (err: any) {
      console.error("Firebase registration failed:", err);
      let message = "Failed to create account.";
      if (err.code === 'auth/email-already-in-use') {
        message = "An account with this email address already exists. Please sign in instead.";
      } else if (err.code === 'auth/weak-password') {
        message = "Password is too weak. Please use at least 6 characters.";
      } else if (err.code === 'auth/invalid-email') {
        message = "Please provide a valid email address.";
      } else if (err.message) {
        message = err.message;
      }
      throw new Error(message);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (err) {
      console.error("Firebase logout error:", err);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      connectionError, 
      loginWithGoogle,
      loginWithEmail, 
      registerWithEmail, 
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}


