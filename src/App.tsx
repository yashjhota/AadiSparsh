import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { PublicLanding } from './components/PublicLanding';
import { StaffSignIn } from './components/StaffSignIn';
import { AdminConsole } from './components/AdminConsole';
import { VisitGuideModal } from './components/VisitGuideModal';
import { FamilyAuthModal } from './components/family/FamilyAuthModal';
import { FamilyProfileModal } from './components/family/FamilyProfileModal';
import { BookingModal } from './components/booking/BookingModal';
import { Temple } from './types/database';
import { aadiSparshRepository } from './lib/supabase';
import { INITIAL_TEMPLES } from './lib/devData';
import { ShieldAlert, User, ArrowLeft } from 'lucide-react';

type AppRoute = 'home' | 'admin';

function MainApp() {
  const { isAuthenticated, currentRole, currentUser } = useAuth();
  const [currentRoute, setCurrentRoute] = useState<AppRoute>('home');
  const [isVisitModalOpen, setIsVisitModalOpen] = useState<boolean>(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState<boolean>(false);
  const [isFamilyAuthOpen, setIsFamilyAuthOpen] = useState<boolean>(false);
  const [isFamilyProfileOpen, setIsFamilyProfileOpen] = useState<boolean>(false);
  const [selectedTemple, setSelectedTemple] = useState<Temple>(INITIAL_TEMPLES[0]);

  // Load verified temples on mount
  useEffect(() => {
    async function loadTemples() {
      try {
        const temples = await aadiSparshRepository.getPublicTemples();
        const chickpet = temples.find((t) => t.slug.includes('chickpet')) || temples[0];
        if (chickpet) {
          setSelectedTemple(chickpet);
        }
      } catch {
        // Fallback to INITIAL_TEMPLES[0]
      }
    }
    loadTemples();
  }, []);

  // Synchronize route with browser URL pathname
  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname;
      if (path.startsWith('/admin') || path.startsWith('/staff')) {
        setCurrentRoute('admin');
      } else {
        setCurrentRoute('home');
      }
    };

    handleLocationChange();
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const navigateTo = (route: AppRoute) => {
    setCurrentRoute(route);
    const targetPath = route === 'admin' ? '/admin' : '/';
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenFamilyPortal = () => {
    if (isAuthenticated) {
      setIsFamilyProfileOpen(true);
    } else {
      setIsFamilyAuthOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#1C1917] flex flex-col font-sans selection:bg-amber-100 selection:text-amber-900">
      {/* Top Navigation */}
      <Header
        currentRoute={currentRoute}
        onPlanVisit={() => setIsBookingModalOpen(true)}
        onOpenGuide={() => setIsVisitModalOpen(true)}
        onNavigateToAdmin={() => navigateTo('admin')}
        onNavigateToHome={() => navigateTo('home')}
        onOpenFamilyPortal={handleOpenFamilyPortal}
      />

      {/* Main View Area */}
      <main className="flex-1">
        {currentRoute === 'home' && (
          <PublicLanding
            onOpenStaffPortal={() => navigateTo('admin')}
            onOpenBooking={() => setIsBookingModalOpen(true)}
            onOpenFamilyAuth={handleOpenFamilyPortal}
          />
        )}

        {currentRoute === 'admin' && (
          isAuthenticated ? (
            // Role Boundary Enforcement: Family users cannot access Admin Console
            currentRole === 'family' ? (
              <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-6">
                <div className="w-14 h-14 bg-amber-100 text-amber-800 rounded-full flex items-center justify-center mx-auto border border-amber-200">
                  <ShieldAlert className="w-7 h-7" />
                </div>
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">
                    Access Boundary
                  </div>
                  <h2 className="font-serif text-2xl text-stone-900 font-semibold">
                    Staff Administration Portal Restricted
                  </h2>
                  <p className="text-xs sm:text-sm text-stone-600 leading-relaxed max-w-md mx-auto">
                    You are signed in as a Devotee Family account (
                    <span className="font-semibold text-stone-800">
                      {currentUser?.full_name || currentUser?.verified_mobile}
                    </span>
                    ). Devotee accounts have access to personal family profiles and temple visit resources, but are strictly prohibited from administering temple operational configurations, capacities, or staff permissions.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    onClick={() => setIsFamilyProfileOpen(true)}
                    className="w-full sm:w-auto px-5 py-2.5 text-xs font-medium text-white bg-amber-800 hover:bg-amber-900 rounded-md transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>View Family Profile & Registrations</span>
                  </button>
                  <button
                    onClick={() => navigateTo('home')}
                    className="w-full sm:w-auto px-5 py-2.5 text-xs font-medium text-stone-700 bg-white border border-stone-300 rounded-md hover:bg-stone-50 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 text-stone-500" />
                    <span>Return to Website</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-6">
                <AdminConsole />
              </div>
            )
          ) : (
            <div className="py-8">
              <StaffSignIn
                onSuccess={() => navigateTo('admin')}
                onCancel={() => navigateTo('home')}
              />
            </div>
          )
        )}
      </main>

      {/* Devotee Visit Guide Modal */}
      <VisitGuideModal
        isOpen={isVisitModalOpen}
        onClose={() => setIsVisitModalOpen(false)}
        onOpenFamilyAuth={handleOpenFamilyPortal}
        onOpenBooking={() => setIsBookingModalOpen(true)}
      />

      {/* Interactive Family Booking & Capacity Modal */}
      {selectedTemple && (
        <BookingModal
          isOpen={isBookingModalOpen}
          onClose={() => setIsBookingModalOpen(false)}
          temple={selectedTemple}
          onOpenAuth={handleOpenFamilyPortal}
          onViewMyRegistrations={() => {
            setIsBookingModalOpen(false);
            setIsFamilyProfileOpen(true);
          }}
        />
      )}

      {/* Family Mobile OTP Authentication Modal */}
      <FamilyAuthModal
        isOpen={isFamilyAuthOpen}
        onClose={() => setIsFamilyAuthOpen(false)}
        onAuthenticated={() => {
          setIsFamilyAuthOpen(false);
          setIsFamilyProfileOpen(true);
        }}
      />

      {/* Family Profile Viewing & Updating Modal */}
      <FamilyProfileModal
        isOpen={isFamilyProfileOpen}
        onClose={() => setIsFamilyProfileOpen(false)}
      />

      {/* Serene Institutional Footer */}
      <footer className="border-t border-stone-200/80 bg-[#FAF7F2] py-12 px-6 mt-16 text-xs text-stone-600">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center sm:text-left">
            <div className="font-serif font-semibold text-stone-900 tracking-wider text-sm">
              AADI SPARSH
            </div>
            <p className="text-stone-500 text-xs">
              Parmatma Pooja & Temple Visits Initiative · Shri Adinath Bhagwan Temple, Chickpet, Bengaluru
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-stone-500">
            <button
              onClick={() => navigateTo('home')}
              className="hover:text-stone-900 transition-colors cursor-pointer"
            >
              Temple Information
            </button>
            <button
              onClick={() => setIsVisitModalOpen(true)}
              className="hover:text-stone-900 transition-colors cursor-pointer"
            >
              Plan Your Visit
            </button>
            <button
              onClick={handleOpenFamilyPortal}
              className="hover:text-stone-900 transition-colors cursor-pointer"
            >
              {isAuthenticated && currentRole === 'family' ? 'Family Profile' : 'Devotee Sign In'}
            </button>
            <button
              onClick={() => navigateTo('admin')}
              className="hover:text-stone-900 transition-colors cursor-pointer text-stone-400"
            >
              Staff Portal
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
