import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { FamilyProfileUpdateInput } from '../../types/database';
import {
  X,
  User,
  Phone,
  MapPin,
  Lock,
  CheckCircle2,
  AlertCircle,
  Save,
  LogOut,
  Building2,
  Sparkles,
  Calendar,
} from 'lucide-react';
import { FamilyRegistrationsList } from '../booking/FamilyRegistrationsList';

interface FamilyProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenBooking?: () => void;
  initialTab?: 'profile' | 'registrations';
}

export const FamilyProfileModal: React.FC<FamilyProfileModalProps> = ({
  isOpen,
  onClose,
  onOpenBooking,
  initialTab = 'profile',
}) => {
  const { currentUser, saveProfile, signOut, otpLoading, authError } = useAuth();

  const [activeTab, setActiveTab] = useState<'profile' | 'registrations'>(initialTab);
  const [fullName, setFullName] = useState<string>('');
  const [locality, setLocality] = useState<string>('');
  const [city, setCity] = useState<string>('Bengaluru');
  const [state, setState] = useState<string>('Karnataka');
  const [country, setCountry] = useState<string>('India');

  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Sync profile data when currentUser changes or modal opens
  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.full_name || '');
      setLocality(currentUser.locality || '');
      setCity(currentUser.city || 'Bengaluru');
      setState(currentUser.state || 'Karnataka');
      setCountry(currentUser.country || 'India');
      setSaveSuccessMessage(null);
      setLocalError(null);
    }
  }, [currentUser, isOpen]);

  if (!isOpen || !currentUser) return null;

  const isFirstTimeRegistration = !currentUser.full_name || currentUser.full_name.trim().length === 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveSuccessMessage(null);
    setLocalError(null);

    if (!fullName.trim() || fullName.trim().length < 2) {
      setLocalError('Please enter the full name of the family head / devotee.');
      return;
    }

    setIsSaving(true);
    const input: FamilyProfileUpdateInput = {
      full_name: fullName.trim(),
      locality: locality.trim() || null,
      city: city.trim() || null,
      state: state.trim() || null,
      country: country.trim() || 'India',
    };

    const res = await saveProfile(input);
    setIsSaving(false);

    if (res.success) {
      setSaveSuccessMessage('Family profile saved successfully! Your account is prepared for temple pooja registrations.');
    } else {
      setLocalError(res.error || 'Failed to save family profile. Please try again.');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="family-profile-title"
      className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="relative w-full max-w-lg bg-[#FDFBF7] rounded-xl border border-stone-200/90 shadow-2xl p-6 sm:p-8 space-y-6 text-[#1C1917]">
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
              Devotee Family Account
            </span>
            <span className="text-stone-300">·</span>
            <span className="text-[11px] text-stone-500 font-mono">ID: {currentUser.id.slice(0, 8)}...</span>
          </div>

          <h2
            id="family-profile-title"
            className="font-serif text-2xl font-semibold text-stone-900 tracking-tight flex items-center gap-2"
          >
            <span>{isFirstTimeRegistration ? 'Complete Family Profile' : 'Devotee Family Profile'}</span>
          </h2>

          <p className="text-xs text-stone-600 leading-relaxed">
            {isFirstTimeRegistration
              ? 'Welcome to Aadi Sparsh! Please enter your family details to establish your devotee account for Shri Adinath Bhagwan temple darshan and poojas.'
              : 'Your family profile is permanently stored for Chickpet Shri Adinath Bhagwan temple visits and future years.'}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-stone-200 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`pb-2.5 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'profile'
                ? 'border-amber-800 text-amber-900 font-semibold'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Profile Details</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('registrations')}
            className={`pb-2.5 px-3 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'registrations'
                ? 'border-amber-800 text-amber-900 font-semibold'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>My Registrations</span>
          </button>
        </div>

        {/* Tab 1: Profile Details */}
        {activeTab === 'profile' && (
          <div className="space-y-4">
        {/* Success Banner */}
        {saveSuccessMessage && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs rounded-lg flex items-start gap-2.5 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700 mt-0.5" />
            <div className="leading-relaxed font-medium">{saveSuccessMessage}</div>
          </div>
        )}

        {/* Error Notification */}
        {(localError || authError) && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-lg flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-700 mt-0.5" />
            <div className="leading-relaxed">{localError || authError}</div>
          </div>
        )}

        {/* Profile Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Full Name */}
          <div>
            <label htmlFor="family-fullname" className="block text-xs font-semibold text-stone-700 mb-1">
              Full Name of Family Head / Devotee <span className="text-amber-700">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
              <input
                id="family-fullname"
                type="text"
                required
                placeholder="e.g. Shrenikbhai J. Shah"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-stone-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-800 focus:border-amber-800 text-stone-900"
              />
            </div>
            <p className="text-[11px] text-stone-500 mt-1">
              Used for temple darshan registers and pooja sankalpa.
            </p>
          </div>

          {/* Verified Mobile Number (Immutable) */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Verified Mobile Number
            </label>
            <div className="flex items-center justify-between px-3 py-2 bg-stone-100 border border-stone-200 rounded-md text-stone-700 text-xs font-mono">
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-stone-400" />
                <span className="font-semibold">{currentUser.verified_mobile || 'Session Phone'}</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-sans text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded border border-emerald-200">
                <Lock className="w-3 h-3 text-emerald-700" />
                <span>Verified OTP (Locked)</span>
              </div>
            </div>
            <p className="text-[11px] text-stone-500 mt-1">
              Anchored to your authenticated session. To prevent fraud, verified numbers cannot be edited here.
            </p>
          </div>

          {/* Locality / Neighborhood & City */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="family-locality" className="block text-xs font-semibold text-stone-700 mb-1">
                Locality / Area
              </label>
              <div className="relative">
                <MapPin className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
                <input
                  id="family-locality"
                  type="text"
                  placeholder="e.g. Sadashivanagar"
                  value={locality}
                  onChange={(e) => setLocality(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-stone-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-800 focus:border-amber-800 text-stone-900"
                />
              </div>
            </div>

            <div>
              <label htmlFor="family-city" className="block text-xs font-semibold text-stone-700 mb-1">
                City
              </label>
              <div className="relative">
                <Building2 className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-2.5" />
                <input
                  id="family-city"
                  type="text"
                  placeholder="e.g. Bengaluru"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-stone-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-800 focus:border-amber-800 text-stone-900"
                />
              </div>
            </div>
          </div>

          {/* State & Country */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="family-state" className="block text-xs font-semibold text-stone-700 mb-1">
                State
              </label>
              <input
                id="family-state"
                type="text"
                placeholder="e.g. Karnataka"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-800 focus:border-amber-800 text-stone-900"
              />
            </div>

            <div>
              <label htmlFor="family-country" className="block text-xs font-semibold text-stone-700 mb-1">
                Country
              </label>
              <input
                id="family-country"
                type="text"
                placeholder="e.g. India"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-800 focus:border-amber-800 text-stone-900"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="submit"
              disabled={isSaving || otpLoading || fullName.trim().length < 2}
              className="w-full sm:flex-1 py-2.5 px-4 text-xs font-medium text-white bg-amber-800 hover:bg-amber-900 rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              {isSaving ? 'Saving Profile...' : 'Save Family Profile'}
            </button>

            <button
              type="button"
              onClick={handleSignOut}
              className="w-full sm:w-auto py-2.5 px-3 text-xs font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 border border-stone-200 rounded-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-stone-400" />
              Sign Out
            </button>
          </div>
        </form>
        </div>
      )}

      {/* Tab 2: My Registrations */}
      {activeTab === 'registrations' && (
        <div className="space-y-4">
          <FamilyRegistrationsList
            userId={currentUser.id}
            onBookNewVisit={() => {
              onClose();
              onOpenBooking?.();
            }}
          />
        </div>
      )}

        {/* Informational Footer Note */}
        <div className="pt-3 border-t border-stone-200/80 flex items-center justify-between text-[11px] text-stone-500">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-700" />
            <span>Chickpet Shri Adinath Bhagwan Temple Initiative</span>
          </div>
          <span className="text-stone-400">Phase 2B Active</span>
        </div>
      </div>
    </div>
  );
};
