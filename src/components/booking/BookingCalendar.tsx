import React, { useState, useEffect } from 'react';
import { DayAvailability } from '../../types/database';
import { aadiSparshRepository } from '../../lib/supabase';
import {
  getKolkataNow,
  parseLocalDate,
  formatDateStr,
  formatDisplayDate,
} from '../../lib/dateTime';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Info,
  CheckCircle2,
  Clock,
  Ban,
  Sparkles,
} from 'lucide-react';

interface BookingCalendarProps {
  templeId: string;
  selectedDate: string | null;
  onSelectDate: (dateStr: string) => void;
  bookingCutoffTime?: string;
  rollingMonths?: number;
}

export const BookingCalendar: React.FC<BookingCalendarProps> = ({
  templeId,
  selectedDate,
  onSelectDate,
  bookingCutoffTime = '18:00:00',
  rollingMonths = 6,
}) => {
  const [availability, setAvailability] = useState<DayAvailability[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Month navigation: current month offset (0 = current month in Asia/Kolkata)
  const [monthOffset, setMonthOffset] = useState<number>(0);

  const nowKolkata = getKolkataNow();
  const baseDate = new Date(nowKolkata.year, nowKolkata.month - 1 + monthOffset, 1);
  const displayedYear = baseDate.getFullYear();
  const displayedMonth = baseDate.getMonth(); // 0-indexed

  const monthName = baseDate.toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });

  // Calculate 6-month window bounds
  const loadCalendarData = async () => {
    setLoading(true);
    setErrorNotice(null);
    try {
      // Load current displayed month + padding
      const startOfMonth = new Date(displayedYear, displayedMonth, 1);
      const endOfMonth = new Date(displayedYear, displayedMonth + 1, 0);

      const startDateStr = formatDateStr(startOfMonth);
      const endDateStr = formatDateStr(endOfMonth);

      const data = await aadiSparshRepository.getCalendarAvailability(
        templeId,
        startDateStr,
        endDateStr
      );
      setAvailability(data);
    } catch (err: unknown) {
      setErrorNotice('Could not load calendar availability. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCalendarData();
  }, [templeId, displayedYear, displayedMonth]);

  // Construct calendar grid: find day-of-week for 1st of month (0 = Sun, 1 = Mon, ...)
  const firstDayOfWeek = new Date(displayedYear, displayedMonth, 1).getDay();
  const totalDaysInMonth = new Date(displayedYear, displayedMonth + 1, 0).getDate();

  // Create lookup map for date availability
  const availabilityMap = new Map<string, DayAvailability>();
  for (const item of availability) {
    availabilityMap.set(item.calendar_date, item);
  }

  const daysGrid: (DayAvailability | null)[] = [];
  // Leading empty padding
  for (let i = 0; i < firstDayOfWeek; i++) {
    daysGrid.push(null);
  }
  // Days of month
  for (let day = 1; day <= totalDaysInMonth; day++) {
    const dt = new Date(displayedYear, displayedMonth, day);
    const dateStr = formatDateStr(dt);
    const item = availabilityMap.get(dateStr) || {
      calendar_date: dateStr,
      active_family_bookings: 0,
      capacity: 15,
      slots_remaining: 15,
      is_available: false,
      is_closed: false,
      is_past: dateStr <= nowKolkata.dateStr,
      is_cutoff_passed: false,
    };
    daysGrid.push(item);
  }

  const handleDayClick = (item: DayAvailability) => {
    if (!item.is_available) {
      if (item.is_past) {
        setErrorNotice('Past dates cannot be selected. Temple visits must be scheduled in advance.');
      } else if (item.is_cutoff_passed) {
        setErrorNotice(
          `The registration cutoff (${bookingCutoffTime}) for tomorrow's visit has passed. Please select a later date.`
        );
      } else if (item.is_closed) {
        setErrorNotice(
          item.closure_reason
            ? `Temple Unavailable: ${item.closure_reason}`
            : 'Temple is closed on this day for sanctuary maintenance.'
        );
      } else if (item.slots_remaining === 0) {
        setErrorNotice(
          'Daily Capacity Filled: All 15 family reservation slots are currently booked for this date.'
        );
      }
      return;
    }

    setErrorNotice(null);
    onSelectDate(item.calendar_date);
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200/90 shadow-2xs overflow-hidden">
      {/* Calendar Header with Serene Navigation */}
      <div className="bg-[#FAF7F2] px-5 py-4 border-b border-stone-200/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-amber-800" />
          <h4 className="font-serif font-semibold text-stone-900 text-base">
            {monthName}
          </h4>
          <span className="text-[11px] font-mono text-stone-500 bg-stone-200/70 px-2 py-0.5 rounded">
            Asia/Kolkata
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={monthOffset <= 0}
            onClick={() => setMonthOffset((prev) => Math.max(0, prev - 1))}
            className="p-1.5 rounded text-stone-600 hover:text-stone-950 hover:bg-stone-200/60 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            title="Previous month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-stone-500 font-medium px-2">
            Month {monthOffset + 1} of {rollingMonths}
          </span>
          <button
            type="button"
            disabled={monthOffset >= rollingMonths - 1}
            onClick={() => setMonthOffset((prev) => Math.min(rollingMonths - 1, prev + 1))}
            className="p-1.5 rounded text-stone-600 hover:text-stone-950 hover:bg-stone-200/60 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            title="Next month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Selected Date Summary Banner */}
      {selectedDate && (
        <div className="bg-emerald-50/80 border-b border-emerald-200/70 px-5 py-2.5 flex items-center justify-between text-xs text-emerald-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>
              Selected Visit Date:{' '}
              <strong className="font-semibold">{formatDisplayDate(selectedDate)}</strong>
            </span>
          </div>
          <span className="font-mono text-[11px] text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded">
            6:00 AM – 8:00 AM Window
          </span>
        </div>
      )}

      {/* Notice / Warning Bar */}
      {errorNotice && (
        <div className="bg-amber-50 border-b border-amber-200/70 px-5 py-2.5 flex items-start gap-2 text-xs text-amber-900">
          <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="flex-1">{errorNotice}</div>
          <button
            onClick={() => setErrorNotice(null)}
            className="text-stone-400 hover:text-stone-700 text-xs font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Weekday Header */}
      <div className="grid grid-cols-7 border-b border-stone-200/80 text-center bg-stone-50/70 text-[11px] font-semibold text-stone-600 uppercase tracking-wider py-2">
        <div className="text-amber-900/70">Sun</div>
        <div>Mon</div>
        <div>Tue</div>
        <div>Wed</div>
        <div>Thu</div>
        <div>Fri</div>
        <div>Sat</div>
      </div>

      {/* Days Grid */}
      <div className="p-3">
        {loading ? (
          <div className="py-16 text-center text-xs text-stone-500 space-y-2">
            <Clock className="w-5 h-5 text-amber-800 animate-spin mx-auto" />
            <p>Querying temple calendar availability...</p>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1.5">
            {daysGrid.map((dayItem, idx) => {
              if (!dayItem) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="aspect-square bg-stone-50/30 rounded border border-transparent"
                  />
                );
              }

              const dayNumber = parseLocalDate(dayItem.calendar_date).getDate();
              const isSelected = selectedDate === dayItem.calendar_date;

              // Styles based on status
              let cellClass = '';
              let badgeText = '';

              if (dayItem.is_past) {
                cellClass =
                  'bg-stone-100/70 border-stone-200/60 text-stone-400 cursor-not-allowed';
                badgeText = 'Past';
              } else if (dayItem.is_closed) {
                cellClass =
                  'bg-amber-50/40 border-dashed border-amber-200/70 text-stone-400 cursor-not-allowed';
                badgeText = 'Closed';
              } else if (dayItem.is_cutoff_passed) {
                cellClass =
                  'bg-stone-100/80 border-stone-200 text-stone-400 cursor-not-allowed';
                badgeText = 'Cutoff';
              } else if (dayItem.slots_remaining === 0) {
                cellClass =
                  'bg-red-50/50 border-red-200/70 text-red-700/80 cursor-not-allowed';
                badgeText = 'Full';
              } else {
                // Available
                cellClass = isSelected
                  ? 'bg-amber-800 text-white border-amber-900 shadow-xs cursor-pointer ring-2 ring-amber-800 ring-offset-1'
                  : 'bg-white hover:bg-emerald-50/60 border-stone-200 hover:border-emerald-500 text-stone-900 cursor-pointer transition-colors';
                badgeText = `${dayItem.slots_remaining} left`;
              }

              return (
                <button
                  type="button"
                  key={dayItem.calendar_date}
                  onClick={() => handleDayClick(dayItem)}
                  className={`aspect-square p-1.5 rounded-lg border flex flex-col justify-between text-left transition-all relative group ${cellClass}`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`text-xs font-semibold ${
                        isSelected
                          ? 'text-white'
                          : dayItem.is_past || dayItem.is_closed
                          ? 'text-stone-400'
                          : 'text-stone-800'
                      }`}
                    >
                      {dayNumber}
                    </span>
                    {dayItem.is_available && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isSelected ? 'bg-white' : 'bg-emerald-600'
                        }`}
                      />
                    )}
                  </div>

                  {/* Slot availability tag */}
                  <div className="w-full text-right">
                    <span
                      className={`text-[9px] font-mono leading-none block truncate ${
                        isSelected
                          ? 'text-amber-100'
                          : dayItem.is_available
                          ? 'text-emerald-700 font-medium'
                          : 'text-stone-400'
                      }`}
                    >
                      {badgeText}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Legend & Policy Footer */}
      <div className="bg-[#FAF7F2] px-5 py-3 border-t border-stone-200/80 flex flex-wrap items-center justify-between gap-3 text-[11px] text-stone-600">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
            <span>Available (Max 15 Families/day)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-200 border border-amber-400" />
            <span>Sundays Closed (Maintenance)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <span>Fully Booked</span>
          </div>
        </div>

        <div className="text-[10px] text-stone-500 font-mono">
          Cutoff: 6:00 PM on preceding day
        </div>
      </div>
    </div>
  );
};
