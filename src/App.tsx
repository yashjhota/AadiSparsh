import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { PublicLanding } from './components/PublicLanding';
import { StaffSignIn } from './components/StaffSignIn';
import { AdminConsole } from './components/AdminConsole';
import { VisitGuideModal } from './components/VisitGuideModal';

type AppRoute = 'home' | 'admin';

function MainApp() {
  const { isAuthenticated } = useAuth();
  const [currentRoute, setCurrentRoute] = useState<AppRoute>('home');
  const [isVisitModalOpen, setIsVisitModalOpen] = useState<boolean>(false);

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

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-[#1C1917] flex flex-col font-sans selection:bg-amber-100 selection:text-amber-900">
      {/* Top Navigation */}
      <Header
        currentRoute={currentRoute}
        onPlanVisit={() => setIsVisitModalOpen(true)}
        onNavigateToAdmin={() => navigateTo('admin')}
        onNavigateToHome={() => navigateTo('home')}
      />

      {/* Main View Area */}
      <main className="flex-1">
        {currentRoute === 'home' && (
          <PublicLanding onOpenStaffPortal={() => navigateTo('admin')} />
        )}

        {currentRoute === 'admin' && (
          isAuthenticated ? (
            <div className="py-6">
              <AdminConsole />
            </div>
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
