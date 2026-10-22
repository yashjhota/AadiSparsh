import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Smartphone,
  Lock,
  Eye,
  EyeOff,
  User,
  AlertCircle,
  ArrowRight,
  X,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

interface FamilyAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated: () => void;
}

const COUNTRY_CODES = [
  { code: '+91', country: 'India', flag: '🇮🇳' },
  { code: '+1', country: 'USA / Canada', flag: '🇺🇸' },
  { code: '+44', country: 'United Kingdom', flag: '🇬🇧' },
  { code: '+971', country: 'UAE', flag: '🇦🇪' },
  { code: '+65', country: 'Singapore', flag: '🇸🇬' },
  { code: '+254', country: 'Kenya', flag: '🇰🇪' },
  { code: '+32', country: 'Belgium', flag: '🇧🇪' },
];

export const FamilyAuthModal: React.FC<FamilyAuthModalProps> = ({
  isOpen,
  onClose,
  onAuthenticated,
}) => {
  const {
    signInWithPhonePassword,
    otpLoading,
    authError,
    currentUser,
    currentRole,
    isSupabaseConnected,
  } = useAuth();

  const [selectedCountryCode, setSelectedCountryCode] = useState<string>('+91');
  const [phoneNumberInput, setPhoneNumberInput] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [authSuccessRole, setAuthSuccessRole] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const cleanDigits = phoneNumberInput.replace(/\D/g, '');
    if (cleanDigits.length < 8) {
      setLocalError('Please enter a valid mobile number with at least 8 digits.');
      return;
    }

    if (!password || password.length < 6) {
      setLocalError('Password must be at least 6 characters long.');
      return;
    }

    const fullPhone = `${selectedCountryCode}${cleanDigits}`;
    const result = await signInWithPhonePassword(fullPhone, password, fullName);

    if (result.success) {
      setAuthSuccessRole(result.role || 'family');
      setTimeout(() => {
        onAuthenticated();
      }, 600);
    } else {
      setLocalError(result.error || 'Authentication failed. Please check your credentials.');
    }
  };

  const setTestCredentials = (phone: string, roleName: string) => {
    const rawNumber = phone.replace(/^\+91/, '');
    setSelectedCountryCode('+91');
    setPhoneNumberInput(rawNumber);
    setPassword('AadiSparsh@2026');
    setFullName(roleName);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="unified-auth-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="relative w-full max-w-md bg-[#FDFBF7] rounded-xl border border-stone-200/90 shadow-2xl p-6 sm:p-8 space-y-6 text-[#1C1917]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="space-y-1.5 pr-6">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">
              Aadi Sparsh
            </span>
            <span className="text-stone-300">·</span>
            <span className="text-[11px] text-stone-500">Unified Temple Portal</span>
          </div>
          <h2
            id="unified-auth-title"
            className="font-serif text-2xl font-semibold text-stone-900 tracking-tight"
          >
            Sign In with Mobile
          </h2>
          <p className="text-xs text-stone-600 leading-relaxed">
            Enter your mobile number and password to access pooja reservations and temple services.
            New numbers are registered automatically.
          </p>
        </div>

        {/* Error / Alert Notice */}
        {(localError || authError) && (
          <div className="p-3 bg-amber-50/90 border border-amber-200 text-amber-900 text-xs rounded-lg flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-700 mt-0.5" />
            <div className="space-y-0.5 leading-relaxed">
              <div className="font-medium text-amber-950">Notice</div>
              <div>{localError || authError}</div>
            </div>
          </div>
        )}

        {/* Success Feedback */}
        {authSuccessRole && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-lg flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>
              Signed in successfully as{' '}
              <strong className="capitalize">{authSuccessRole.replace('_', ' ')}</strong>. Welcome!
            </span>
          </div>
        )}

        {/* Unified Sign-In & Auto-Registration Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Mobile Number Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-stone-700">
              Mobile Number
            </label>
            <div className="flex rounded-md border border-stone-300 focus-within:border-amber-700 focus-within:ring-1 focus-within:ring-amber-700 bg-white shadow-2xs overflow-hidden">
              <select
                aria-label="Country Code"
                value={selectedCountryCode}
                onChange={(e) => setSelectedCountryCode(e.target.value)}
                className="bg-stone-50 border-r border-stone-200 text-stone-700 text-xs py-2.5 px-2.5 focus:outline-hidden cursor-pointer"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.code}
                  </option>
                ))}
              </select>
              <div className="relative flex-1 flex items-center">
                <input
                  type="tel"
                  required
                  placeholder="98450 12345"
                  value={phoneNumberInput}
                  onChange={(e) => setPhoneNumberInput(e.target.value)}
                  className="w-full text-xs py-2.5 px-3 text-stone-900 placeholder:text-stone-400 focus:outline-hidden"
                />
                <Smartphone className="w-4 h-4 text-stone-400 mr-3 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Password Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-stone-700">
                Password
              </label>
              <span className="text-[11px] text-stone-400">Min 6 characters</span>
            </div>
            <div className="relative flex items-center rounded-md border border-stone-300 focus-within:border-amber-700 focus-within:ring-1 focus-within:ring-amber-700 bg-white shadow-2xs overflow-hidden">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Enter your account password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full text-xs py-2.5 pl-3 pr-10 text-stone-900 placeholder:text-stone-400 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 p-1 text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Optional Full Name (used if auto-registering a new devotee family) */}
          <div className="space-y-1.5 pt-0.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-stone-700">
                Full Name / Family Title
              </label>
              <span className="text-[11px] text-stone-400">For new registrations</span>
            </div>
            <div className="relative flex items-center rounded-md border border-stone-300 focus-within:border-amber-700 focus-within:ring-1 focus-within:ring-amber-700 bg-white shadow-2xs overflow-hidden">
              <input
                type="text"
                placeholder="e.g. Nemichand & Family"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full text-xs py-2.5 pl-3 pr-10 text-stone-900 placeholder:text-stone-400 focus:outline-hidden"
              />
              <User className="w-4 h-4 text-stone-400 mr-3 pointer-events-none" />
            </div>
          </div>

          {/* Submit Action */}
          <button
            type="submit"
            disabled={otpLoading || Boolean(authSuccessRole)}
            className="w-full py-2.5 px-4 text-xs font-medium text-white bg-amber-800 hover:bg-amber-900 rounded-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {otpLoading ? (
              <span>Verifying credentials...</span>
            ) : authSuccessRole ? (
              <span>Authenticated</span>
            ) : (
              <>
                <span>Sign In / Register</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Quick Dev Credentials Selector (DEV mode only) */}
        {import.meta.env.DEV && (
          <div className="pt-2 border-t border-stone-200/80 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-stone-500">
              <span className="font-semibold uppercase tracking-wider text-amber-800">
                Dev Quick Fill
              </span>
              <span className="text-stone-400">Pw: AadiSparsh@2026</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => setTestCredentials('+919845012345', 'Shrenikbhai J. Shah')}
                className="py-1 px-2 text-left bg-stone-100 hover:bg-stone-200 text-stone-700 rounded transition-colors truncate cursor-pointer"
              >
                👑 Superadmin
              </button>
              <button
                type="button"
                onClick={() => setTestCredentials('+919845067890', 'Mahendrakumar Mehta')}
                className="py-1 px-2 text-left bg-stone-100 hover:bg-stone-200 text-stone-700 rounded transition-colors truncate cursor-pointer"
              >
                🏛️ Temple Admin
              </button>
              <button
                type="button"
                onClick={() => setTestCredentials('+919845099999', 'Pravinbhai Solanki')}
                className="py-1 px-2 text-left bg-stone-100 hover:bg-stone-200 text-stone-700 rounded transition-colors truncate cursor-pointer"
              >
                📋 Temple Manager
              </button>
              <button
                type="button"
                onClick={() => setTestCredentials('+919845077777', 'Aarti & Kirit Doshi')}
                className="py-1 px-2 text-left bg-stone-100 hover:bg-stone-200 text-stone-700 rounded transition-colors truncate cursor-pointer"
              >
                🙏 Devotee Family
              </button>
            </div>
          </div>
        )}

        {/* Security / Privacy Trust Footer */}
        <div className="pt-1 flex items-center justify-between text-[11px] text-stone-500 border-t border-stone-200/70">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
            <span>Native Supabase Phone & Password</span>
          </div>
          <span className="text-[10px] text-stone-400">
            {isSupabaseConnected ? 'Live Supabase' : 'Local Dev Sandbox'}
          </span>
        </div>
      </div>
    </div>
  );
};
