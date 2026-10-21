import React, { useEffect, useState } from 'react';
import { Temple } from '../types/database';
import { aadiSparshRepository } from '../lib/supabase';
import { VisitGuideModal } from './VisitGuideModal';
import { MapPin, Clock, Calendar, Compass, Sparkles, ArrowRight, ShieldCheck, Heart } from 'lucide-react';

interface PublicLandingProps {
  onOpenStaffPortal: () => void;
  onOpenBooking: () => void;
  onOpenFamilyAuth: () => void;
}

export const PublicLanding: React.FC<PublicLandingProps> = ({
  onOpenStaffPortal,
  onOpenBooking,
  onOpenFamilyAuth,
}) => {
  const [temple, setTemple] = useState<Temple | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isVisitModalOpen, setIsVisitModalOpen] = useState<boolean>(false);

  useEffect(() => {
    async function loadTemple() {
      setLoading(true);
      const temples = await aadiSparshRepository.getPublicTemples();
      // Chickpet is the verified launch temple
      const chickpet = temples.find((t) => t.slug.includes('chickpet')) || temples[0] || null;
      setTemple(chickpet);
      setLoading(false);
    }
    loadTemple();
  }, []);

  return (
    <div className="space-y-16 sm:space-y-24 py-8 md:py-16 max-w-5xl mx-auto px-4 sm:px-6">
      {/* 1. Welcoming Spiritual Hero Section */}
      <section className="text-center space-y-6 pt-4">
        <div className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-amber-900 font-sans font-medium">
          <Sparkles className="w-3.5 h-3.5 text-amber-800" />
          <span>Shri Jain Shwetambar Murtipujak Initiative</span>
        </div>

        <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl text-stone-900 font-normal leading-tight tracking-tight text-balance">
          Reconnect with Parmatma Pooja & Holy Temple Visits
        </h1>

        <p className="text-stone-600 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
          Aadi Sparsh welcomes Jain families to partake in morning Parmatma Pooja and sacred temple visits,
          reconnecting our community with eternal Jin-Bhakti and spiritual serenity.
        </p>

        {/* Primary Call to Action: "Plan Your Temple Visit" */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => setIsVisitModalOpen(true)}
            className="w-full sm:w-auto px-8 py-3.5 text-sm font-medium text-white bg-amber-800 hover:bg-amber-900 rounded shadow-sm hover:shadow transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            Plan Your Temple Visit
            <ArrowRight className="w-4 h-4" />
          </button>
          <a
            href="#temple-details"
            className="w-full sm:w-auto px-6 py-3.5 text-sm font-medium text-stone-700 hover:text-stone-950 bg-white border border-stone-300 rounded hover:bg-stone-50 transition-colors inline-flex items-center justify-center"
          >
            View Temple Timings
          </a>
        </div>

        <div className="pt-2 text-xs text-stone-500">
          <span>Initial Participating Temple: Shri Adinath Bhagwan Temple, Chickpet, Bengaluru</span>
        </div>
      </section>

      {/* 2. Primary Focus: Shri Adinath Bhagwan Jain Temple, Chickpet */}
      <section id="temple-details" className="scroll-mt-20">
        <div className="bg-white rounded-lg border border-stone-200/90 shadow-xs overflow-hidden">
          {/* Header Banner */}
          <div className="p-6 sm:p-8 border-b border-stone-100 bg-[#FAF7F2]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="text-xs uppercase tracking-wider text-amber-800 font-medium">
                Participating Tirth & Sanctuary
              </div>
              <div className="text-xs text-stone-500">
                Bengaluru, Karnataka · Timezone: Asia/Kolkata
              </div>
            </div>
            <h2 className="font-serif text-2xl sm:text-4xl text-stone-900 font-medium mt-2 leading-snug">
              {temple ? temple.name : 'Shri Adinath Bhagwan Jain Shwetambar Temple'}
            </h2>
            <p className="text-stone-600 text-xs sm:text-sm mt-2 max-w-3xl leading-relaxed">
              {temple
                ? temple.address
                : 'Chickpet Main Road, Near Old Tharagupet, Bengaluru, Karnataka 560053'}
            </p>
          </div>

          {/* Operational Details Grid */}
          <div className="p-6 sm:p-8 space-y-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
              <div className="space-y-1.5 p-4 rounded bg-stone-50 border border-stone-200/70">
                <div className="flex items-center gap-2 text-stone-500 font-medium uppercase tracking-wider text-[11px]">
                  <Clock className="w-3.5 h-3.5 text-amber-800" />
                  Morning Pooja Window
                </div>
                <div className="font-mono text-base font-semibold text-stone-900">
                  {temple ? `${temple.pooja_start_time.slice(0, 5)} AM – ${temple.pooja_end_time.slice(0, 5)} AM` : '06:00 AM – 08:00 AM'}
                </div>
                <p className="text-stone-500 text-[11px] leading-relaxed">
                  Daily morning Parmatma Pooja and snatra timings.
                </p>
              </div>

              <div className="space-y-1.5 p-4 rounded bg-stone-50 border border-stone-200/70">
                <div className="flex items-center gap-2 text-stone-500 font-medium uppercase tracking-wider text-[11px]">
                  <Calendar className="w-3.5 h-3.5 text-amber-800" />
                  Weekly Schedule
                </div>
                <div className="text-sm font-semibold text-stone-900">
                  Open Mon – Sat
                </div>
                <p className="text-stone-500 text-[11px] leading-relaxed">
                  Sundays reserved for temple maintenance & Snatra rituals.
                </p>
              </div>

              <div className="space-y-1.5 p-4 rounded bg-stone-50 border border-stone-200/70">
                <div className="flex items-center gap-2 text-stone-500 font-medium uppercase tracking-wider text-[11px]">
                  <Compass className="w-3.5 h-3.5 text-amber-800" />
                  How to Reach
                </div>
                <div className="text-sm font-semibold text-stone-900">
                  Chickpet Metro (~600m)
                </div>
                <p className="text-stone-500 text-[11px] leading-relaxed">
                  Green Line metro recommended; narrow market lane with limited car parking.
                </p>
              </div>
            </div>

            {/* Sacred Visiting Guidelines */}
            <div className="space-y-3 pt-2">
              <h3 className="font-serif text-lg font-medium text-stone-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-800" />
                Visiting Guidelines & Sanctity Protocol
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-stone-600">
                <div className="p-4 bg-white rounded border border-stone-200 space-y-1.5">
                  <div className="font-semibold text-stone-900">Pavitra Vastra (Attire)</div>
                  <p className="leading-relaxed">
                    Devotees performing morning pooja in the sanctum must wear freshly washed, clean traditional pooja vastra (Dhoti-Khes for men; traditional vastra for women).
                  </p>
                </div>
                <div className="p-4 bg-white rounded border border-stone-200 space-y-1.5">
                  <div className="font-semibold text-stone-900">Sanctum Sanctity</div>
                  <p className="leading-relaxed">
                    Maintain peaceful silence inside the temple. Mobile devices must remain silent. In adherence to Ahimsa, leather articles are not permitted inside the sanctum.
                  </p>
                </div>
              </div>
            </div>

            {/* Devotee Action Banner */}
            <div className="p-5 bg-amber-50/60 rounded border border-amber-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 text-xs">
                <div className="font-semibold text-amber-900">
                  Preparing to visit with your family?
                </div>
                <p className="text-stone-600">
                  Review timings, arrival advisory, and pooja guidelines before coming.
                </p>
              </div>
              <button
                onClick={() => setIsVisitModalOpen(true)}
                className="px-5 py-2.5 text-xs font-medium text-white bg-amber-800 hover:bg-amber-900 rounded shrink-0 transition-colors cursor-pointer"
              >
                Open Visit Guide
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 3. About Aadi Sparsh Mission */}
      <section className="bg-white rounded-lg border border-stone-200/80 p-8 sm:p-10 space-y-6">
        <div className="max-w-2xl space-y-2">
          <div className="text-xs uppercase tracking-wider text-amber-800 font-medium">
            Our Purpose
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl text-stone-900 font-medium">
            Helping Jain Families Reconnect with Temple Visits
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-stone-600 leading-relaxed">
          <div className="space-y-2">
            <div className="font-semibold text-stone-900 flex items-center gap-1.5 text-sm">
              <Heart className="w-4 h-4 text-amber-800" />
              Preserving Jin-Bhakti
            </div>
            <p>
              Encouraging regular family participation in morning snatra and pooja rituals across generations,
              deepening spiritual roots.
            </p>
          </div>

          <div className="space-y-2">
            <div className="font-semibold text-stone-900 flex items-center gap-1.5 text-sm">
              <ShieldCheck className="w-4 h-4 text-amber-800" />
              Serene Atmosphere
            </div>
            <p>
              Ensuring peaceful, orderly pooja experiences for every attending family without rush,
              noise, or overcrowded sanctums.
            </p>
          </div>

          <div className="space-y-2">
            <div className="font-semibold text-stone-900 flex items-center gap-1.5 text-sm">
              <Sparkles className="w-4 h-4 text-amber-800" />
              Multi-Temple Vision
            </div>
            <p>
              Beginning at historic Chickpet in Bengaluru, with plans to support additional participating
              Jain temples across cities as trusts join the initiative.
            </p>
          </div>
        </div>
      </section>

      {/* 4. Discrete Staff Administration Notice */}
      <section className="text-center pt-4 pb-2 border-t border-stone-200/60">
        <p className="text-xs text-stone-500">
          Temple trust administrators and authorized managers can access operational settings through the{' '}
          <button
            onClick={onOpenStaffPortal}
            className="text-amber-800 hover:text-amber-950 font-medium underline underline-offset-2 cursor-pointer"
          >
            Staff Portal
          </button>
          .
        </p>
      </section>

      {/* Visitor Preparation Modal */}
      <VisitGuideModal
        isOpen={isVisitModalOpen}
        onClose={() => setIsVisitModalOpen(false)}
        onOpenBooking={onOpenBooking}
        onOpenFamilyAuth={onOpenFamilyAuth}
      />
    </div>
  );
};
