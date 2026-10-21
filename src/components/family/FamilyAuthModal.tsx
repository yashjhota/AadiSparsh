import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Smartphone,
  KeyRound,
  AlertCircle,
  ArrowRight,
  RotateCcw,
  X,
  ShieldCheck,
  CheckCircle2,
  Info,
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
    sendOtp,
    verifyOtp,
    otpStep,
    otpLoading,
    authError,
    pendingPhone,
    resendCooldown,
    resetOtpFlow,
    setPendingPhone,
    setOtpStep,
    isSupabaseConnected,
    smsProviderBlocked,
    startDevSandboxSession,
  } = useAuth();

  const [selectedCountryCode, setSelectedCountryCode] = useState<string>('+91');
  const [phoneNumberInput, setPhoneNumberInput] = useState<string>('');
  const [otpToken, setOtpToken] = useState<string>('');

  if (!isOpen) return null;

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanDigits = phoneNumberInput.replace(/\D/g, '');
    if (cleanDigits.length < 8) {
      return;
    }
    const fullPhone = `${selectedCountryCode}${cleanDigits}`;
    setPendingPhone(fullPhone);
    const res = await sendOtp(fullPhone);
    if (res.success) {
      setOtpToken('');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await verifyOtp(otpToken);
    if (res.success) {
      onAuthenticated();
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0 || !pendingPhone) return;
    const res = await sendOtp(pendingPhone);
    if (res.success) {
      setOtpToken('');
    }
  };

  const handleChangePhone = () => {
    resetOtpFlow();
    setOtpToken('');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="family-auth-title"
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
              Devotee Family Portal
            </span>
            <span className="text-stone-300">·</span>
            <span className="text-[11px] text-stone-500">Chickpet Temple</span>
          </div>
          <h2
            id="family-auth-title"
            className="font-serif text-2xl font-semibold text-stone-900 tracking-tight"
          >
            {otpStep === 'code_input' ? 'Verify Mobile Number' : 'Devotee Sign In'}
          </h2>
          <p className="text-xs text-stone-600 leading-relaxed">
            {otpStep === 'code_input'
              ? 'Enter the 6-digit verification code sent to your mobile phone.'
              : 'Sign in with your mobile number to view or update your family profile and prepare for temple visits.'}
          </p>
        </div>

        {/* Error / Alert Notice */}
        {authError && (
          <div className="p-3 bg-amber-50/90 border border-amber-200 text-amber-900 text-xs rounded-lg flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-700 mt-0.5" />
            <div className="space-y-1 leading-relaxed">
              <div className="font-medium text-amber-950">Notice</div>
              <div>{authError}</div>
            </div>
          </div>
        )}

        {/* SMS Provider Missing / Blocked Guidance */}
        {smsProviderBlocked && (
          <div className="p-3 bg-stone-100/90 border border-stone-200 text-stone-700 text-xs rounded-lg space-y-2">
            <div className="flex items-center gap-2 font-medium text-stone-900">
              <Info className="w-4 h-4 text-stone-600 shrink-0" />
              <span>SMS Gateway Configuration Required</span>
            </div>
            <p className="text-[11px] text-stone-600 leading-relaxed">
              Live SMS OTP delivery requires enabling a Phone Auth provider (Twilio or MessageBird) in the Supabase Dashboard.
              For local exploration and testing, launch a verified Devotee Family session:
            </p>
            <button
              type="button"
              onClick={() => {
                startDevSandboxSession(3); // Devotee Family persona
                onAuthenticated();
              }}
              className="w-full py-2 px-3 text-xs font-medium text-amber-900 bg-amber-100/80 hover:bg-amber-200/80 rounded border border-amber-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-800" />
              Continue with Devotee Family Sandbox Session
            </button>
          </div>
        )}

        {/* Step 1: Phone Number Input */}
        {otpStep === 'phone_input' && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label
                htmlFor="family-phone"
                className="block text-xs font-semibold text-stone-700 mb-1.5"
              >
                Mobile Number
              </label>
              <div className="flex rounded-md border border-stone-300 focus-within:ring-2 focus-within:ring-amber-800 focus-within:border-amber-800 bg-white overflow-hidden shadow-2xs">
                {/* Country Code Dropdown */}
                <select
                  aria-label="Country Code"
                  value={selectedCountryCode}
                  onChange={(e) => setSelectedCountryCode(e.target.value)}
                  className="bg-stone-50 border-r border-stone-300 px-2.5 py-2 text-xs font-medium text-stone-700 focus:outline-none cursor-pointer"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.code}
                    </option>
                  ))}
                </select>

                {/* Phone Digits Input */}
                <div className="relative flex-1">
                  <input
                    id="family-phone"
                    type="tel"
                    required
                    placeholder="98450 12345"
                    value={phoneNumberInput}
                    onChange={(e) => setPhoneNumberInput(e.target.value)}
                    className="w-full py-2 px-3 text-sm text-stone-900 focus:outline-none placeholder:text-stone-400 font-mono"
                  />
                </div>
              </div>
              <p className="text-[11px] text-stone-500 mt-1.5">
                We will dispatch a secure 6-digit one-time password (OTP) via SMS.
              </p>
            </div>

            <button
              type="submit"
              disabled={otpLoading || phoneNumberInput.trim().length < 6}
              className="w-full py-2.5 px-4 text-xs font-medium text-white bg-amber-800 hover:bg-amber-900 rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
            >
              {otpLoading ? 'Requesting OTP...' : 'Send Verification OTP'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        )}

        {/* Step 2: Code Verification Input */}
        {otpStep === 'code_input' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="p-3 bg-stone-100/80 rounded-lg border border-stone-200 text-xs flex items-center justify-between">
              <div>
                <span className="text-stone-500">Sent code to: </span>
                <span className="font-mono font-semibold text-stone-800">{pendingPhone}</span>
              </div>
              <button
                type="button"
                onClick={handleChangePhone}
                className="text-amber-800 hover:text-amber-950 font-medium text-xs underline cursor-pointer"
              >
                Change
              </button>
            </div>

            <div>
              <label
                htmlFor="family-otp-input"
                className="block text-xs font-semibold text-stone-700 mb-1.5"
              >
                6-Digit Verification Code
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                <input
                  id="family-otp-input"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  autoFocus
                  placeholder="123456"
                  value={otpToken}
                  onChange={(e) => setOtpToken(e.target.value.replace(/\D/g, ''))}
                  className="w-full pl-9 pr-3 py-2 text-base tracking-widest text-center font-mono bg-white border border-stone-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-800 focus:border-amber-800"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                disabled={resendCooldown > 0 || otpLoading}
                onClick={handleResendOtp}
                className="text-amber-800 hover:text-amber-950 font-medium flex items-center gap-1 disabled:text-stone-400 disabled:cursor-not-allowed cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                {resendCooldown > 0 ? `Resend OTP in ${resendCooldown}s` : 'Resend OTP'}
              </button>
              <button
                type="button"
                onClick={handleChangePhone}
                className="text-stone-500 hover:text-stone-800 cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <button
              type="submit"
              disabled={otpLoading || otpToken.length !== 6}
              className="w-full py-2.5 px-4 text-xs font-medium text-white bg-amber-800 hover:bg-amber-900 rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
            >
              {otpLoading ? 'Verifying OTP...' : 'Verify & Open Profile'}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        )}

        {/* Security & Privacy Reassurance */}
        <div className="pt-2 border-t border-stone-200/80 flex items-center justify-center gap-1.5 text-[11px] text-stone-500">
          <ShieldCheck className="w-3.5 h-3.5 text-stone-400" />
          <span>Devotee family privacy & phone OTP security enforced</span>
        </div>
      </div>
    </div>
  );
};
