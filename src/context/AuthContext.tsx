import React, { createContext, useContext, useState, useEffect } from 'react';
import { Profile, UserRole, TempleMembership } from '../types/database';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { DEV_TEST_PERSONAS, INITIAL_MEMBERSHIPS, INITIAL_TEMPLES } from '../lib/devData';

interface AuthContextType {
  currentUser: Profile | null;
  currentRole: UserRole | null;
  activeTempleId: string | null;
  activeTempleName: string | null;
  memberships: TempleMembership[];
  isAuthenticated: boolean;
  isSupabaseConnected: boolean;
  isDevSandboxSession: boolean;
  otpStep: 'phone_input' | 'code_input' | 'success';
  otpLoading: boolean;
  authError: string | null;
  sendOtp: (phone: string) => Promise<boolean>;
  verifyOtp: (phone: string, token: string) => Promise<boolean>;
  startDevSandboxSession: (index: number) => void;
  signOut: () => Promise<void>;
  resetOtpFlow: () => void;
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

  // OTP Flow state
  const [otpStep, setOtpStep] = useState<'phone_input' | 'code_input' | 'success'>('phone_input');
  const [otpLoading, setOtpLoading] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Check Supabase session on mount if remote configured
  useEffect(() => {
    if (isSupabaseConfigured()) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          // Resolve profile
          supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()
            .then(({ data: profileData }) => {
              if (profileData) {
                setCurrentUser(profileData as Profile);
                setIsAuthenticated(true);
                // Load memberships
                supabase
                  .from('temple_memberships')
                  .select('*, temple:temples(*)')
                  .eq('user_id', session.user.id)
                  .then(({ data: memData }) => {
                    if (memData && memData.length > 0) {
                      setMemberships(memData as unknown as TempleMembership[]);
                      const primary = memData[0];
                      setCurrentRole(primary.role);
                      setActiveTempleId(primary.temple_id);
                      setActiveTempleName(primary.temple?.name || 'All Temples (Superadmin)');
                    }
                  });
              }
            });
        }
      });
    }
  }, []);

  const sendOtp = async (phone: string): Promise<boolean> => {
    setOtpLoading(true);
    setAuthError(null);

    // Format validation (E.164 standard, e.g. +91 98450 12345)
    const cleaned = phone.replace(/\s+/g, '');
    if (!cleaned.startsWith('+') || cleaned.length < 10) {
      setAuthError('Please enter a valid mobile number with country code (e.g. +91 98450 12345).');
      setOtpLoading(false);
      return false;
    }

    try {
      if (isSupabaseConfigured()) {
        const { error } = await supabase.auth.signInWithOtp({
          phone: cleaned,
        });
        if (error) throw error;
        setOtpStep('code_input');
        setOtpLoading(false);
        return true;
      } else {
        // Honest limitation reporting: Do NOT fake or simulate SMS OTP dispatch
        setAuthError(
          'Mobile OTP is prepared in architecture (Supabase Auth signInWithOtp), but live SMS gateway is unconfigured in this environment. To test, configure VITE_SUPABASE_URL and connect an SMS provider (Twilio or MessageBird) in Supabase, or launch a Local Sandbox Session below.'
        );
        setOtpLoading(false);
        return false;
      }
    } catch (err: unknown) {
      setAuthError((err as Error).message || 'Failed to send OTP code.');
      setOtpLoading(false);
      return false;
    }
  };

  const verifyOtp = async (phone: string, token: string): Promise<boolean> => {
    setOtpLoading(true);
    setAuthError(null);

    try {
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase.auth.verifyOtp({
          phone,
          token,
          type: 'sms',
        });
        if (error) throw error;
        if (data.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();
          if (profile) setCurrentUser(profile as Profile);
          setIsAuthenticated(true);
          setIsDevSandboxSession(false);
          setOtpStep('success');
        }
        setOtpLoading(false);
        return true;
      } else {
        // Honest limitation reporting: Do NOT simulate successful OTP verification
        setAuthError(
          'Cannot verify OTP: Live Supabase SMS authentication is not configured. Real verification requires active Supabase credentials with SMS credits.'
        );
        setOtpLoading(false);
        return false;
      }
    } catch (err: unknown) {
      setAuthError((err as Error).message || 'OTP verification failed.');
      setOtpLoading(false);
      return false;
    }
  };

  /**
   * Dedicated Development Sandbox Session for Multi-Tenant Testing
   * Explicitly labeled as a local simulation rather than a verified OTP session.
   */
  const startDevSandboxSession = (index: number) => {
    const persona = DEV_TEST_PERSONAS[index];
    if (persona) {
      setCurrentUser(persona.profile);
      setCurrentRole(persona.role);
      setActiveTempleId(persona.templeId);
      setActiveTempleName(persona.templeName);
      setMemberships(INITIAL_MEMBERSHIPS);
      setIsAuthenticated(true);
      setIsDevSandboxSession(true);
      setOtpStep('phone_input');
      setAuthError(null);
    }
  };

  const signOut = async () => {
    if (isSupabaseConfigured()) {
      await supabase.auth.signOut();
    }
    setCurrentUser(null);
    setCurrentRole(null);
    setActiveTempleId(null);
    setActiveTempleName(null);
    setMemberships([]);
    setIsAuthenticated(false);
    setIsDevSandboxSession(false);
    setOtpStep('phone_input');
    setAuthError(null);
  };

  const resetOtpFlow = () => {
    setOtpStep('phone_input');
    setAuthError(null);
    setOtpLoading(false);
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
        otpStep,
        otpLoading,
        authError,
        sendOtp,
        verifyOtp,
        startDevSandboxSession,
        signOut,
        resetOtpFlow,
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
