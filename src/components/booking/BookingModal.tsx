import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Temple, Registration, RegistrationOccasion } from '../../types/database';
import { aadiSparshRepository } from '../../lib/supabase';
import { BookingCalendar } from './BookingCalendar';
import { formatDisplayDate } from '../../lib/dateTime';
import {
  X,
  Calendar,
  Clock,
  Users,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  ArrowRight,
  ArrowLeft,
  Lock,
  HeartHandshake,
} from 'lucide-react';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  temple: Temple;
  onOpenAuth: () => void;
  onViewMyRegistrations?: () => void;
}

type BookingStep = 'calendar' | 'details' | 'confirmation';

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  temple,
  onOpenAuth,
  onViewMyRegistrations,
}) => {
  const { currentUser, isAuthenticated } = useAuth();

  const [step, setStep] = useState<BookingStep>('calendar');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Form State
  const [occasion, setOccasion] = useState<RegistrationOccasion>('family_pooja');
  const [occasionDate, setOccasionDate] = useState<string>('');
  const [memberCount, setMemberCount] = useState<number>(4);
  const [remarks, setRemarks] = useState<string>('');

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdRegistration, setCreatedRegistration] = useState<Registration | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSelectDate = (dateStr: string) => {
    setSelectedDate(dateStr);
    setErrorMsg(null);
  };

  const handleProceedToDetails = () => {
    if (!selectedDate) {
      setErrorMsg('Please select a visit date on the calendar.');
      return;
    }
    setStep('details');
  };

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !selectedDate) return;

    if (memberCount < 1) {
      setErrorMsg('Please specify at least 1 attending devotee member.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await aadiSparshRepository.bookTempleVisit(currentUser.id, {
        temple_id: temple.id,
        visit_date: selectedDate,
        member_count: memberCount,
        occasion,
        occasion_date: occasionDate || null,
        remarks: remarks || null,
      });

      if (res.success && res.data) {
        setCreatedRegistration(res.data);
        setStep('confirmation');
      } else {
        setErrorMsg(res.error || 'Failed to complete family reservation. Please try again.');
      }
    } catch (err: unknown) {
      setErrorMsg((err as Error).message || 'An error occurred while confirming reservation.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyDetails = () => {
    if (!createdRegistration) return;
    const text = `Aadi Sparsh — Parmatma Pooja Reservation
Registration No: ${createdRegistration.registration_number}
Temple: ${temple.name}
Visit Date: ${formatDisplayDate(createdRegistration.visit_date)}
Visit Window: ${temple.pooja_start_time.substring(0, 5)} AM – ${temple.pooja_end_time.substring(0, 5)} AM
Devotee: ${currentUser?.full_name} (${currentUser?.verified_mobile})
Attending Members: ${createdRegistration.member_count}
Occasion: ${createdRegistration.occasion.replace(/_/g, ' ').toUpperCase()}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const resetModal = () => {
    setStep('calendar');
    setSelectedDate(null);
    setOccasion('family_pooja');
    setOccasionDate('');
    setMemberCount(4);
    setRemarks('');
    setErrorMsg(null);
    setCreatedRegistration(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-2xl bg-[#FDFBF7] rounded-xl border border-stone-300 shadow-xl overflow-hidden my-6">
        {/* Modal Header */}
        <div className="px-6 py-5 bg-[#FAF7F2] border-b border-stone-200 flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded font-semibold">
                Daily Capacity: 15 Families
              </span>
              <span className="text-[11px] text-stone-500 font-mono">
                Booking Fee: Free
              </span>
            </div>
            <h3 className="font-serif text-xl sm:text-2xl font-medium text-stone-900">
              Parmatma Pooja Visit Registration
            </h3>
            <p className="text-xs text-stone-600">
              {temple.name} · Chickpet, Bengaluru
            </p>
          </div>

          <button
            onClick={resetModal}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-200/50 rounded-md transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Unauthenticated Wall */}
        {!isAuthenticated ? (
          <div className="p-8 sm:p-12 text-center space-y-5">
            <div className="w-14 h-14 bg-amber-100/80 text-amber-800 rounded-full flex items-center justify-center mx-auto border border-amber-200 shadow-2xs">
              <Lock className="w-6 h-6" />
            </div>
            <div className="space-y-2 max-w-md mx-auto">
              <h4 className="font-serif text-xl font-medium text-stone-900">
                Devotee Sign-In Required
              </h4>
              <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
                To guarantee fair sanctuary access, prevent duplicates, and securely anchor family registrations, please authenticate your mobile number with a verified one-time code.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={() => {
                  onClose();
                  onOpenAuth();
                }}
                className="w-full sm:w-auto px-6 py-2.5 text-xs font-medium text-white bg-amber-800 hover:bg-amber-900 rounded-md transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
              >
                <span>Authenticate with Mobile OTP</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={resetModal}
                className="w-full sm:w-auto px-4 py-2.5 text-xs font-medium text-stone-600 hover:text-stone-900 border border-stone-300 rounded-md transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>

            <p className="text-[11px] text-stone-500 pt-3">
              One account per family · Used for current and future year visit history
            </p>
          </div>
        ) : (
          <div className="p-6">
            {/* Step Navigation Progress */}
            {step !== 'confirmation' && (
              <div className="mb-6 flex items-center justify-between border-b border-stone-200/80 pb-3 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setStep('calendar')}
                  className={`flex items-center gap-2 cursor-pointer ${
                    step === 'calendar' ? 'text-amber-800 font-semibold' : 'text-stone-500'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    step === 'calendar' ? 'bg-amber-800 text-white' : 'bg-stone-200 text-stone-700'
                  }`}>
                    1
                  </span>
                  <span>Select Visit Date</span>
                </button>

                <div className="w-12 h-px bg-stone-300" />

                <button
                  type="button"
                  disabled={!selectedDate}
                  onClick={() => selectedDate && setStep('details')}
                  className={`flex items-center gap-2 ${
                    step === 'details'
                      ? 'text-amber-800 font-semibold cursor-pointer'
                      : 'text-stone-400 cursor-not-allowed'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                    step === 'details' ? 'bg-amber-800 text-white' : 'bg-stone-200 text-stone-500'
                  }`}>
                    2
                  </span>
                  <span>Devotee & Family Details</span>
                </button>
              </div>
            )}

            {/* Error Banner */}
            {errorMsg && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-xs text-red-900 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed flex-1">{errorMsg}</div>
                <button
                  onClick={() => setErrorMsg(null)}
                  className="text-stone-400 hover:text-stone-700 text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* STEP 1: Interactive Calendar */}
            {step === 'calendar' && (
              <div className="space-y-5">
                <BookingCalendar
                  templeId={temple.id}
                  selectedDate={selectedDate}
                  onSelectDate={handleSelectDate}
                  bookingCutoffTime={temple.booking_cutoff_time}
                  rollingMonths={temple.rolling_booking_months}
                />

                <div className="flex items-center justify-between pt-2">
                  <div className="text-xs text-stone-500">
                    {selectedDate ? (
                      <span className="text-stone-800">
                        Date chosen: <strong className="font-semibold">{formatDisplayDate(selectedDate)}</strong>
                      </span>
                    ) : (
                      <span>Select an eligible date to proceed</span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={!selectedDate}
                    onClick={handleProceedToDetails}
                    className="px-5 py-2.5 text-xs font-medium text-white bg-amber-800 hover:bg-amber-900 rounded-md transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                  >
                    <span>Continue to Family Details</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2: Devotee & Family Details Form */}
            {step === 'details' && selectedDate && (
              <form onSubmit={handleSubmitBooking} className="space-y-4">
                {/* Date Reminder Card */}
                <div className="bg-amber-50/70 border border-amber-200/80 rounded-lg p-3.5 flex items-center justify-between text-xs text-amber-900">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-amber-800 shrink-0" />
                    <div>
                      <span className="text-stone-600">Scheduled Visit: </span>
                      <strong className="font-semibold">{formatDisplayDate(selectedDate)}</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep('calendar')}
                    className="text-amber-800 hover:text-amber-950 underline font-medium cursor-pointer"
                  >
                    Change Date
                  </button>
                </div>

                {/* Devotee Identity Card (Prefilled from Authenticated Profile) */}
                <div className="p-3.5 bg-stone-100/70 rounded-lg border border-stone-200 text-xs space-y-1">
                  <div className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                    Registered Family Profile
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                    <div className="font-semibold text-stone-900 text-sm">
                      {currentUser?.full_name || 'Devotee Head'}
                    </div>
                    <div className="font-mono text-stone-600 bg-white px-2 py-0.5 rounded border border-stone-200 text-[11px]">
                      {currentUser?.verified_mobile}
                    </div>
                  </div>
                  <p className="text-[11px] text-stone-500">
                    City: {currentUser?.city || 'Bengaluru'}, {currentUser?.state || 'Karnataka'}
                  </p>
                </div>

                {/* Occasion Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="occasion-select" className="block text-xs font-semibold text-stone-700 mb-1.5">
                      Pooja Occasion
                    </label>
                    <select
                      id="occasion-select"
                      value={occasion}
                      onChange={(e) => setOccasion(e.target.value as RegistrationOccasion)}
                      className="w-full py-2 px-3 text-xs bg-white border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-800 focus:border-amber-800 cursor-pointer"
                    >
                      <option value="family_pooja">Family Darshan & Pooja</option>
                      <option value="birthday">Birthday Auspicious Pooja</option>
                      <option value="wedding_anniversary">Wedding Anniversary Pooja</option>
                      <option value="special_day">Remembrance / Special Day</option>
                      <option value="other">General Parmatma Seva</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="occasion-date" className="block text-xs font-semibold text-stone-700 mb-1.5">
                      Occasion Date <span className="text-stone-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      id="occasion-date"
                      type="date"
                      value={occasionDate}
                      onChange={(e) => setOccasionDate(e.target.value)}
                      className="w-full py-2 px-3 text-xs bg-white border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-800 focus:border-amber-800"
                    />
                  </div>
                </div>

                {/* Attending Member Count (No artificial limit) */}
                <div>
                  <label htmlFor="member-count" className="block text-xs font-semibold text-stone-700 mb-1.5">
                    Attending Family Members
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      id="member-count"
                      type="number"
                      min={1}
                      max={50}
                      required
                      value={memberCount}
                      onChange={(e) => setMemberCount(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-24 py-2 px-3 text-sm font-semibold font-mono text-center bg-white border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-800 focus:border-amber-800"
                    />
                    <div className="text-xs text-stone-500">
                      <span>Total family members attending. </span>
                      <strong className="text-stone-700">One family reservation covers your entire family</strong>
                      <span> without consuming extra slots.</span>
                    </div>
                  </div>
                </div>

                {/* Optional Remarks */}
                <div>
                  <label htmlFor="remarks-input" className="block text-xs font-semibold text-stone-700 mb-1.5">
                    Special Remarks or Needs <span className="text-stone-400 font-normal">(Optional)</span>
                  </label>
                  <textarea
                    id="remarks-input"
                    rows={2}
                    placeholder="e.g., Senior citizen assistance, wheelchair accessibility, samayik..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full py-2 px-3 text-xs bg-white border border-stone-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-800 focus:border-amber-800"
                  />
                </div>

                {/* Policy Reassurance */}
                <div className="p-3 bg-[#FAF7F2] rounded border border-stone-200/80 text-[11px] text-stone-600 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    By confirming, your family slot is permanently recorded in the temple database. Duplicate active bookings on the same date are rejected by atomic database constraints.
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-3 border-t border-stone-200">
                  <button
                    type="button"
                    onClick={() => setStep('calendar')}
                    className="px-4 py-2 text-xs font-medium text-stone-600 hover:text-stone-900 flex items-center gap-1.5 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Calendar</span>
                  </button>

                  <button
                    type="submit"
                    disabled={loading || memberCount < 1}
                    className="px-6 py-2.5 text-xs font-medium text-white bg-amber-800 hover:bg-amber-900 rounded-md transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-xs"
                  >
                    {loading ? (
                      <>
                        <Clock className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying & Locking Slot...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Confirm Family Reservation</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: Confirmation View */}
            {step === 'confirmation' && createdRegistration && (
              <div className="space-y-6 text-center py-4">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center mx-auto border border-emerald-200 shadow-xs">
                  <CheckCircle2 className="w-8 h-8 text-emerald-700" />
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs uppercase tracking-widest text-emerald-800 font-semibold">
                    Reservation Confirmed
                  </div>
                  <h4 className="font-serif text-2xl font-medium text-stone-900">
                    Aadi Sparsh Pooja Visit Scheduled
                  </h4>
                  <p className="text-xs text-stone-600">
                    Your family slot is authoritative and permanently saved in the temple ledger.
                  </p>
                </div>

                {/* Registration Number Card */}
                <div className="bg-[#FAF7F2] border border-amber-200/90 rounded-xl p-5 max-w-md mx-auto text-left space-y-3 shadow-2xs">
                  <div className="flex items-center justify-between border-b border-stone-200/80 pb-2.5">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-stone-500 block">
                        Registration Number
                      </span>
                      <span className="font-mono font-bold text-amber-900 text-base tracking-wider">
                        {createdRegistration.registration_number}
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded uppercase">
                      Upcoming
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-stone-500 block text-[11px]">Visit Date</span>
                      <span className="font-semibold text-stone-900">
                        {formatDisplayDate(createdRegistration.visit_date)}
                      </span>
                    </div>
                    <div>
                      <span className="text-stone-500 block text-[11px]">Pooja Window</span>
                      <span className="font-semibold text-stone-900">
                        {temple.pooja_start_time.substring(0, 5)} AM – {temple.pooja_end_time.substring(0, 5)} AM
                      </span>
                    </div>
                    <div>
                      <span className="text-stone-500 block text-[11px]">Family Head</span>
                      <span className="font-semibold text-stone-900">
                        {currentUser?.full_name}
                      </span>
                    </div>
                    <div>
                      <span className="text-stone-500 block text-[11px]">Attending Devotees</span>
                      <span className="font-semibold text-stone-900">
                        {createdRegistration.member_count} Members
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-stone-200/70 text-xs">
                    <span className="text-stone-500 block text-[11px]">Occasion</span>
                    <span className="font-medium text-stone-800 capitalize">
                      {createdRegistration.occasion.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>

                {/* Sanctity Checklist */}
                <div className="bg-stone-50 border border-stone-200 rounded-lg p-4 max-w-md mx-auto text-left text-xs text-stone-600 space-y-2">
                  <div className="font-semibold text-stone-800 flex items-center gap-1.5 text-xs">
                    <Sparkles className="w-3.5 h-3.5 text-amber-800" />
                    <span>Sanctuary & Tradition Guidelines</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-[11px] text-stone-600 pl-1 leading-relaxed">
                    <li>Please arrive at the temple premises by 6:00 AM.</li>
                    <li>Traditional clean white pooja vastra (dhoti-khes) recommended for darshan.</li>
                    <li>Devotees may cancel or reschedule self-service up to 6:00 PM on the day prior.</li>
                  </ul>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleCopyDetails}
                    className="w-full sm:w-auto px-5 py-2.5 text-xs font-medium text-stone-800 bg-white border border-stone-300 rounded-md hover:bg-stone-50 transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Details Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-stone-500" />
                        <span>Copy Registration Details</span>
                      </>
                    )}
                  </button>

                  {onViewMyRegistrations && (
                    <button
                      type="button"
                      onClick={() => {
                        resetModal();
                        onViewMyRegistrations();
                      }}
                      className="w-full sm:w-auto px-5 py-2.5 text-xs font-medium text-amber-900 bg-amber-100 hover:bg-amber-200/80 rounded-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>View My Registrations</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={resetModal}
                    className="w-full sm:w-auto px-6 py-2.5 text-xs font-medium text-white bg-amber-800 hover:bg-amber-900 rounded-md transition-colors cursor-pointer shadow-xs"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
