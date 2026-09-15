import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { 
  onAuthStateChanged, 
  signInAnonymously,
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  linkWithPopup,
  linkWithCredential,
  EmailAuthProvider,
  updateProfile as updateFirebaseProfile,
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDocFromServer, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import firebaseConfig from '../../firebase-applet-config.json';

export interface User {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  isAnonymous?: boolean;
  isDemo?: boolean;
  accountType?: 'demo' | 'standard';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isDemo: boolean;
  authError: string | null;
  connectionError: string | null;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, name: string) => Promise<void>;
  linkWithGoogle: () => Promise<void>;
  linkWithEmail: (email: string, password: string, name: string) => Promise<void>;
  retryAnonymousAuth: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const GUEST_STORAGE_KEY = 'aquivo_guest_workspace_id';

function getOrCreateGuestId(): string {
  try {
    let id = localStorage.getItem(GUEST_STORAGE_KEY);
    if (!id || !id.startsWith('demo_')) {
      id = `demo_${Math.random().toString(36).substring(2, 10)}`;
      localStorage.setItem(GUEST_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return 'demo_workspace';
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const isSigningInRef = useRef(false);

  const initAnonymousSession = useCallback(async () => {
    if (isSigningInRef.current) return;
    isSigningInRef.current = true;
    setAuthError(null);
    try {
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }
    } catch (err: any) {
      console.warn("Firebase Anonymous Auth not permitted or admin-restricted. Switching to seamless guest demo mode:", err?.code || err?.message);
      // Seamlessly fall back to client-managed guest session so visitor is never blocked or shown an error
      const guestId = getOrCreateGuestId();
      setUser({
        uid: guestId,
        displayName: 'Demo Guest',
        email: 'guest@aquivo.demo',
        photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${guestId}`,
        isAnonymous: true,
        isDemo: true,
        accountType: 'demo',
      });
      setAuthError(null);
      setLoading(false);
    } finally {
      isSigningInRef.current = false;
    }
  }, []);

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
        const isAnon = firebaseUser.isAnonymous;
        setUser({
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || (isAnon ? 'Demo Guest' : (firebaseUser.email?.split('@')[0] || 'User')),
          email: firebaseUser.email,
          photoURL: firebaseUser.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(firebaseUser.displayName || (isAnon ? 'Demo Guest' : firebaseUser.email) || 'User')}`,
          isAnonymous: isAnon,
          isDemo: isAnon,
          accountType: isAnon ? 'demo' : 'standard',
        });
        setAuthError(null);
        setLoading(false);
      } else {
        setUser(null);
        // Automatically sign in anonymously when no user is logged in
        initAnonymousSession();
      }
    }, (error) => {
      console.error("Firebase auth state listener error:", error);
      setAuthError("Authentication service encountered an error.");
      setLoading(false);
    });

    return () => unsubscribeAuth();
  }, [initAnonymousSession]);

  const retryAnonymousAuth = () => {
    setLoading(true);
    initAnonymousSession();
  };

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
      if (err.code === 'auth/operation-not-allowed' || err.code === 'auth/admin-restricted-operation') {
        message = "Email/password sign-in is not enabled on this project. Please sign in with Google.";
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
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
      if (err.code === 'auth/operation-not-allowed' || err.code === 'auth/admin-restricted-operation') {
        message = "Email/password registration is not enabled on this project. Please continue with Google Sign-In.";
      } else if (err.code === 'auth/email-already-in-use') {
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

  // Convert anonymous / guest demo account to permanent Google account
  const linkWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      let resultUser: FirebaseUser | null = null;
      if (auth.currentUser && auth.currentUser.isAnonymous) {
        try {
          const result = await linkWithPopup(auth.currentUser, provider);
          resultUser = result.user;
        } catch (linkErr: any) {
          if (linkErr.code === 'auth/credential-already-in-use') {
            // Already registered Google account: sign in directly
            const directResult = await signInWithPopup(auth, provider);
            resultUser = directResult.user;
          } else {
            throw linkErr;
          }
        }
      } else {
        const directResult = await signInWithPopup(auth, provider);
        resultUser = directResult.user;
      }

      // Update Firestore user document to standard account
      if (resultUser) {
        await setDoc(doc(db, 'users', resultUser.uid), {
          accountType: 'standard',
          isDemo: false,
          email: resultUser.email,
          name: resultUser.displayName || resultUser.email?.split('@')[0] || 'User'
        }, { merge: true });

        await setDoc(doc(db, 'companies', resultUser.uid), {
          isDemo: false,
          accountType: 'standard'
        }, { merge: true });
      }
    } catch (err: any) {
      console.error("Account linking with Google failed:", err);
      throw new Error(err?.message || "Failed to link Google account.");
    }
  };

  // Convert anonymous / guest demo account to permanent Email/Password account
  const linkWithEmail = async (email: string, password: string, name: string) => {
    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters long.");
    }
    const credential = EmailAuthProvider.credential(email.trim().toLowerCase(), password);
    try {
      let resultUser: FirebaseUser | null = null;
      if (auth.currentUser && auth.currentUser.isAnonymous) {
        const result = await linkWithCredential(auth.currentUser, credential);
        resultUser = result.user;
      } else {
        const result = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
        resultUser = result.user;
      }

      if (resultUser) {
        if (name.trim()) {
          await updateFirebaseProfile(resultUser, { displayName: name.trim() });
        }
        await setDoc(doc(db, 'users', resultUser.uid), {
          accountType: 'standard',
          isDemo: false,
          email: resultUser.email,
          name: name.trim() || resultUser.email?.split('@')[0] || 'User'
        }, { merge: true });

        await setDoc(doc(db, 'companies', resultUser.uid), {
          isDemo: false,
          accountType: 'standard',
          name: `${name.trim() || 'My'} Business Workspace`
        }, { merge: true });
      }
    } catch (err: any) {
      console.error("Account linking with email failed:", err);
      if (err.code === 'auth/operation-not-allowed' || err.code === 'auth/admin-restricted-operation') {
        throw new Error("Email/password registration is not enabled on this project. Please click 'Continue with Google'.");
      } else if (err.code === 'auth/email-already-in-use' || err.code === 'auth/credential-already-in-use') {
        throw new Error("An account with this email address already exists. Please sign in instead.");
      }
      throw new Error(err?.message || "Failed to create permanent account.");
    }
  };

  const logout = async () => {
    try {
      if (auth.currentUser) {
        await signOut(auth);
      }
      localStorage.removeItem(GUEST_STORAGE_KEY);
      setUser(null);
      // Re-initialize a fresh demo session so visitor can continue exploring
      initAnonymousSession();
    } catch (err) {
      console.error("Firebase logout error:", err);
    }
  };

  const isDemo = Boolean(user?.isDemo || user?.isAnonymous);

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      isDemo,
      authError,
      connectionError, 
      loginWithGoogle,
      loginWithEmail, 
      registerWithEmail,
      linkWithGoogle,
      linkWithEmail,
      retryAnonymousAuth,
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


