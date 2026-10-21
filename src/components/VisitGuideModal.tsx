import React from 'react';
import { Clock, MapPin, Sparkles, AlertCircle, X, Compass, ShieldCheck, UserCheck, CheckCircle2 } from 'lucide-react';

interface VisitGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenFamilyAuth?: () => void;
  onOpenBooking?: () => void;
}

export const VisitGuideModal: React.FC<VisitGuideModalProps> = ({
  isOpen,
  onClose,
  onOpenFamilyAuth,
  onOpenBooking,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <div className="bg-[#FDFBF7] border border-stone-300 rounded-lg max-w-2xl w-full p-6 sm:p-8 shadow-xl space-y-6 relative my-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-stone-400 hover:text-stone-700 p-1.5 rounded transition-colors cursor-pointer"
          aria-label="Close visit guide"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="space-y-1.5 pr-8">
          <div className="text-xs uppercase tracking-widest text-amber-800 font-sans font-medium">
            Visitor Preparation Guide
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl text-stone-900 font-medium tracking-tight">
            Plan Your Temple Visit
          </h2>
          <p className="text-stone-600 text-xs sm:text-sm">
            Shri Adinath Bhagwan Jain Shwetambar Temple · Chickpet, Bengaluru
          </p>
        </div>

        {/* 1. Timings Card */}
        <div className="bg-white rounded border border-stone-200 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-stone-900">
            <Clock className="w-4 h-4 text-amber-800" />
            <span>Pooja & Darshan Timings</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-2.5 bg-stone-50 rounded">
              <div className="text-stone-500 text-[11px]">Morning Parmatma Pooja</div>
              <div className="font-mono text-sm font-semibold text-stone-900 mt-0.5">
                06:00 AM – 08:00 AM
              </div>
              <div className="text-[11px] text-stone-500 mt-1">
                Devotees are advised to arrive by 05:45 AM for snatra preparation.
              </div>
            </div>
            <div className="p-2.5 bg-stone-50 rounded">
              <div className="text-stone-500 text-[11px]">Weekly Closure Notice</div>
              <div className="font-medium text-amber-900 mt-0.5">
                Sundays: Maintenance Schedule
              </div>
              <div className="text-[11px] text-stone-500 mt-1">
                Reserved for trust sanctuary maintenance and traditional Snatra rituals.
              </div>
            </div>
          </div>
        </div>

        {/* 2. Location & Directions */}
        <div className="bg-white rounded border border-stone-200 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-stone-900">
            <MapPin className="w-4 h-4 text-amber-800" />
            <span>Temple Location & How to Reach</span>
          </div>
          <div className="space-y-2 text-xs text-stone-600 leading-relaxed">
            <p className="font-medium text-stone-800">
              Chickpet Main Road, Near Old Tharagupet, Bengaluru, Karnataka 560053
            </p>
            <div className="flex items-start gap-2 pt-1 text-[11px] text-stone-500">
              <Compass className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
              <span>
                <strong>Travel Advisory:</strong> Chickpet market lanes have narrow access. Four-wheeler parking is extremely limited. Devotees are encouraged to arrive via Chickpet Metro Station (Green Line, ~600m walk) or two-wheelers.
              </span>
            </div>
          </div>
        </div>

        {/* 3. Sacred Visiting Guidelines (Pavitra Vastra & Sanctity) */}
        <div className="bg-white rounded border border-stone-200 p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-stone-900">
            <Sparkles className="w-4 h-4 text-amber-800" />
            <span>Visiting Protocol & Sanctity Guidelines</span>
          </div>
          <ul className="text-xs text-stone-600 space-y-2 list-disc pl-4 leading-relaxed">
            <li>
              <strong>Pavitra Vastra:</strong> Devotees entering the sanctum for morning pooja must wear freshly washed, clean traditional pooja attire (Dhoti-Khes for men; traditional saree/vastra for women).
            </li>
            <li>
              <strong>Temple Sanctity:</strong> Maintain peaceful silence in the <em>Garbhagriha</em>. Mobile phones must be kept on silent mode or switched off.
            </li>
            <li>
              <strong>Articles of Leather:</strong> In accordance with Ahimsa principles, leather belts, wallets, and bags should not be brought into the temple premises.
            </li>
          </ul>
        </div>

        {/* 4. Online Registration Status */}
        <div className="p-4 bg-emerald-50/70 rounded border border-emerald-200/80 space-y-3 text-xs text-stone-700">
          <div className="flex items-center gap-2 font-semibold text-emerald-950">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>Online Family Booking Engine Active</span>
          </div>
          <p className="leading-relaxed text-stone-600">
            <strong>Online family pooja registrations are now open for Chickpet Shri Adinath Bhagwan Temple!</strong> To maintain tranquility and reverence in the inner sanctum, reservations are limited to 15 families per day with zero booking fees.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {onOpenBooking && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenBooking();
                }}
                className="py-2.5 px-4 text-xs font-medium text-white bg-amber-800 hover:bg-amber-900 rounded-md transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <span>Book Temple Visit Now</span>
                <Clock className="w-3.5 h-3.5" />
              </button>
            )}

            {onOpenFamilyAuth && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenFamilyAuth();
                }}
                className="py-2 px-3 text-xs font-medium text-stone-700 hover:text-stone-900 bg-white border border-stone-300 rounded transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5 text-stone-500" />
                <span>Manage Family Profile / History</span>
              </button>
            )}
          </div>
          <div className="text-[11px] text-stone-500 flex items-center gap-1.5 pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
            <span>Daily capacity (15 families) and duplicate prevention enforced at database level.</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-2 flex items-center justify-end gap-3 border-t border-stone-200">
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 text-xs font-medium text-stone-600 hover:text-stone-900 border border-stone-300 rounded cursor-pointer transition-colors"
          >
            Print Guidelines
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-medium text-white bg-amber-800 hover:bg-amber-900 rounded cursor-pointer transition-colors"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
};
