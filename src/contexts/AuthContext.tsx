import React, { createContext, useContext, useEffect, useState } from 'react';
import { doc, getDocFromServer } from 'firebase/firestore';
import { db } from '../lib/firebase';
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
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, name: string) => Promise<void>;
  loginDemo: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_USER_KEY = 'inventory_pro_local_user';
const USERS_REGISTRY_KEY = 'inventory_pro_local_users_registry';

interface RegisteredUser {
  uid: string;
  email: string;
  name: string;
  passwordHash: string; // stored directly in plain text/simulation for sandbox purposes 
}

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
        console.error("Firestore connection test failed.");
        if (error instanceof Error) {
          if (error.message.includes('the client is offline') || error.message.includes('within 10 seconds')) {
            setConnectionError("Could not reach Firestore. Please check if your database instance '" + firebaseConfig.firestoreDatabaseId + "' is created and active in the Firebase Console.");
          } else if (!error.message.includes('Missing or insufficient permissions')) {
            setConnectionError(error.message);
          }
        } else {
          setConnectionError(String(error));
        }
      }
    }

    testConnection();

    // Check localStorage for active session
    try {
      const storedUser = localStorage.getItem(LOCAL_USER_KEY);
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (e) {
      console.warn("Could not reload local user session from cache: ", e);
    }
    setLoading(false);
  }, []);

  const loginWithEmail = async (email: string, password: string) => {
    try {
      const emailTrim = email.trim().toLowerCase();
      const registryString = localStorage.getItem(USERS_REGISTRY_KEY) || '[]';
      const registry: RegisteredUser[] = JSON.parse(registryString);

      const found = registry.find(u => u.email === emailTrim);
      if (!found) {
        throw new Error("No account registered with that email address. Please sign up or continue as Guest.");
      }

      if (found.passwordHash !== password) {
        throw new Error("Incorrect password. Please try again.");
      }

      const activeUser: User = {
        uid: found.uid,
        displayName: found.name,
        email: found.email,
        photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(found.name)}`,
      };

      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(activeUser));
      setUser(activeUser);
    } catch (err: any) {
      console.error("Local email login failed", err);
      throw new Error(err.message || "Failed to sign in.");
    }
  };

  const registerWithEmail = async (email: string, password: string, name: string) => {
    try {
      const emailTrim = email.trim().toLowerCase();
      if (password.length < 6) {
        throw new Error("Password should be at least 6 characters long.");
      }

      const registryString = localStorage.getItem(USERS_REGISTRY_KEY) || '[]';
      const registry: RegisteredUser[] = JSON.parse(registryString);

      const exists = registry.some(u => u.email === emailTrim);
      if (exists) {
        throw new Error("This email address is already registered on this device.");
      }

      const newUid = 'u_' + Math.random().toString(36).substr(2, 9);
      const newUserRecord: RegisteredUser = {
        uid: newUid,
        email: emailTrim,
        name: name.trim(),
        passwordHash: password
      };

      registry.push(newUserRecord);
      localStorage.setItem(USERS_REGISTRY_KEY, JSON.stringify(registry));

      const activeUser: User = {
        uid: newUid,
        displayName: newUserRecord.name,
        email: newUserRecord.email,
        photoURL: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(newUserRecord.name)}`,
      };

      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(activeUser));
      setUser(activeUser);
    } catch (err: any) {
      console.error("Local email registration failed", err);
      throw new Error(err.message || "Failed to create account.");
    }
  };

  const loginDemo = async () => {
    try {
      // Create a stable guest session tied to this browser/device, or load it
      let activeUser: User;
      const storedUser = localStorage.getItem(LOCAL_USER_KEY);
      
      if (storedUser) {
        activeUser = JSON.parse(storedUser);
      } else {
        const guestId = 'guest_' + Math.random().toString(36).substr(2, 9);
        activeUser = {
          uid: guestId,
          displayName: "Demo User",
          email: "demo@inventorypro.co",
          photoURL: "https://api.dicebear.com/7.x/initials/svg?seed=DemoUser"
        };
        localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(activeUser));
      }
      
      setUser(activeUser);
    } catch (err: any) {
      console.error("Guest login failed", err);
      throw new Error(err?.message || "Could not launch Guest Sandbox.");
    }
  };

  const logout = async () => {
    localStorage.removeItem(LOCAL_USER_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, connectionError, loginWithEmail, registerWithEmail, loginDemo, logout }}>
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

