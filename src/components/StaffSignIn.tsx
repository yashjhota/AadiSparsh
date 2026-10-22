import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { DEV_TEST_PERSONAS } from '../lib/devData';
import { Smartphone, Lock, Eye, EyeOff, ShieldAlert, CheckCircle2, ArrowRight, AlertCircle, ShieldCheck } from 'lucide-react';

interface StaffSignInProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const StaffSignIn: React.FC<StaffSignInProps> = ({ onSuccess, onCancel }) => {
  const {
    signInWithPhonePassword,
    otpLoading,
    authError,
    currentRole,
    currentUser,
    isSupabaseConnected,
  } = useAuth();

  const [mobileNumber, setMobileNumber] = useState<string>('+919845012345');
  const [password, setPassword] = useState<string>('AadiSparsh@2026');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const res = await signInWithPhonePassword(mobileNumber, password);
    if (res.success) {
      if (res.role === 'family') {
        setLocalError(
          'This account has Devotee Family status and does not hold an active administrative role for temple governance. Please use a designated staff account.'
        );
      } else {
        setTimeout(() => {
          onSuccess();
        }, 500);
      }
    } else {
      setLocalError(res.error || 'Failed to sign in. Please verify mobile number and password.');
    }
  };

  const handleFillTestPersona = (phone: string, personaName: string) => {
    setMobileNumber(phone);
    setPassword('AadiSparsh@2026');
    setLocalError(null);
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-12 space-y-8">
      {/* Sign-In Card */}
      <div className="bg-white border border-stone-200 rounded-lg p-8 sm:p-10 shadow-xs space-y-6">
        <div>
          <div className="flex items-center justify-between text-xs">
            <span className="uppercase tracking-widest text-amber-800 font-medium font-sans">
              Staff Portal
            </span>
            <span
              className={`font-mono text-[11px] px-2 py-0.5 rounded ${
                isSupabaseConnected
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-stone-50 text-stone-700 border border-stone-200'
              }`}
            >
              {isSupabaseConnected ? 'Live Supabase Connected' : 'Local Sandbox Mode'}
            </span>
          </div>

          <h2 className="font-serif text-2xl sm:text-3xl text-stone-900 font-medium mt-1">
            Staff & Administrator Sign In
          </h2>
          <p className="text-stone-500 text-xs sm:text-sm mt-1.5 leading-relaxed">
            Enter your authorized mobile number and password to access the Temple Governance console.
          </p>
        </div>

        {/* Error / Notice notification */}
        {(localError || authError) && (
          <div className="p-3.5 bg-amber-50/80 border border-amber-200 text-amber-900 text-xs rounded flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-700 mt-0.5" />
            <div className="leading-relaxed">{localError || authError}</div>
          </div>
        )}

        {/* Mobile & Password Input Form */}
        <form onSubmit={handleSignIn} className="space-y-4">
          <div>
            <label htmlFor="staff-mobile-input" className="block text-xs font-medium text-stone-700 mb-1.5">
              Mobile Number (with country code)
            </label>
            <div className="relative">
              <Smartphone className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
              <input
                id="staff-mobile-input"
                type="tel"
                required
                placeholder="+91 98450 12345"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-amber-800 focus:border-amber-800 transition-colors font-mono"
              />
            </div>
            <p className="text-[11px] text-stone-500 mt-1.5">
              Format: E.164 standard (e.g. +91 98450 12345).
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="staff-password-input" className="block text-xs font-medium text-stone-700">
                Password
              </label>
              <span className="text-[11px] text-stone-400">Min 6 characters</span>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
              <input
                id="staff-password-input"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Enter account password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-10 py-2 text-sm bg-stone-50 border border-stone-300 rounded focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-amber-800 focus:border-amber-800 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 p-1 text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={otpLoading}
              className="flex-1 py-2.5 px-4 text-xs font-medium text-white bg-amber-800 hover:bg-amber-900 rounded transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {otpLoading ? 'Authenticating...' : 'Sign In to Console'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="py-2.5 px-4 text-xs font-medium text-stone-600 hover:text-stone-900 border border-stone-200 rounded transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>

        {/* Development Authorized Accounts Helper */}
        {import.meta.env.DEV && (
          <div className="pt-4 border-t border-stone-200 space-y-3">
            <div className="flex items-center justify-between text-xs text-stone-600">
              <span className="font-semibold text-stone-800">Authorized Test Accounts (DEV Mode)</span>
              <span className="text-[11px] text-stone-400 font-mono">Pw: AadiSparsh@2026</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleFillTestPersona('+919845012345', 'Shrenikbhai J. Shah')}
                className="p-2.5 text-left border border-stone-200 rounded hover:border-amber-700 hover:bg-amber-50/40 transition-all text-xs space-y-1 cursor-pointer"
              >
                <div className="font-medium text-stone-900">Shrenikbhai Shah</div>
                <div className="text-[11px] text-amber-800 font-mono">+91 98450 12345</div>
                <div className="text-[10px] text-stone-500">Superadmin</div>
              </button>

              <button
                type="button"
                onClick={() => handleFillTestPersona('+919845067890', 'Mahendrakumar Mehta')}
                className="p-2.5 text-left border border-stone-200 rounded hover:border-amber-700 hover:bg-amber-50/40 transition-all text-xs space-y-1 cursor-pointer"
              >
                <div className="font-medium text-stone-900">Mahendrakumar</div>
                <div className="text-[11px] text-amber-800 font-mono">+91 98450 67890</div>
                <div className="text-[10px] text-stone-500">Chickpet Admin</div>
              </button>

              <button
                type="button"
                onClick={() => handleFillTestPersona('+919845099999', 'Pravinbhai Solanki')}
                className="p-2.5 text-left border border-stone-200 rounded hover:border-amber-700 hover:bg-amber-50/40 transition-all text-xs space-y-1 cursor-pointer"
              >
                <div className="font-medium text-stone-900">Pravinbhai Solanki</div>
                <div className="text-[11px] text-amber-800 font-mono">+91 98450 99999</div>
                <div className="text-[10px] text-stone-500">Chickpet Manager</div>
              </button>
            </div>
          </div>
        )}

        {/* Security Architecture Note */}
        <div className="p-3 bg-stone-50 border border-stone-200/80 rounded text-[11px] text-stone-500 space-y-1">
          <div className="font-medium text-stone-700 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
            <span>Role-Based PostgreSQL Access Control</span>
          </div>
          <div>
            Only accounts with an active record in <code className="text-stone-800 font-mono">public.temple_memberships</code> are granted operational access. Non-staff accounts remain restricted to Devotee Family features.
          </div>
        </div>
      </div>
    </div>
  );
};
