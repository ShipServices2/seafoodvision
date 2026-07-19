'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client';

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
  supabaseConfigured: boolean;
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
  const mountedRef = useRef(false);

  // Check configuration once — never throws at module level
  const configured = isSupabaseConfigured();

  const fetchProfile = async (userId: string) => {
    if (!configured) return;
    try {
      const supabase = createClient();
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

    // If Supabase is not configured, skip auth entirely — no fake session
    if (!configured) {
      setLoading(false);
      return () => {
        mountedRef.current = false;
      };
    }

    const supabase = createClient();

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
      // Defer state updates to avoid React 19 warning about state updates
      // on components that haven't mounted yet (onAuthStateChange can fire
      // synchronously during subscription setup).
      setTimeout(() => {
        if (!mountedRef.current) return;
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }, 0);
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signUp = async (email: string, password: string, metadata: Record<string, string> = {}) => {
    if (!configured) {
      throw new Error('Authentication is not available: Supabase is not configured.');
    }

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

    const supabase = createClient();
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
    if (!configured) {
      throw new Error('Authentication is not available: Supabase is not configured.');
    }
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    if (!configured) {
      throw new Error('Authentication is not available: Supabase is not configured.');
    }
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
  };

  const getCurrentUser = async () => {
    if (!configured) {
      throw new Error('Authentication is not available: Supabase is not configured.');
    }
    const supabase = createClient();
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
    if (!configured) {
      throw new Error('Authentication is not available: Supabase is not configured.');
    }
    const supabase = createClient();
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
    supabaseConfigured: configured,
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

export default AuthContext;
