import React, { useState, useEffect } from 'react';
import { Registration, DayAvailability } from '../../types/database';
import { aadiSparshRepository } from '../../lib/supabase';
import { formatDisplayDate, getKolkataNow, parseLocalDate, formatDateStr } from '../../lib/dateTime';
import {
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Ban,
  ArrowRight,
  ShieldCheck,
  ChevronRight,
  Info,
} from 'lucide-react';

interface FamilyRegistrationsListProps {
  userId: string;
  onBookNewVisit?: () => void;
}

export const FamilyRegistrationsList: React.FC<FamilyRegistrationsListProps> = ({
  userId,
  onBookNewVisit,
}) => {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Cancellation State
  const [cancellingRegId, setCancellingRegId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Rescheduling State
  const [reschedulingReg, setReschedulingReg] = useState<Registration | null>(null);
  const [newTargetDate, setNewTargetDate] = useState<string>('');
  const [rescheduleReason, setRescheduleReason] = useState<string>('');

  const loadRegistrations = async () => {
    setLoading(true);
    try {
      const data = await aadiSparshRepository.getFamilyRegistrations(userId);
      setRegistrations(data);
    } catch (err: unknown) {
      setNotice({ type: 'error', message: 'Failed to load registrations.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      loadRegistrations();
    }
  }, [userId]);

  const handleCancel = async (registrationId: string) => {
    setActionLoading(true);
    setNotice(null);
    try {
      const res = await aadiSparshRepository.cancelFamilyBooking(userId, {
        registration_id: registrationId,
        reason: cancelReason || undefined,
      });

      if (res.success) {
        setNotice({
          type: 'success',
          message: 'Reservation cancelled successfully. One family slot has been released back to temple capacity.',
        });
        setCancellingRegId(null);
        setCancelReason('');
        loadRegistrations();
      } else {
        setNotice({ type: 'error', message: res.error || 'Failed to cancel reservation.' });
      }
    } catch (err: unknown) {
      setNotice({ type: 'error', message: (err as Error).message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReschedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reschedulingReg || !newTargetDate) return;

    setActionLoading(true);
    setNotice(null);
    try {
      const res = await aadiSparshRepository.rescheduleFamilyBooking(userId, {
        registration_id: reschedulingReg.id,
        new_visit_date: newTargetDate,
        reason: rescheduleReason || undefined,
      });

      if (res.success && res.data) {
        setNotice({
          type: 'success',
          message: `Visit successfully rescheduled to ${formatDisplayDate(newTargetDate)}. New registration number: ${res.data.registration_number}`,
        });
        setReschedulingReg(null);
        setNewTargetDate('');
        setRescheduleReason('');
        loadRegistrations();
      } else {
        setNotice({ type: 'error', message: res.error || 'Failed to reschedule reservation.' });
      }
    } catch (err: unknown) {
      setNotice({ type: 'error', message: (err as Error).message });
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-xs text-stone-500 space-y-2">
        <Clock className="w-5 h-5 text-amber-800 animate-spin mx-auto" />
        <p>Retrieving family registration history...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Notice Banner */}
      {notice && (
        <div
          className={`p-3.5 rounded-lg border text-xs flex items-start gap-2.5 ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          )}
          <div className="leading-relaxed flex-1">{notice.message}</div>
          <button
            onClick={() => setNotice(null)}
            className="text-stone-400 hover:text-stone-700 font-bold text-xs cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Reschedule Modal / Dialog Box */}
      {reschedulingReg && (
        <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold text-xs text-amber-950 flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5 text-amber-800" />
              <span>Reschedule Family Visit ({reschedulingReg.registration_number})</span>
            </div>
            <button
              onClick={() => setReschedulingReg(null)}
              className="text-stone-500 hover:text-stone-800 text-xs cursor-pointer font-bold"
            >
              Cancel
            </button>
          </div>

          <p className="text-[11px] text-stone-600">
            Currently scheduled for <strong>{formatDisplayDate(reschedulingReg.visit_date)}</strong>. Pick a new eligible future visit date:
          </p>

          <form onSubmit={handleReschedule} className="space-y-3 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  New Visit Date (YYYY-MM-DD)
                </label>
                <input
                  type="date"
                  required
                  value={newTargetDate}
                  onChange={(e) => setNewTargetDate(e.target.value)}
                  className="w-full py-2 px-3 text-xs bg-white border border-stone-300 rounded focus:ring-1 focus:ring-amber-800 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-700 mb-1">
                  Reschedule Reason <span className="text-stone-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Family travel, pooja date shifted"
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  className="w-full py-2 px-3 text-xs bg-white border border-stone-300 rounded focus:ring-1 focus:ring-amber-800 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setReschedulingReg(null)}
                className="px-3 py-1.5 text-xs text-stone-600 hover:text-stone-900 border border-stone-300 rounded cursor-pointer"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={actionLoading || !newTargetDate}
                className="px-4 py-1.5 text-xs font-medium text-white bg-amber-800 hover:bg-amber-900 rounded cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? 'Validating Capacity...' : 'Confirm Reschedule'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Registrations List */}
      {registrations.length === 0 ? (
        <div className="bg-[#FAF7F2] border border-stone-200/90 rounded-xl p-8 text-center space-y-4">
          <Calendar className="w-10 h-10 text-stone-400 mx-auto" />
          <div className="space-y-1">
            <h5 className="font-serif text-lg font-medium text-stone-800">
              No Registrations Recorded
            </h5>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              Your family has not yet scheduled a visit to Shri Adinath Bhagwan Temple, Chickpet.
            </p>
          </div>
          {onBookNewVisit && (
            <button
              onClick={onBookNewVisit}
              className="px-5 py-2.5 text-xs font-medium text-white bg-amber-800 hover:bg-amber-900 rounded-md transition-colors cursor-pointer shadow-xs inline-flex items-center gap-1.5"
            >
              <span>Schedule a Temple Visit</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {registrations.map((reg) => {
            const isUpcoming = reg.status === 'upcoming';
            const isCancelled = reg.status === 'cancelled';
            const isRescheduled = reg.status === 'rescheduled';

            return (
              <div
                key={reg.id}
                className={`bg-white rounded-xl border p-4 sm:p-5 transition-all space-y-3 ${
                  isUpcoming
                    ? 'border-emerald-300/80 shadow-2xs hover:border-emerald-500'
                    : isCancelled
                    ? 'border-stone-200 bg-stone-50/50 opacity-80'
                    : 'border-amber-200/80 bg-amber-50/30'
                }`}
              >
                {/* Header row */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/70 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs sm:text-sm text-stone-900">
                      {reg.registration_number}
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase tracking-wider ${
                        isUpcoming
                          ? 'bg-emerald-100 text-emerald-800'
                          : isCancelled
                          ? 'bg-stone-200 text-stone-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {reg.status}
                    </span>
                  </div>

                  <div className="text-xs text-stone-500 font-mono">
                    Window: 6:00 AM – 8:00 AM
                  </div>
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-stone-500 block text-[11px]">Visit Date</span>
                    <strong className="text-stone-900 font-semibold">
                      {formatDisplayDate(reg.visit_date)}
                    </strong>
                  </div>

                  <div>
                    <span className="text-stone-500 block text-[11px]">Occasion</span>
                    <span className="text-stone-800 capitalize">
                      {reg.occasion.replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div>
                    <span className="text-stone-500 block text-[11px]">Family Members</span>
                    <span className="text-stone-800 font-medium">
                      {reg.member_count} Attending
                    </span>
                  </div>
                </div>

                {reg.remarks && (
                  <div className="text-[11px] text-stone-600 bg-stone-50 p-2 rounded border border-stone-200/60">
                    <span className="font-semibold text-stone-700">Remarks: </span>
                    {reg.remarks}
                  </div>
                )}

                {/* Cancellation / Reschedule Note */}
                {isCancelled && (
                  <div className="text-[11px] text-stone-500 italic flex items-center gap-1.5 pt-1">
                    <Ban className="w-3.5 h-3.5 text-stone-400" />
                    <span>
                      Cancelled on {reg.cancelled_at ? new Date(reg.cancelled_at).toLocaleDateString() : 'N/A'}. Slot was safely released.
                      {reg.cancellation_reason && ` Reason: "${reg.cancellation_reason}"`}
                    </span>
                  </div>
                )}

                {isRescheduled && (
                  <div className="text-[11px] text-amber-800 italic flex items-center gap-1.5 pt-1">
                    <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                    <span>
                      Rescheduled to a replacement reservation. Complete history preserved in ledger.
                    </span>
                  </div>
                )}

                {/* Actions for Upcoming Bookings */}
                {isUpcoming && (
                  <div className="pt-2 border-t border-stone-200/70 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[11px] text-stone-500">
                      Modifications allowed up to 6:00 PM on preceding day
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setReschedulingReg(reg);
                          setNewTargetDate('');
                          setRescheduleReason('');
                        }}
                        className="px-3 py-1.5 text-xs font-medium text-amber-900 bg-amber-100/70 hover:bg-amber-200/70 rounded transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reschedule</span>
                      </button>

                      {cancellingRegId === reg.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Reason (optional)"
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            className="py-1 px-2 text-xs border border-stone-300 rounded bg-white"
                          />
                          <button
                            type="button"
                            disabled={actionLoading}
                            onClick={() => handleCancel(reg.id)}
                            className="px-2.5 py-1 text-xs font-medium text-white bg-red-700 hover:bg-red-800 rounded cursor-pointer disabled:opacity-50"
                          >
                            Confirm Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => setCancellingRegId(null)}
                            className="px-2 py-1 text-xs text-stone-600 hover:text-stone-900 cursor-pointer"
                          >
                            Back
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setCancellingRegId(reg.id)}
                          className="px-3 py-1.5 text-xs font-medium text-red-700 hover:text-red-900 border border-red-200 hover:bg-red-50 rounded transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
