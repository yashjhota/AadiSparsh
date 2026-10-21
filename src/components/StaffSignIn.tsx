import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { DEV_TEST_PERSONAS } from '../lib/devData';
import { Smartphone, KeyRound, ShieldAlert, CheckCircle2, ArrowRight, RotateCcw, Lock, AlertCircle } from 'lucide-react';

interface StaffSignInProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export const StaffSignIn: React.FC<StaffSignInProps> = ({ onSuccess, onCancel }) => {
  const {
    sendOtp,
    verifyOtp,
    otpStep,
    otpLoading,
    authError,
    resetOtpFlow,
    startDevSandboxSession,
    isSupabaseConnected,
  } = useAuth();

  const [mobileNumber, setMobileNumber] = useState<string>('+919845012345');
  const [otpCode, setOtpCode] = useState<string>('');

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await sendOtp(mobileNumber);
    if (res.success) {
      setOtpCode('');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await verifyOtp(mobileNumber, otpCode);
    if (res.success) {
      setTimeout(() => {
        onSuccess();
      }, 700);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-12 space-y-8">
      {/* Sign-In Card */}
      <div className="bg-white border border-stone-200 rounded-lg p-8 sm:p-10 shadow-xs space-y-6">
        <div>
          <div className="flex items-center justify-between text-xs">
            <span className="uppercase tracking-widest text-amber-800 font-medium font-sans">
              Authentication Gateway
            </span>
            <span
              className={`font-mono text-[11px] px-2 py-0.5 rounded ${
                isSupabaseConnected
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}
            >
              {isSupabaseConnected ? 'Live Supabase Connected' : 'SMS Gateway: Unconfigured'}
            </span>
          </div>

          <h2 className="font-serif text-2xl sm:text-3xl text-stone-900 font-medium mt-1">
            Staff & Administrator Sign In
          </h2>
          <p className="text-stone-500 text-xs sm:text-sm mt-1.5 leading-relaxed">
            {isSupabaseConnected
              ? 'Enter your registered mobile number to receive a secure Supabase SMS OTP code.'
              : 'Supabase Phone OTP authentication is prepared in code. Live SMS dispatch requires configuring VITE_SUPABASE_URL and an SMS provider (Twilio or MessageBird) in Supabase.'}
          </p>
        </div>

        {/* Error / Notice notification */}
        {authError && (
          <div className="p-3.5 bg-amber-50/80 border border-amber-200 text-amber-900 text-xs rounded flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-700 mt-0.5" />
            <div className="leading-relaxed">{authError}</div>
          </div>
        )}

        {/* Step 1: Mobile Number Input */}
        {otpStep === 'phone_input' && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label htmlFor="mobile-input" className="block text-xs font-medium text-stone-700 mb-1.5">
                Mobile Number (with country code)
              </label>
              <div className="relative">
                <Smartphone className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                <input
                  id="mobile-input"
                  type="tel"
                  required
                  placeholder="+91 98450 12345"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-stone-50 border border-stone-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-800 focus:border-amber-800 transition-colors font-mono"
                />
              </div>
              <p className="text-[11px] text-stone-500 mt-1.5">
                Format: E.164 standard (+91 for India).
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={otpLoading}
                className="flex-1 py-2.5 px-4 text-xs font-medium text-white bg-amber-800 hover:bg-amber-900 rounded transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {otpLoading ? 'Requesting OTP...' : 'Send Verification Code'}
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
        )}

        {/* Step 2: Code Verification Input (Only active when live OTP was dispatched) */}
        {otpStep === 'code_input' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="p-3 bg-amber-50/70 border border-amber-200/60 rounded text-xs text-amber-900 space-y-1">
              <div>
                Verification code dispatched via Supabase SMS to: <span className="font-mono font-semibold">{mobileNumber}</span>
              </div>
            </div>

            <div>
              <label htmlFor="code-input" className="block text-xs font-medium text-stone-700 mb-1.5">
                6-Digit Verification Code (OTP)
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                <input
                  id="code-input"
                  type="text"
                  required
                  maxLength={6}
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.trim())}
                  className="w-full pl-9 pr-3 py-2 text-base font-mono tracking-widest text-center bg-stone-50 border border-stone-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-800 focus:border-amber-800 transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={otpLoading || otpCode.length < 6}
                className="flex-1 py-2.5 px-4 text-xs font-medium text-white bg-amber-800 hover:bg-amber-900 rounded transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {otpLoading ? 'Verifying Code...' : 'Verify & Proceed to Console'}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={resetOtpFlow}
                className="py-2.5 px-3 text-xs font-medium text-stone-600 hover:text-stone-900 border border-stone-200 rounded transition-colors flex items-center gap-1 cursor-pointer"
                title="Change phone number"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Back
              </button>
            </div>
          </form>
        )}

        {/* Step 3: Success State */}
        {otpStep === 'success' && (
          <div className="py-6 text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <h3 className="font-serif text-lg text-stone-900 font-medium">
              Identity Verified
            </h3>
            <p className="text-xs text-stone-500">
              Loading role memberships and establishing secure session...
            </p>
          </div>
        )}
      </div>

      {/* Developer Role Sandbox Session (For testing multi-tenant isolation without SMS credits - Only visible in DEV mode) */}
      {import.meta.env.DEV && (
        <div className="bg-[#FAF7F2] border border-stone-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-stone-600 font-medium flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-800" />
              Local Development Sandbox Session
            </div>
            <span className="text-[11px] font-mono text-amber-800 bg-amber-100/60 px-2 py-0.5 rounded">
              Development Only
            </span>
          </div>
          <p className="text-stone-600 text-xs leading-relaxed">
            To audit and test multi-tenant permissions, RLS boundaries, and temple management without an
            active SMS gateway, select a pre-seeded tenant role below to launch a local sandbox session:
          </p>

          <div className="grid grid-cols-1 gap-2.5">
            {DEV_TEST_PERSONAS.map((persona, idx) => (
              <button
                key={persona.title}
                onClick={() => {
                  startDevSandboxSession(idx);
                  onSuccess();
                }}
                className="text-left p-3 bg-white rounded border border-stone-200 hover:border-amber-700/60 transition-colors group cursor-pointer"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-stone-900 group-hover:text-amber-800 transition-colors">
                    {persona.title}
                  </span>
                  <span className="font-mono text-[11px] text-stone-500">
                    {persona.profile.verified_mobile}
                  </span>
                </div>
                <div className="text-[11px] text-stone-500 mt-1">
                  {persona.description}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
