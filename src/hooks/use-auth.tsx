'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode
} from 'react';
import {
  onAuthStateChanged,
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  sendEmailVerification,
  updateProfile
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<any>;
  signUpBarberWithEmail: (email: string, password: string, fullName: string, phone: string) => Promise<any>;
  signUpClientWithEmail: (email: string, password: string, fullName: string, phone: string) => Promise<any>;
  signInWithGoogle: () => Promise<any>;
  signOut: () => Promise<void>;
  sendVerificationEmail: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithEmail: async () => {},
  signUpBarberWithEmail: async () => {},
  signUpClientWithEmail: async () => {},
  signInWithGoogle: async () => {},
  signOut: async () => {},
  sendVerificationEmail: async () => {},
});

export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithEmail = (email: string, password: string) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const signUpBarberWithEmail = async (email: string, password: string, fullName: string, phone: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    await updateProfile(user, { displayName: fullName });
    await sendEmailVerification(user);
    await setDoc(doc(db, 'barbers', user.uid), {
      uid: user.uid,
      fullName: fullName,
      email: user.email,
      phone: phone,
      profileComplete: false,
    });
    return userCredential;
  };
  
  const signUpClientWithEmail = async (email: string, password: string, fullName: string, phone: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    await updateProfile(user, { displayName: fullName });
    await sendEmailVerification(user);
    await setDoc(doc(db, 'clients', user.uid), {
      uid: user.uid,
      fullName: fullName,
      email: user.email,
      phone: phone,
      profileComplete: false,
    });
    return userCredential;
  };
  
  const signInWithGoogle = () => {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
  };

  const signOut = () => {
    return firebaseSignOut(auth);
  };
  
  const sendVerificationEmail = async () => {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    } else {
      throw new Error("Nenhum usuário logado para enviar e-mail de verificação.");
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    signInWithEmail,
    signUpBarberWithEmail,
    signUpClientWithEmail,
    signInWithGoogle,
    signOut,
    sendVerificationEmail,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
