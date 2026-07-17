'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface UserProfile {
  id: string;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
  company: string | null;
  country: string | null;
  role: 'visitor' | 'member' | 'customer' | 'reviewer' | 'administrator' | 'super_admin';
  terms_accepted_at: string | null;
  email_verified: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: any;
  session: any;
  profile: UserProfile | null;
  loading: boolean;
  signUp: (email: string, password: string, metadata?: Record<string, string>) => Promise<any>;
  signIn: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
  getCurrentUser: () => Promise<any>;
  isEmailVerified: () => boolean;
  getUserProfile: () => Promise<UserProfile | null>;
  isAdmin: () => boolean;
  isSuperAdmin: () => boolean;
  isReviewerOrAbove: () => boolean;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();
  const mountedRef = useRef(false);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      if (!error && data && mountedRef.current) {
        setProfile(data as UserProfile);
      }
    } catch {
      // Profile may not exist yet
    }
  };

  useEffect(() => {
    mountedRef.current = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mountedRef.current) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mountedRef.current) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, metadata: Record<string, string> = {}) => {
    // Build emailRedirectTo preserving any checkout intent from the current URL
    let callbackUrl = `${window.location.origin}/auth/callback`;
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      const plan = sp.get('plan');
      const cycle = sp.get('cycle');
      const checkoutIntent = sp.get('checkout_intent');
      const returnTo = sp.get('return_to');
      const callbackParams = new URLSearchParams();
      if (checkoutIntent) callbackParams.set('checkout_intent', checkoutIntent);
      if (plan) callbackParams.set('plan', plan);
      if (cycle) callbackParams.set('cycle', cycle);
      if (returnTo) callbackParams.set('next', returnTo);
      const qs = callbackParams.toString();
      if (qs) callbackUrl += `?${qs}`;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: metadata?.fullName || '',
          avatar_url: metadata?.avatarUrl || '',
        },
        emailRedirectTo: callbackUrl,
      },
    });
    if (error) throw error;
    return data;
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
  };

  const getCurrentUser = async () => {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  };

  const isEmailVerified = () => {
    return user?.email_confirmed_at !== null;
  };

  const getUserProfile = async (): Promise<UserProfile | null> => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (error) throw error;
    return data as UserProfile;
  };

  const isAdmin = () => {
    return profile?.role === 'administrator' || profile?.role === 'super_admin';
  };

  const isSuperAdmin = () => {
    return profile?.role === 'super_admin';
  };

  const isReviewerOrAbove = () => {
    return ['reviewer', 'administrator', 'super_admin'].includes(profile?.role || '');
  };

  const value: AuthContextType = {
    user,
    session,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    getCurrentUser,
    isEmailVerified,
    getUserProfile,
    isAdmin,
    isSuperAdmin,
    isReviewerOrAbove,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
