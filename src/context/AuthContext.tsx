import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Profile, UserRole, TempleMembership, FamilyProfileUpdateInput } from '../types/database';
import { isSupabaseConfigured, supabase, db } from '../lib/supabase';
import { DEV_TEST_PERSONAS, INITIAL_MEMBERSHIPS } from '../lib/devData';

export type OtpFlowStep = 'phone_input' | 'code_input' | 'profile_setup' | 'success';

interface AuthContextType {
  currentUser: Profile | null;
  currentRole: UserRole | null;
  activeTempleId: string | null;
  activeTempleName: string | null;
  memberships: TempleMembership[];
  isAuthenticated: boolean;
  isSupabaseConnected: boolean;
  isDevSandboxSession: boolean;
  smsProviderBlocked: boolean;
  smsProviderStatusMessage: string | null;
  otpStep: OtpFlowStep;
  otpLoading: boolean;
  authError: string | null;
  pendingPhone: string;
  resendCooldown: number;
  sendOtp: (phone: string) => Promise<{ success: boolean; error?: string; providerBlocked?: boolean }>;
  verifyOtp: (tokenOrPhone: string, maybeToken?: string) => Promise<{ success: boolean; error?: string; isNewUser?: boolean }>;
  signInWithPhonePassword: (
    phone: string,
    password: string,
    fullName?: string
  ) => Promise<{ success: boolean; error?: string; isNewUser?: boolean; role?: UserRole }>;
  saveProfile: (input: FamilyProfileUpdateInput) => Promise<{ success: boolean; error?: string; profile?: Profile }>;
  startDevSandboxSession: (index: number) => void;
  signOut: () => Promise<void>;
  resetOtpFlow: () => void;
  setPendingPhone: (phone: string) => void;
  setOtpStep: (step: OtpFlowStep) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // STRICT SECURITY: Default state is unauthenticated / signed-out
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole | null>(null);
  const [activeTempleId, setActiveTempleId] = useState<string | null>(null);
  const [activeTempleName, setActiveTempleName] = useState<string | null>(null);
  const [memberships, setMemberships] = useState<TempleMembership[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isDevSandboxSession, setIsDevSandboxSession] = useState<boolean>(false);
  const [isSupabaseConnected] = useState<boolean>(isSupabaseConfigured());

  // SMS Gateway state
  const [smsProviderBlocked, setSmsProviderBlocked] = useState<boolean>(false);
  const [smsProviderStatusMessage, setSmsProviderStatusMessage] = useState<string | null>(null);

  // OTP Flow state
  const [otpStep, setOtpStep] = useState<OtpFlowStep>('phone_input');
  const [pendingPhone, setPendingPhone] = useState<string>('');
  const [otpLoading, setOtpLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  const cooldownTimerRef = useRef<NodeJS.Timeout | null>(null);

  const startCooldown = useCallback((seconds: number = 60) => {
    setResendCooldown(seconds);
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    cooldownTimerRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, []);

  /**
   * Resolves user profile and staff memberships for an authenticated user session.
   * Enforces strict role boundary: Non-staff users receive ONLY 'family' role.
   */
  const resolveUserSession = useCallback(async (user: { id: string; phone?: string | null }) => {
    const verifiedPhone = user.phone || pendingPhone;

    // 1. Check for staff memberships
    let userMemberships: TempleMembership[] = [];
    try {
      const { data: memData } = await supabase
        .from('temple_memberships')
        .select('*, temple:temples(*), organization:organizations(*)')
        .eq('user_id', user.id)
        .eq('status', 'active');
      if (memData) {
        userMemberships = memData as unknown as TempleMembership[];
      }
    } catch (err) {
      console.warn('Could not query temple memberships:', err);
    }

    setMemberships(userMemberships);

    // 2. Strict Role Isolation:
    // If user has staff membership, assign staff role; otherwise assign 'family'
    if (userMemberships.length > 0) {
      const primary = userMemberships[0];
      setCurrentRole(primary.role);
      setActiveTempleId(primary.temple_id);
      setActiveTempleName(primary.temple?.name || 'All Temples (Superadmin)');
    } else {
      // Devotee family role
      setCurrentRole('family');
      setActiveTempleId('33333333-3333-3333-3333-333333333331'); // Chickpet Temple
      setActiveTempleName('Shri Adinath Bhagwan Temple, Chickpet');
    }

    // 3. Resolve profile from database
    const profileRes = await db.getProfile(user.id);
    if (profileRes.success && profileRes.data) {
      setCurrentUser(profileRes.data);
      setIsAuthenticated(true);
      setIsDevSandboxSession(false);
      setOtpStep('success');
    } else {
      // First-time family registration: anchor profile with verified phone from session
      const draftProfile: Profile = {
        id: user.id,
        full_name: '',
        verified_mobile: verifiedPhone,
        locality: '',
        city: 'Bengaluru',
        state: 'Karnataka',
        country: 'India',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setCurrentUser(draftProfile);
      setIsAuthenticated(true);
      setIsDevSandboxSession(false);
      setOtpStep('profile_setup');
    }
  }, [pendingPhone]);

  // Check Supabase session on mount if remote configured
  useEffect(() => {
    if (isSupabaseConfigured()) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          resolveUserSession(session.user);
        }
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          resolveUserSession(session.user);
        } else if (event === 'SIGNED_OUT') {
          setCurrentUser(null);
          setCurrentRole(null);
          setActiveTempleId(null);
          setActiveTempleName(null);
          setMemberships([]);
          setIsAuthenticated(false);
          setIsDevSandboxSession(false);
          setOtpStep('phone_input');
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [resolveUserSession]);

  /**
   * Request an OTP through Supabase Auth phone authentication.
   * Formats to strict E.164 and handles provider configuration errors transparently.
   */
  const sendOtp = async (
    phone: string
  ): Promise<{ success: boolean; error?: string; providerBlocked?: boolean }> => {
    setOtpLoading(true);
    setAuthError(null);

    // Format validation (E.164 standard, e.g. +91 98450 12345)
    const cleaned = phone.replace(/[\s\-()]/g, '');
    if (!/^\+[1-9]\d{7,14}$/.test(cleaned)) {
      const err = 'Please enter a valid mobile number with country code (e.g. +91 98450 12345).';
      setAuthError(err);
      setOtpLoading(false);
      return { success: false, error: err };
    }

    setPendingPhone(cleaned);

    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase.auth.signInWithOtp({
          phone: cleaned,
        });

        if (error) {
          const errMsg = error.message || '';
          const errCode = (error as { code?: string }).code || '';

          const isProviderDisabled =
            errCode === 'phone_provider_disabled' ||
            errMsg.toLowerCase().includes('unsupported phone provider') ||
            errMsg.toLowerCase().includes('provider disabled');

          if (isProviderDisabled) {
            const blockedNotice =
              'Live SMS delivery is currently blocked: The Supabase Phone Auth provider is disabled in this project. Please configure an SMS provider (Twilio, MessageBird, or Vonage) in your Supabase Dashboard under Authentication -> Providers -> Phone.';
            setSmsProviderBlocked(true);
            setSmsProviderStatusMessage(blockedNotice);
            setAuthError(blockedNotice);
            setOtpLoading(false);
            return { success: false, error: blockedNotice, providerBlocked: true };
          }

          const isRateLimit =
            error.status === 429 ||
            errMsg.toLowerCase().includes('rate limit') ||
            errMsg.toLowerCase().includes('too many requests') ||
            errMsg.toLowerCase().includes('security purposes');

          const userFriendlyError = isRateLimit
            ? 'Rate limit reached: Please wait 60 seconds before requesting another SMS OTP.'
            : errMsg || 'Failed to dispatch verification code.';

          setAuthError(userFriendlyError);
          setOtpLoading(false);
          return { success: false, error: userFriendlyError };
        }

        // Live SMS dispatch initiated successfully
        setOtpStep('code_input');
        startCooldown(60);
        setOtpLoading(false);
        return { success: true };
      } else {
        const unconfiguredNotice =
          'Live SMS delivery is unconfigured: Remote Supabase URL is not present. Real server OTP verification requires active Supabase credentials with SMS credits.';
        setSmsProviderBlocked(true);
        setAuthError(unconfiguredNotice);
        setOtpLoading(false);
        return { success: false, error: unconfiguredNotice, providerBlocked: true };
      }
    } catch (err: unknown) {
      const message = (err as Error).message || 'Failed to request OTP code.';
      setAuthError(message);
      setOtpLoading(false);
      return { success: false, error: message };
    }
  };

  /**
   * Verify the 6-digit OTP code against Supabase Auth.
   * Does NOT simulate OTP or create sessions without genuine server verification.
   * Supports both verifyOtp(token) and verifyOtp(phone, token).
   */
  const verifyOtp = async (
    tokenOrPhone: string,
    maybeToken?: string
  ): Promise<{ success: boolean; error?: string; isNewUser?: boolean }> => {
    setOtpLoading(true);
    setAuthError(null);

    const targetPhone = maybeToken ? tokenOrPhone.replace(/[\s\-()]/g, '') : pendingPhone;
    const cleanToken = (maybeToken ? maybeToken : tokenOrPhone).trim();

    if (!/^\d{6}$/.test(cleanToken)) {
      const err = 'Please enter the complete 6-digit numeric verification code.';
      setAuthError(err);
      setOtpLoading(false);
      return { success: false, error: err };
    }

    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase.auth.verifyOtp({
          phone: targetPhone,
          token: cleanToken,
          type: 'sms',
        });

        if (error) {
          const errMsg = error.message || '';
          const isExpired = errMsg.toLowerCase().includes('expired');
          const userFriendlyError = isExpired
            ? 'This verification code has expired. Please request a new OTP.'
            : errMsg || 'Invalid verification code. Please check the code and try again.';
          setAuthError(userFriendlyError);
          setOtpLoading(false);
          return { success: false, error: userFriendlyError };
        }

        if (data.user) {
          await resolveUserSession(data.user);
          const profileRes = await db.getProfile(data.user.id);
          const isNew = !profileRes.data || !profileRes.data.full_name || profileRes.data.full_name.trim().length === 0;
          if (isNew) {
            setOtpStep('profile_setup');
          } else {
            setOtpStep('success');
          }
          setOtpLoading(false);
          return { success: true, isNewUser: isNew };
        }

        setOtpLoading(false);
        return { success: true };
      } else {
        const err = 'Cannot verify OTP: Supabase is not configured with live SMS service.';
        setAuthError(err);
        setOtpLoading(false);
        return { success: false, error: err };
      }
    } catch (err: unknown) {
      const message = (err as Error).message || 'OTP verification failed.';
      setAuthError(message);
      setOtpLoading(false);
      return { success: false, error: message };
    }
  };

  /**
   * Saves or updates family profile details.
   * Derives verified_mobile strictly from the authenticated session (immutable).
   */
  const saveProfile = async (
    input: FamilyProfileUpdateInput
  ): Promise<{ success: boolean; error?: string; profile?: Profile }> => {
    if (!currentUser) {
      return { success: false, error: 'Authentication required to save family profile.' };
    }

    if (!input.full_name || input.full_name.trim().length < 2) {
      return { success: false, error: 'Please enter a valid full name for the devotee / family head.' };
    }

    setOtpLoading(true);

    try {
      // Derive verified_mobile strictly from current authenticated session
      let verifiedPhone = currentUser.verified_mobile;
      if (isSupabaseConfigured()) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.phone) {
          verifiedPhone = session.user.phone;
        }
      }

      const res = await db.upsertFamilyProfile(currentUser.id, verifiedPhone, input);
      if (res.success && res.data) {
        setCurrentUser(res.data);
        setOtpStep('success');
        setOtpLoading(false);
        return { success: true, profile: res.data };
      } else {
        setOtpLoading(false);
        return { success: false, error: res.error || 'Failed to save family profile.' };
      }
    } catch (err: unknown) {
      setOtpLoading(false);
      return { success: false, error: (err as Error).message || 'Profile save failed.' };
    }
  };

  /**
   * Mobile number and password authentication (with single-screen auto-registration).
   * Direct native Supabase phone + password auth.
   */
  const signInWithPhonePassword = async (
    phone: string,
    password: string,
    fullName?: string
  ): Promise<{ success: boolean; error?: string; isNewUser?: boolean; role?: UserRole }> => {
    setOtpLoading(true);
    setAuthError(null);

    const cleaned = phone.replace(/[\s\-()]/g, '');
    if (!/^\+[1-9]\d{7,14}$/.test(cleaned)) {
      const err = 'Please enter a valid mobile number with country code (e.g. +91 98450 12345).';
      setAuthError(err);
      setOtpLoading(false);
      return { success: false, error: err };
    }

    if (!password || password.length < 6) {
      const err = 'Password must be at least 6 characters.';
      setAuthError(err);
      setOtpLoading(false);
      return { success: false, error: err };
    }

    setPendingPhone(cleaned);

    try {
      const result = await db.signInWithPhonePassword(cleaned, password, fullName);

      if (!result.success || !result.user) {
        const err = result.error || 'Authentication failed. Please verify credentials.';
        setAuthError(err);
        setOtpLoading(false);
        return { success: false, error: err };
      }

      setCurrentUser(result.user);
      setCurrentRole(result.role || 'family');
      setActiveTempleId(
        result.templeId || (result.role === 'family' ? '33333333-3333-3333-3333-333333333331' : null)
      );
      setActiveTempleName(
        result.role === 'family'
          ? 'Shri Adinath Bhagwan Temple, Chickpet'
          : result.role === 'superadmin'
          ? 'All Temples (Superadmin)'
          : 'Chickpet Temple'
      );
      setIsAuthenticated(true);
      setIsDevSandboxSession(!isSupabaseConfigured());
      setOtpStep('success');
      setOtpLoading(false);

      return {
        success: true,
        isNewUser: result.isNewUser,
        role: result.role || 'family',
      };
    } catch (err: unknown) {
      const msg = (err as Error).message || 'An unexpected error occurred during sign-in.';
      setAuthError(msg);
      setOtpLoading(false);
      return { success: false, error: msg };
    }
  };

  /**
   * Dedicated Development Sandbox Session for Multi-Tenant Testing
   * Explicitly labeled as a local simulation rather than a verified OTP session.
   * Hardened to disallow execution in production builds.
   */
  const startDevSandboxSession = (index: number) => {
    if (import.meta.env.PROD) {
      console.warn('Sandbox sessions are disabled in production builds.');
      return;
    }
    const persona = DEV_TEST_PERSONAS[index];
    if (persona) {
      setCurrentUser(persona.profile);
      setCurrentRole(persona.role);
      setActiveTempleId(persona.templeId);
      setActiveTempleName(persona.templeName);
      setMemberships(persona.role === 'family' ? [] : INITIAL_MEMBERSHIPS);
      setIsAuthenticated(true);
      setIsDevSandboxSession(true);
      setOtpStep('success');
      setAuthError(null);
    }
  };

  const signOut = async () => {
    if (isSupabaseConfigured()) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Sign out warning:', err);
      }
    }
    setCurrentUser(null);
    setCurrentRole(null);
    setActiveTempleId(null);
    setActiveTempleName(null);
    setMemberships([]);
    setIsAuthenticated(false);
    setIsDevSandboxSession(false);
    setPendingPhone('');
    setOtpStep('phone_input');
    setAuthError(null);
    setSmsProviderBlocked(false);
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    setResendCooldown(0);
  };

  const resetOtpFlow = () => {
    setOtpStep('phone_input');
    setAuthError(null);
    setOtpLoading(false);
    setPendingPhone('');
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentRole,
        activeTempleId,
        activeTempleName,
        memberships,
        isAuthenticated,
        isSupabaseConnected,
        isDevSandboxSession,
        smsProviderBlocked,
        smsProviderStatusMessage,
        otpStep,
        otpLoading,
        authError,
        pendingPhone,
        resendCooldown,
        sendOtp,
        verifyOtp,
        signInWithPhonePassword,
        saveProfile,
        startDevSandboxSession,
        signOut,
        resetOtpFlow,
        setPendingPhone,
        setOtpStep,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
