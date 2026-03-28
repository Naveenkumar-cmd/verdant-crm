// src/context/AuthContext.js
import React, {
  createContext, useContext, useEffect, useState, useCallback, useRef,
} from 'react';
import { supabase } from '../lib/supabase';

// 15-day session wall-clock enforcement
const SESSION_MAX_AGE_MS = 15 * 24 * 60 * 60 * 1000;
const SESSION_TS_KEY     = 'verdant_session_ts';

// Safety-net: if INITIAL_SESSION hasn't resolved loading within this many ms,
// force-clear the spinner.
const LOADING_TIMEOUT_MS = 8000;

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user,         setUser]         = useState(null);
  const [profile,      setProfile]      = useState(null);
  const [organization, setOrganization] = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [loadError,    setLoadError]    = useState(null);

  const lastLoadedUserId    = useRef(null);
  const initialSessionFired = useRef(false);
  // Guard against concurrent fetchProfile calls (INITIAL_SESSION + SIGNED_IN race)
  const isFetching          = useRef(false);

  // ── Session stamp helpers ─────────────────────────────────────────────────
  const stampSession   = () => localStorage.setItem(SESSION_TS_KEY, Date.now().toString());
  const clearStamp     = () => localStorage.removeItem(SESSION_TS_KEY);
  const isStampExpired = () => {
    const ts = localStorage.getItem(SESSION_TS_KEY);
    if (!ts) return false;
    return Date.now() - parseInt(ts, 10) > SESSION_MAX_AGE_MS;
  };

  // ── Reset to logged-out state ─────────────────────────────────────────────
  const clearAuthState = useCallback(() => {
    setUser(null);
    setProfile(null);
    setOrganization(null);
    setLoadError(null);
    clearStamp();
    lastLoadedUserId.current = null;
    isFetching.current = false;
  }, []);

  // ── fetchProfile ──────────────────────────────────────────────────────────
  // GUARANTEE: always calls setLoading(false) in the finally block.
  // Uses isFetching ref to prevent concurrent calls (INITIAL_SESSION + SIGNED_IN race).
  // ─────────────────────────────────────────────────────────────────────────
  const fetchProfile = useCallback(async (userId, authUser) => {
    // Prevent concurrent fetches — Supabase often fires INITIAL_SESSION then
    // SIGNED_IN back-to-back on page load, which previously caused a double-fetch
    // race that left loading=true forever.
    if (isFetching.current) return null;
    isFetching.current = true;

    setLoading(true);
    setLoadError(null);

    try {
      let { data: profileData, error: profileErr } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileErr) throw profileErr;

      // No row yet — create a stub so the user can reach /onboarding.
      if (!profileData) {
        const meta = authUser?.user_metadata ?? {};
        const { data: inserted, error: insertErr } = await supabase
          .from('user_profiles')
          .upsert(
            {
              id:                   userId,
              email:                authUser?.email ?? '',
              first_name:           meta.first_name ?? null,
              last_name:            meta.last_name  ?? null,
              role:                 'sales_rep',
              onboarding_completed: false,
            },
            { onConflict: 'id', ignoreDuplicates: false }
          )
          .select()
          .maybeSingle();

        if (insertErr) {
          const { data: retry } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();
          profileData = retry;
        } else {
          profileData = inserted;
        }
      }

      let orgData = null;
      if (profileData?.org_id) {
        const { data: org, error: orgErr } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', profileData.org_id)
          .maybeSingle();
        if (orgErr) throw orgErr;
        orgData = org;
      }

      setProfile(profileData ?? null);
      setOrganization(orgData ?? null);
      lastLoadedUserId.current = userId;

      return profileData ?? null;

    } catch (err) {
      console.error('[AuthContext] fetchProfile error:', err);
      const isRls = err?.code === 'PGRST301'
        || err?.code === '42501'
        || String(err?.message).includes('row-level security');
      if (!isRls) setLoadError('error');
      setProfile(null);
      setOrganization(null);
      return null;
    } finally {
      isFetching.current = false;
      setLoading(false);
      initialSessionFired.current = true;
    }
  }, []);

  // ── Core auth effect ──────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    const loadingTimeout = setTimeout(() => {
      if (mounted && !initialSessionFired.current) {
        console.warn('[AuthContext] Loading timeout — forcing loading=false. Check Supabase connectivity.');
        initialSessionFired.current = true;
        isFetching.current = false;
        setLoading(false);
      }
    }, LOADING_TIMEOUT_MS);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        // ── TOKEN_REFRESHED ───────────────────────────────────────────────
        // Silent token refresh — do NOT show spinner or re-fetch.
        if (event === 'TOKEN_REFRESHED') {
          if (session?.user) setUser(session.user);
          return;
        }

        // ── PASSWORD_RECOVERY ─────────────────────────────────────────────
        if (event === 'PASSWORD_RECOVERY') {
          setUser(session?.user ?? null);
          initialSessionFired.current = true;
          isFetching.current = false;
          setLoading(false);
          return;
        }

        // ── No session (SIGNED_OUT / expired / INITIAL_SESSION with null) ──
        if (!session?.user) {
          clearAuthState();
          initialSessionFired.current = true;
          setLoading(false);
          return;
        }

        const authUser = session.user;

        // ── Enforce 15-day wall-clock limit ───────────────────────────────
        if (event === 'INITIAL_SESSION' && isStampExpired()) {
          await supabase.auth.signOut();
          return;
        }

        // ── INITIAL_SESSION: returning user (page refresh / new tab open) ─
        // Always stamp the session and fetch the profile fresh.
        if (event === 'INITIAL_SESSION') {
          stampSession();
          setUser(authUser);
          await fetchProfile(authUser.id, authUser);
          return;
        }

        // ── SIGNED_IN: fires after INITIAL_SESSION on page load too ───────
        // If INITIAL_SESSION already started or completed a fetch for this
        // user, skip the redundant fetch to avoid the double-fetch race that
        // left loading=true forever.
        if (event === 'SIGNED_IN') {
          stampSession();
          setUser(authUser);
          if (lastLoadedUserId.current === authUser.id || isFetching.current) {
            // Profile already loaded or loading — just ensure loading is cleared.
            if (!isFetching.current) {
              initialSessionFired.current = true;
              setLoading(false);
            }
            return;
          }
          // Fresh sign-in with no prior profile load.
          await fetchProfile(authUser.id, authUser);
          return;
        }

        // ── Any other event with a session ────────────────────────────────
        setUser(authUser);
        if (lastLoadedUserId.current !== authUser.id && !isFetching.current) {
          await fetchProfile(authUser.id, authUser);
        } else if (!initialSessionFired.current) {
          initialSessionFired.current = true;
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().catch(err => {
      console.error('[AuthContext] getSession error:', err);
      if (mounted) {
        initialSessionFired.current = true;
        isFetching.current = false;
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(loadingTimeout);
      subscription.unsubscribe();
    };
  }, [fetchProfile, clearAuthState]);

  // ── Visibility-change safety net ─────────────────────────────────────────
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      if (lastLoadedUserId.current !== null && !isFetching.current) {
        setLoading(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // ── Auth actions ──────────────────────────────────────────────────────────

  const signUp = useCallback(async ({ email, password, firstName, lastName }) => {
    const base = process.env.REACT_APP_URL || window.location.origin;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { first_name: firstName, last_name: lastName },
        emailRedirectTo: `${base}/auth/callback`,
      },
    });
    if (error) return { error };
    if (!data.session) return { needsVerification: true, email };
    return {};
  }, []);

  const signIn = useCallback(
    (email, password) => supabase.auth.signInWithPassword({ email, password }),
    []
  );

  const signOut = useCallback(async () => {
    lastLoadedUserId.current = null;
    isFetching.current = false;
    clearStamp();
    await supabase.auth.signOut();
  }, []);

  const resetPassword = useCallback((email) => {
    const base = process.env.REACT_APP_URL || window.location.origin;
    return supabase.auth.resetPasswordForEmail(email, { redirectTo: `${base}/auth/callback` });
  }, []);

  const updatePassword = useCallback(
    (newPassword) => supabase.auth.updateUser({ password: newPassword }),
    []
  );

  const refreshProfile = useCallback(() => {
    if (!user) return Promise.resolve(null);
    // Reset guards so a manual refresh always goes through.
    isFetching.current = false;
    lastLoadedUserId.current = null;
    return fetchProfile(user.id, user);
  }, [user, fetchProfile]);

  const retryLoad = useCallback(() => {
    if (!user) return;
    isFetching.current = false;
    lastLoadedUserId.current = null;
    return fetchProfile(user.id, user);
  }, [user, fetchProfile]);

  const isEmailVerified = user?.email_confirmed_at != null;
  const isOnboarded     = !!(profile?.onboarding_completed && profile?.org_id);

  return (
    <AuthContext.Provider value={{
      user, profile, organization, loading, loadError,
      isEmailVerified, isOnboarded,
      signUp, signIn, signOut,
      resetPassword, updatePassword,
      refreshProfile, retryLoad,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
