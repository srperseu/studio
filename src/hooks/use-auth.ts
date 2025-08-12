'use client';

import { useState, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export function useAuth() {
    const [authState, setAuthState] = useState<{
        user: User | null;
        loading: boolean;
    }>({ user: null, loading: true });

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(user => {
            setAuthState({ user, loading: false });
        });
        return () => unsubscribe();
    }, []);

    return authState;
}
