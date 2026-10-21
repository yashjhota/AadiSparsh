import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, ArrowRight, User, UserCheck } from 'lucide-react';

interface HeaderProps {
  onPlanVisit: () => void;
  onOpenGuide?: () => void;
  onNavigateToAdmin: () => void;
  onNavigateToHome: () => void;
  onOpenFamilyPortal: () => void;
  currentRoute: 'home' | 'admin';
}

export const Header: React.FC<HeaderProps> = ({
  onPlanVisit,
  onOpenGuide,
  onNavigateToAdmin,
  onNavigateToHome,
  onOpenFamilyPortal,
  currentRoute,
}) => {
  const { isAuthenticated, currentRole, currentUser, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-[#FDFBF7]/95 backdrop-blur-sm border-b border-stone-200/80 px-4 sm:px-6 lg:px-12 py-3.5 transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Zone 1: Wordmark */}
        <button
          onClick={onNavigateToHome}
          className="text-left group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700/40 rounded-sm"
        >
          <div className="font-serif text-xl tracking-wider text-stone-900 group-hover:text-amber-800 transition-colors whitespace-nowrap shrink-0 font-semibold">
            AADI SPARSH
          </div>
        </button>

        {/* Zone 2: Navigation Links */}
        {currentRoute === 'home' ? (
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-stone-600">
            <button
              onClick={() => {
                const el = document.getElementById('temple-details');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="whitespace-nowrap shrink-0 hover:text-stone-900 transition-colors cursor-pointer"
            >
              Chickpet Temple
            </button>
            <button
              onClick={() => {
                const el = document.getElementById('temple-details');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="whitespace-nowrap shrink-0 hover:text-stone-900 transition-colors cursor-pointer"
            >
              Pooja Timings
            </button>
            <button
              onClick={onOpenGuide || onPlanVisit}
              className="whitespace-nowrap shrink-0 hover:text-stone-900 transition-colors cursor-pointer"
            >
              Visiting Guidelines
            </button>
            <button
              onClick={onNavigateToAdmin}
              className="whitespace-nowrap shrink-0 text-stone-400 hover:text-stone-700 transition-colors text-xs flex items-center gap-1 cursor-pointer ml-2"
            >
              <Lock className="w-3 h-3 text-stone-400" />
              Staff Portal
            </button>
          </nav>
        ) : (
          <div className="flex items-center gap-2 text-xs text-stone-500">
            <span className="font-semibold text-stone-800">Staff Administration Portal</span>
            <span aria-hidden="true">·</span>
            <span>Chickpet Temple Governance</span>
          </div>
        )}

        {/* Zone 3: Actions */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {currentRoute === 'home' ? (
            <>
              {/* Devotee / Family Portal Button */}
              {isAuthenticated && currentRole === 'family' ? (
                <button
                  onClick={onOpenFamilyPortal}
                  className="px-3 py-1.5 text-xs font-medium text-amber-950 bg-amber-100/70 hover:bg-amber-200/70 border border-amber-300 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
                >
                  <UserCheck className="w-3.5 h-3.5 text-amber-800" />
                  <span>Family Profile</span>
                </button>
              ) : isAuthenticated && currentRole !== 'family' ? (
                <button
                  onClick={onNavigateToAdmin}
                  className="px-3 py-1.5 text-xs font-medium text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-700" />
                  <span>Admin ({currentRole})</span>
                </button>
              ) : (
                <button
                  onClick={onOpenFamilyPortal}
                  className="px-3 py-1.5 text-xs font-medium text-stone-700 bg-white hover:bg-stone-50 border border-stone-300 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
                >
                  <User className="w-3.5 h-3.5 text-amber-800" />
                  <span>Devotee Sign In</span>
                </button>
              )}

              {/* Primary Call to Action */}
              <button
                onClick={onPlanVisit}
                className="px-3.5 py-1.5 text-xs font-medium text-white bg-amber-800 hover:bg-amber-900 rounded shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5"
              >
                <span>Plan Your Visit</span>
                <ArrowRight className="w-3.5 h-3.5 hidden sm:inline" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={onNavigateToHome}
                className="px-3 py-1.5 text-xs font-medium text-stone-700 bg-white border border-stone-300 rounded hover:bg-stone-50 transition-colors cursor-pointer"
              >
                Return to Website
              </button>
              {isAuthenticated && (
                <button
                  onClick={signOut}
                  className="px-3 py-1.5 text-xs font-medium text-stone-600 hover:text-stone-900 border border-transparent hover:border-stone-200 rounded transition-colors cursor-pointer"
                >
                  Sign Out ({currentRole})
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
