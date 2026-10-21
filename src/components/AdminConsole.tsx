import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Organization,
  City,
  Temple,
  TempleMembership,
  AuditLog,
  UserRole,
  Registration,
} from '../types/database';
import { aadiSparshRepository } from '../lib/supabase';
import { DEV_TEST_PERSONAS } from '../lib/devData';
import { formatDisplayDate, getKolkataNow } from '../lib/dateTime';
import {
  Building2,
  MapPin,
  Calendar,
  Users,
  ScrollText,
  Database,
  Sliders,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  Eye,
  AlertCircle,
  Copy,
  Check,
} from 'lucide-react';

type AdminTab =
  | 'overview'
  | 'registrations'
  | 'organizations'
  | 'cities'
  | 'temples'
  | 'staff'
  | 'audit'
  | 'migrations'
  | 'settings';

export const AdminConsole: React.FC = () => {
  const {
    currentUser,
    currentRole,
    activeTempleId,
    activeTempleName,
    startDevSandboxSession,
    isDevSandboxSession,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState<boolean>(true);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Entities state
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [temples, setTemples] = useState<Temple[]>([]);
  const [memberships, setMemberships] = useState<TempleMembership[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [registrations, setRegistrations] = useState<Registration[]>([]);

  // Registrations filtering & inspection state
  const [regDateFilter, setRegDateFilter] = useState<string>('');
  const [regSearchTerm, setRegSearchTerm] = useState<string>('');
  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null);

  // Modals & form state
  const [editingTemple, setEditingTemple] = useState<Temple | null>(null);
  const [isNewTempleModalOpen, setIsNewTempleModalOpen] = useState<boolean>(false);
  const [isNewCityModalOpen, setIsNewCityModalOpen] = useState<boolean>(false);
  const [isAssignStaffModalOpen, setIsAssignStaffModalOpen] = useState<boolean>(false);
  const [selectedAuditLog, setSelectedAuditLog] = useState<AuditLog | null>(null);
  const [copiedMigrationIndex, setCopiedMigrationIndex] = useState<number | null>(null);

  // New temple form
  const [newTempleForm, setNewTempleForm] = useState({
    name: '',
    slug: '',
    city_id: '',
    address: '',
    daily_family_capacity: 15,
    pooja_start_time: '06:00:00',
    pooja_end_time: '08:00:00',
    booking_cutoff_time: '18:00:00',
    rolling_booking_months: 6,
    closure_sunday: true,
  });

  // New city form
  const [newCityForm, setNewCityForm] = useState({
    name: '',
    state: '',
    country: 'India',
    timezone: 'Asia/Kolkata',
  });

  // New staff assignment form
  const [staffForm, setStaffForm] = useState<{
    userId: string;
    templeId: string;
    role: UserRole;
  }>({
    userId: '',
    templeId: '',
    role: 'temple_manager',
  });

  const loadAllData = async () => {
    if (!currentRole) return;
    setLoading(true);
    try {
      const [orgsData, citiesData, templesData, memsData, logsData, regsData] = await Promise.all([
        aadiSparshRepository.getOrganizations(),
        aadiSparshRepository.getCities(),
        aadiSparshRepository.getTemplesForActor(currentRole, activeTempleId),
        aadiSparshRepository.getMemberships(currentRole, activeTempleId),
        aadiSparshRepository.getAuditLogs(currentRole, activeTempleId),
        aadiSparshRepository.getStaffRegistrations(currentRole, activeTempleId),
      ]);
      setOrganizations(orgsData);
      setCities(citiesData);
      setTemples(templesData);
      setMemberships(memsData);
      setAuditLogs(logsData);
      setRegistrations(regsData);
    } catch (err: unknown) {
      setNotice({ type: 'error', message: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, [currentRole, activeTempleId]);

  // Handle Edit Temple
  const handleSaveTempleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemple || !currentUser || !currentRole) return;

    const res = await aadiSparshRepository.updateTemple(
      editingTemple.id,
      {
        name: editingTemple.name,
        pooja_start_time: editingTemple.pooja_start_time,
        pooja_end_time: editingTemple.pooja_end_time,
        daily_family_capacity: Number(editingTemple.daily_family_capacity),
        rolling_booking_months: Number(editingTemple.rolling_booking_months),
        booking_cutoff_time: editingTemple.booking_cutoff_time,
        registration_enabled: editingTemple.registration_enabled,
      },
      currentUser.id,
      currentRole,
      activeTempleId,
      `${currentUser.full_name} (${currentRole})`
    );

    if (res.success) {
      setNotice({ type: 'success', message: 'Temple configuration updated and recorded in audit log.' });
      setEditingTemple(null);
      loadAllData();
    } else {
      setNotice({ type: 'error', message: res.error || 'Failed to update temple.' });
    }
  };

  // Handle Create Temple
  const handleCreateTemple = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !currentRole || organizations.length === 0) return;

    const orgId = organizations[0].id;
    const res = await aadiSparshRepository.createTemple(
      {
        organization_id: orgId,
        city_id: newTempleForm.city_id || (cities[0] ? cities[0].id : ''),
        name: newTempleForm.name,
        slug: newTempleForm.slug || newTempleForm.name.toLowerCase().replace(/\s+/g, '-'),
        address: newTempleForm.address,
        timezone: 'Asia/Kolkata',
        pooja_start_time: newTempleForm.pooja_start_time,
        pooja_end_time: newTempleForm.pooja_end_time,
        daily_family_capacity: Number(newTempleForm.daily_family_capacity),
        registration_enabled: true,
        rolling_booking_months: Number(newTempleForm.rolling_booking_months),
        booking_cutoff_time: newTempleForm.booking_cutoff_time,
        closure_rules: {
          closed_days_of_week: newTempleForm.closure_sunday ? [0] : [],
          closure_reason: newTempleForm.closure_sunday ? 'Sunday sanctuary maintenance' : 'Open daily',
        },
        status: 'active',
      },
      currentUser.id,
      currentRole,
      currentUser.full_name
    );

    if (res.success) {
      setNotice({ type: 'success', message: 'New temple tenant registered and initialized.' });
      setIsNewTempleModalOpen(false);
      setNewTempleForm({
        name: '',
        slug: '',
        city_id: '',
        address: '',
        daily_family_capacity: 15,
        pooja_start_time: '06:00:00',
        pooja_end_time: '08:00:00',
        booking_cutoff_time: '18:00:00',
        rolling_booking_months: 6,
        closure_sunday: true,
      });
      loadAllData();
    } else {
      setNotice({ type: 'error', message: res.error || 'Could not create temple.' });
    }
  };

  // Handle Create City
  const handleCreateCity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !currentRole || organizations.length === 0) return;

    const res = await aadiSparshRepository.createCity(
      {
        organization_id: organizations[0].id,
        name: newCityForm.name,
        state: newCityForm.state,
        country: newCityForm.country,
        timezone: newCityForm.timezone,
      },
      currentRole
    );

    if (res.success) {
      setNotice({ type: 'success', message: `City '${newCityForm.name}' created.` });
      setIsNewCityModalOpen(false);
      setNewCityForm({ name: '', state: '', country: 'India', timezone: 'Asia/Kolkata' });
      loadAllData();
    } else {
      setNotice({ type: 'error', message: res.error || 'Failed to create city.' });
    }
  };

  // Handle Assign Staff
  const handleAssignStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !currentRole) return;

    const res = await aadiSparshRepository.assignMembership(
      {
        userId: staffForm.userId || aadiSparshRepository.getProfiles()[0].id,
        organizationId: organizations[0]?.id || '',
        templeId: staffForm.templeId ? staffForm.templeId : null,
        role: staffForm.role,
      },
      currentUser.id,
      currentRole,
      activeTempleId,
      currentUser.full_name
    );

    if (res.success) {
      setNotice({ type: 'success', message: 'Staff role membership granted successfully.' });
      setIsAssignStaffModalOpen(false);
      loadAllData();
    } else {
      setNotice({ type: 'error', message: res.error || 'Permission denied.' });
    }
  };

  const copySqlMigration = (sqlText: string, index: number) => {
    navigator.clipboard.writeText(sqlText);
    setCopiedMigrationIndex(index);
    setTimeout(() => setCopiedMigrationIndex(null), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* 1. Dynamic Role Persona Harness Banner (Anti-Slop test harness) */}
      <div className="bg-[#FAF7F2] border border-stone-200 rounded-lg p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-widest text-amber-800 font-medium">
            Active Security Context & Tenant Scope
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm text-stone-900">
            <span className="font-semibold">{currentUser?.full_name}</span>
            <span aria-hidden="true" className="text-stone-300">·</span>
            <span className="font-mono text-xs uppercase bg-stone-200 px-2 py-0.5 rounded text-stone-800">
              Role: {currentRole}
            </span>
            <span aria-hidden="true" className="text-stone-300">·</span>
            <span className="text-stone-600 text-xs">
              Scope: {currentRole === 'superadmin' ? 'Global Federation (All Temples)' : activeTempleName}
            </span>
          </div>
        </div>

        {/* Live Persona Switcher Buttons to test RLS in real time (Development Only) */}
        {import.meta.env.DEV && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-stone-500 mr-1">Switch Persona (DEV):</span>
            {DEV_TEST_PERSONAS.map((p, idx) => (
              <button
                key={p.role}
                onClick={() => startDevSandboxSession(idx)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors cursor-pointer ${
                  currentRole === p.role && activeTempleId === p.templeId
                    ? 'bg-amber-800 text-white'
                    : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-100'
                }`}
              >
                {p.role === 'superadmin' ? 'Superadmin' : p.role === 'temple_admin' ? 'Temple Admin' : p.role === 'temple_manager' ? 'Manager' : 'Family'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Global Notification Banner */}
      {notice && (
        <div
          className={`p-3.5 text-xs rounded border flex items-center justify-between gap-3 ${
            notice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{notice.message}</span>
          </div>
          <button
            onClick={() => setNotice(null)}
            className="text-stone-500 hover:text-stone-800 font-bold cursor-pointer text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* RLS Guard: Family Devotee accounts cannot view or modify administrative workspace */}
      {currentRole === 'family' ? (
        <div className="bg-white border border-stone-200 rounded-lg p-8 sm:p-12 text-center space-y-4 max-w-2xl mx-auto my-8 shadow-xs">
          <ShieldAlert className="w-10 h-10 text-amber-800 mx-auto" />
          <h3 className="font-serif text-2xl font-medium text-stone-900">
            Devotee Family Account — Console Restricted
          </h3>
          <p className="text-stone-600 text-xs sm:text-sm leading-relaxed">
            Your profile is registered as a devotee family. Under Aadi Sparsh Row Level Security (RLS) rules, administrative operations (organizations, operational cities, temple capacities, staff assignments, and audit trails) are restricted to Superadmins and Temple Staff.
          </p>
          <p className="text-stone-500 text-xs">
            Family visit and Parmatma Pooja booking workflows are coming in Phase 2.
          </p>
        </div>
      ) : (
        <>

      {/* 2. Workspace Navigation Bar */}
      <div className="border-b border-stone-200 flex items-center justify-between gap-4 overflow-x-auto pb-px">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'overview'
                ? 'border-amber-800 text-amber-900 font-semibold'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('registrations')}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'registrations'
                ? 'border-amber-800 text-amber-900 font-semibold'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            Registrations ({registrations.length})
          </button>
          <button
            onClick={() => setActiveTab('organizations')}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'organizations'
                ? 'border-amber-800 text-amber-900 font-semibold'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            Organizations ({organizations.length})
          </button>
          <button
            onClick={() => setActiveTab('cities')}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'cities'
                ? 'border-amber-800 text-amber-900 font-semibold'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            Cities ({cities.length})
          </button>
          <button
            onClick={() => setActiveTab('temples')}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'temples'
                ? 'border-amber-800 text-amber-900 font-semibold'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            Temples ({temples.length})
          </button>
          <button
            onClick={() => setActiveTab('staff')}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'staff'
                ? 'border-amber-800 text-amber-900 font-semibold'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            Staff & Roles ({memberships.length})
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'audit'
                ? 'border-amber-800 text-amber-900 font-semibold'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            Audit Logs ({auditLogs.length})
          </button>
          <button
            onClick={() => setActiveTab('migrations')}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'migrations'
                ? 'border-amber-800 text-amber-900 font-semibold'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            SQL Migrations & Schema
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === 'settings'
                ? 'border-amber-800 text-amber-900 font-semibold'
                : 'border-transparent text-stone-600 hover:text-stone-900'
            }`}
          >
            Phase 2 Architecture Guard
          </button>
        </div>

        <button
          onClick={loadAllData}
          className="p-1.5 text-stone-500 hover:text-stone-900 rounded transition-colors cursor-pointer"
          title="Refresh dataset"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* 3. Tab Views */}

      {/* --- TAB: OVERVIEW --- */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-lg border border-stone-200 space-y-1">
              <div className="text-xs uppercase tracking-wider text-stone-500 font-medium">
                Active Organizations
              </div>
              <div className="font-mono tabular-nums text-2xl font-semibold text-stone-900">
                {organizations.length}
              </div>
              <div className="text-[11px] text-stone-500">Jain Trust Federations</div>
            </div>

            <div className="bg-white p-5 rounded-lg border border-stone-200 space-y-1">
              <div className="text-xs uppercase tracking-wider text-stone-500 font-medium">
                Participating Cities
              </div>
              <div className="font-mono tabular-nums text-2xl font-semibold text-stone-900">
                {cities.length}
              </div>
              <div className="text-[11px] text-stone-500">Bengaluru, Chennai, etc.</div>
            </div>

            <div className="bg-white p-5 rounded-lg border border-stone-200 space-y-1">
              <div className="text-xs uppercase tracking-wider text-stone-500 font-medium">
                Configured Temples
              </div>
              <div className="font-mono tabular-nums text-2xl font-semibold text-stone-900">
                {temples.length}
              </div>
              <div className="text-[11px] text-stone-500">Isolated operational tenants</div>
            </div>

            <div className="bg-white p-5 rounded-lg border border-stone-200 space-y-1">
              <div className="text-xs uppercase tracking-wider text-stone-500 font-medium">
                Total Daily Pooja Capacity
              </div>
              <div className="font-mono tabular-nums text-2xl font-semibold text-stone-900">
                {temples.reduce((acc, t) => acc + t.daily_family_capacity, 0)}
              </div>
              <div className="text-[11px] text-stone-500">Families per day across system</div>
            </div>
          </div>

          {/* Quick Access Temple Card */}
          <div className="bg-white rounded-lg border border-stone-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-serif text-lg font-medium text-stone-900">
                  Initial Launch Temple: Chickpet, Bengaluru
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Shri Adinath Bhagwan Jain Temple operational settings loaded from PostgreSQL.
                </p>
              </div>
              {currentRole === 'superadmin' || (currentRole === 'temple_admin' && activeTempleId?.includes('chickpet')) ? (
                <button
                  onClick={() => {
                    const chickpet = temples.find((t) => t.slug.includes('chickpet'));
                    if (chickpet) setEditingTemple(chickpet);
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-amber-800 hover:bg-amber-900 rounded transition-colors cursor-pointer"
                >
                  Edit Configuration
                </button>
              ) : (
                <span className="text-xs text-stone-400">Read-Only View</span>
              )}
            </div>

            {temples.find((t) => t.slug.includes('chickpet')) && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-stone-50 rounded border border-stone-200/60 text-xs">
                <div>
                  <div className="text-stone-400 text-[11px]">Pooja Window</div>
                  <div className="font-mono font-medium text-stone-800 mt-0.5">
                    {temples.find((t) => t.slug.includes('chickpet'))?.pooja_start_time.slice(0, 5)} –{' '}
                    {temples.find((t) => t.slug.includes('chickpet'))?.pooja_end_time.slice(0, 5)} AM
                  </div>
                </div>
                <div>
                  <div className="text-stone-400 text-[11px]">Family Capacity</div>
                  <div className="font-mono font-medium text-stone-800 mt-0.5">
                    {temples.find((t) => t.slug.includes('chickpet'))?.daily_family_capacity} Families/Day
                  </div>
                </div>
                <div>
                  <div className="text-stone-400 text-[11px]">Cutoff Time</div>
                  <div className="font-mono font-medium text-stone-800 mt-0.5">
                    {temples.find((t) => t.slug.includes('chickpet'))?.booking_cutoff_time.slice(0, 5)} Prev Day
                  </div>
                </div>
                <div>
                  <div className="text-stone-400 text-[11px]">Sunday Closure</div>
                  <div className="font-medium text-amber-900 mt-0.5">
                    Closed for Snatra Maintenance
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- TAB: REGISTRATIONS & CAPACITY MANAGEMENT --- */}
      {activeTab === 'registrations' && (
        <div className="space-y-6">
          {/* Header & Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-serif text-lg font-medium text-stone-900">
                Pooja Registrations & Capacity Management
              </h3>
              <p className="text-xs text-stone-500">
                Authoritative devotee family bookings, member attendance counts, and slot availability.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadAllData}
                className="px-3 py-1.5 text-xs font-medium text-stone-700 bg-white border border-stone-300 rounded hover:bg-stone-50 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-stone-500" />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Metric Cards */}
          {(() => {
            const todayStr = getKolkataNow().dateStr;
            const targetDate = regDateFilter || todayStr;
            const targetDateRegs = registrations.filter((r) => r.visit_date === targetDate);
            const activeOnDate = targetDateRegs.filter((r) => r.status === 'upcoming');
            const totalMembersOnDate = activeOnDate.reduce((sum, r) => sum + r.member_count, 0);
            const activeCapacity = 15;
            const remainingOnDate = Math.max(0, activeCapacity - activeOnDate.length);

            return (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-lg border border-stone-200 space-y-1">
                  <div className="text-xs uppercase tracking-wider text-stone-500 font-medium">
                    Active Family Bookings
                  </div>
                  <div className="font-mono tabular-nums text-2xl font-semibold text-stone-900">
                    {activeOnDate.length} <span className="text-xs text-stone-400 font-normal">/ {activeCapacity}</span>
                  </div>
                  <div className="text-[11px] text-stone-500">For {formatDisplayDate(targetDate)}</div>
                </div>

                <div className="bg-white p-5 rounded-lg border border-stone-200 space-y-1">
                  <div className="text-xs uppercase tracking-wider text-stone-500 font-medium">
                    Available Slots
                  </div>
                  <div className="font-mono tabular-nums text-2xl font-semibold text-emerald-700">
                    {remainingOnDate}
                  </div>
                  <div className="text-[11px] text-stone-500">Remaining family slots</div>
                </div>

                <div className="bg-white p-5 rounded-lg border border-stone-200 space-y-1">
                  <div className="text-xs uppercase tracking-wider text-stone-500 font-medium">
                    Expected Devotees
                  </div>
                  <div className="font-mono tabular-nums text-2xl font-semibold text-amber-900">
                    {totalMembersOnDate}
                  </div>
                  <div className="text-[11px] text-stone-500">Attending family members</div>
                </div>

                <div className="bg-white p-5 rounded-lg border border-stone-200 space-y-1">
                  <div className="text-xs uppercase tracking-wider text-stone-500 font-medium">
                    Total In System
                  </div>
                  <div className="font-mono tabular-nums text-2xl font-semibold text-stone-800">
                    {registrations.length}
                  </div>
                  <div className="text-[11px] text-stone-500">All dates (scoped)</div>
                </div>
              </div>
            );
          })()}

          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-lg border border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                  Filter by Visit Date:
                </label>
                <input
                  type="date"
                  value={regDateFilter}
                  onChange={(e) => setRegDateFilter(e.target.value)}
                  className="py-1.5 px-2.5 text-xs bg-stone-50 border border-stone-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-800"
                />
              </div>

              {regDateFilter && (
                <button
                  type="button"
                  onClick={() => setRegDateFilter('')}
                  className="self-end py-1.5 px-2.5 text-[11px] text-stone-600 hover:text-stone-900 border border-stone-200 rounded cursor-pointer"
                >
                  Clear Date Filter (Show All)
                </button>
              )}
            </div>

            <div className="w-full sm:w-72">
              <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                Search Devotee / Registration:
              </label>
              <input
                type="text"
                placeholder="Search Reg #, devotee name, phone..."
                value={regSearchTerm}
                onChange={(e) => setRegSearchTerm(e.target.value)}
                className="w-full py-1.5 px-2.5 text-xs bg-stone-50 border border-stone-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-800"
              />
            </div>
          </div>

          {/* Registrations Table */}
          {(() => {
            let filtered = [...registrations];
            if (regDateFilter) {
              filtered = filtered.filter((r) => r.visit_date === regDateFilter);
            }
            if (regSearchTerm.trim()) {
              const term = regSearchTerm.toLowerCase().trim();
              filtered = filtered.filter(
                (r) =>
                  r.registration_number.toLowerCase().includes(term) ||
                  (r.profile?.full_name && r.profile.full_name.toLowerCase().includes(term)) ||
                  (r.profile?.verified_mobile && r.profile.verified_mobile.includes(term)) ||
                  r.occasion.toLowerCase().includes(term)
              );
            }

            if (filtered.length === 0) {
              return (
                <div className="bg-white p-8 rounded-lg border border-stone-200 text-center text-xs text-stone-500 space-y-2">
                  <Calendar className="w-8 h-8 text-stone-300 mx-auto" />
                  <p className="font-medium text-stone-700">No registrations found matching criteria.</p>
                  <p>Try clearing filters or selecting another date.</p>
                </div>
              );
            }

            return (
              <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-medium">
                    <tr>
                      <th className="px-4 py-3">Registration #</th>
                      <th className="px-4 py-3">Visit Date</th>
                      <th className="px-4 py-3">Devotee Family</th>
                      <th className="px-4 py-3">Members</th>
                      <th className="px-4 py-3">Occasion</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {filtered.map((reg) => (
                      <tr key={reg.id} className="hover:bg-stone-50/60 transition-colors">
                        <td className="px-4 py-3 font-mono font-semibold text-stone-900">
                          {reg.registration_number}
                        </td>
                        <td className="px-4 py-3 text-stone-800">
                          <div>{formatDisplayDate(reg.visit_date)}</div>
                          <span className="text-[10px] text-stone-400 font-mono">6:00 AM – 8:00 AM</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-stone-900">
                            {reg.profile?.full_name || 'Devotee Family'}
                          </div>
                          <div className="text-[11px] font-mono text-stone-500">
                            {reg.profile?.verified_mobile}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-stone-800">
                          {reg.member_count} devotees
                        </td>
                        <td className="px-4 py-3 capitalize text-stone-700">
                          {reg.occasion.replace(/_/g, ' ')}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              reg.status === 'upcoming'
                                ? 'bg-emerald-100 text-emerald-800'
                                : reg.status === 'cancelled'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {reg.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedRegistration(reg)}
                            className="text-amber-800 hover:text-amber-950 font-medium underline text-xs cursor-pointer"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}

      {/* Selected Registration Inspection Modal */}
      {selectedRegistration && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
        >
          <div className="bg-white rounded-lg border border-stone-200 max-w-lg w-full p-6 space-y-4 shadow-xl relative my-6">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-semibold text-stone-400">Registration Detail</span>
                <h4 className="font-mono text-base font-bold text-stone-900">
                  {selectedRegistration.registration_number}
                </h4>
              </div>
              <button
                onClick={() => setSelectedRegistration(null)}
                className="text-stone-400 hover:text-stone-700 p-1 cursor-pointer font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-stone-50 rounded">
                <div>
                  <span className="text-stone-500 block text-[11px]">Visit Date</span>
                  <strong className="text-stone-900">{formatDisplayDate(selectedRegistration.visit_date)}</strong>
                </div>
                <div>
                  <span className="text-stone-500 block text-[11px]">Status</span>
                  <span className="font-semibold uppercase text-stone-900">{selectedRegistration.status}</span>
                </div>
                <div>
                  <span className="text-stone-500 block text-[11px]">Devotee Head</span>
                  <span className="font-medium text-stone-900">{selectedRegistration.profile?.full_name}</span>
                </div>
                <div>
                  <span className="text-stone-500 block text-[11px]">Verified Phone</span>
                  <span className="font-mono">{selectedRegistration.profile?.verified_mobile}</span>
                </div>
                <div>
                  <span className="text-stone-500 block text-[11px]">Attending Count</span>
                  <span>{selectedRegistration.member_count} devotees</span>
                </div>
                <div>
                  <span className="text-stone-500 block text-[11px]">Occasion</span>
                  <span className="capitalize">{selectedRegistration.occasion.replace(/_/g, ' ')}</span>
                </div>
              </div>

              {selectedRegistration.remarks && (
                <div className="p-2.5 bg-stone-50 rounded border border-stone-200">
                  <span className="font-semibold text-stone-700">Devotee Remarks: </span>
                  {selectedRegistration.remarks}
                </div>
              )}

              {selectedRegistration.cancellation_reason && (
                <div className="p-2.5 bg-red-50 text-red-900 rounded border border-red-200">
                  <span className="font-semibold">Cancellation Reason: </span>
                  {selectedRegistration.cancellation_reason}
                </div>
              )}

              <div className="text-[11px] text-stone-500 pt-1">
                Created: {new Date(selectedRegistration.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedRegistration(null)}
                className="px-4 py-2 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB: ORGANIZATIONS --- */}
      {activeTab === 'organizations' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-serif text-lg font-medium text-stone-900">Organizations & Federations</h3>
              <p className="text-xs text-stone-500">Top-level administrative bodies governing participating temples.</p>
            </div>
            {currentRole === 'superadmin' && (
              <button
                onClick={() => setNotice({ type: 'success', message: 'Organization creation is enabled for Superadmin.' })}
                className="px-3.5 py-1.5 text-xs font-medium text-white bg-amber-800 hover:bg-amber-900 rounded flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Organization
              </button>
            )}
          </div>

          <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-500">
                <tr>
                  <th className="py-3 px-4 font-medium">Name</th>
                  <th className="py-3 px-4 font-medium">Slug</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium">Created At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {organizations.map((org) => (
                  <tr key={org.id} className="hover:bg-stone-50/50">
                    <td className="py-3 px-4 font-semibold text-stone-900">{org.name}</td>
                    <td className="py-3 px-4 font-mono text-stone-600">{org.slug}</td>
                    <td className="py-3 px-4">
                      <span className="font-mono uppercase text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        {org.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-stone-500">{new Date(org.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- TAB: CITIES --- */}
      {activeTab === 'cities' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-serif text-lg font-medium text-stone-900">Regional Operational Cities</h3>
              <p className="text-xs text-stone-500">Supporting multi-city deployment (Bengaluru, Chennai, etc.).</p>
            </div>
            {currentRole === 'superadmin' ? (
              <button
                onClick={() => setIsNewCityModalOpen(true)}
                className="px-3.5 py-1.5 text-xs font-medium text-white bg-amber-800 hover:bg-amber-900 rounded flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add City
              </button>
            ) : (
              <span className="text-xs text-stone-400">Only Superadmin can add cities</span>
            )}
          </div>

          <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-500">
                <tr>
                  <th className="py-3 px-4 font-medium">City</th>
                  <th className="py-3 px-4 font-medium">State</th>
                  <th className="py-3 px-4 font-medium">Country</th>
                  <th className="py-3 px-4 font-medium">Timezone</th>
                  <th className="py-3 px-4 font-medium">Temples In City</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {cities.map((city) => (
                  <tr key={city.id} className="hover:bg-stone-50/50">
                    <td className="py-3 px-4 font-semibold text-stone-900">{city.name}</td>
                    <td className="py-3 px-4 text-stone-600">{city.state}</td>
                    <td className="py-3 px-4 text-stone-600">{city.country}</td>
                    <td className="py-3 px-4 font-mono text-stone-500">{city.timezone}</td>
                    <td className="py-3 px-4 font-mono tabular-nums text-stone-800">
                      {temples.filter((t) => t.city_id === city.id).length} Temples
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- TAB: TEMPLES --- */}
      {activeTab === 'temples' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-serif text-lg font-medium text-stone-900">
                Temple Operational Configurations
              </h3>
              <p className="text-xs text-stone-500">
                Independent parameters per temple. Scoped by Row Level Security according to your role.
              </p>
            </div>
            {currentRole === 'superadmin' && (
              <button
                onClick={() => setIsNewTempleModalOpen(true)}
                className="px-3.5 py-1.5 text-xs font-medium text-white bg-amber-800 hover:bg-amber-900 rounded flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Add New Temple
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4">
            {temples.map((temple) => {
              const canEditThisTemple =
                currentRole === 'superadmin' ||
                (currentRole === 'temple_admin' && activeTempleId === temple.id);

              return (
                <div key={temple.id} className="bg-white rounded-lg border border-stone-200 p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-stone-500">
                        <span className="font-semibold text-amber-900">{temple.city?.name}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{temple.slug}</span>
                      </div>
                      <h4 className="font-serif text-xl font-medium text-stone-900 mt-0.5">
                        {temple.name}
                      </h4>
                      <p className="text-xs text-stone-600 mt-1">{temple.address}</p>
                    </div>

                    <div>
                      {canEditThisTemple ? (
                        <button
                          onClick={() => setEditingTemple(temple)}
                          className="px-3 py-1.5 text-xs font-medium text-white bg-amber-800 hover:bg-amber-900 rounded transition-colors cursor-pointer"
                        >
                          Configure Parameters
                        </button>
                      ) : (
                        <span className="text-xs text-stone-400 bg-stone-100 px-2.5 py-1 rounded">
                          RLS: Read-Only for {currentRole}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Settings Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-3 border-t border-stone-100 text-xs">
                    <div>
                      <div className="text-stone-400 text-[11px]">Pooja Window</div>
                      <div className="font-mono text-stone-800 font-medium">
                        {temple.pooja_start_time.slice(0, 5)} – {temple.pooja_end_time.slice(0, 5)} AM
                      </div>
                    </div>
                    <div>
                      <div className="text-stone-400 text-[11px]">Daily Family Cap</div>
                      <div className="font-mono tabular-nums text-stone-800 font-medium">
                        {temple.daily_family_capacity} Families
                      </div>
                    </div>
                    <div>
                      <div className="text-stone-400 text-[11px]">Rolling Window</div>
                      <div className="text-stone-800 font-medium">{temple.rolling_booking_months} Months</div>
                    </div>
                    <div>
                      <div className="text-stone-400 text-[11px]">Booking Cutoff</div>
                      <div className="font-mono text-stone-800 font-medium">
                        {temple.booking_cutoff_time.slice(0, 5)} (Prev Day)
                      </div>
                    </div>
                    <div>
                      <div className="text-stone-400 text-[11px]">Public Status</div>
                      <div className="font-medium text-emerald-700">
                        {temple.registration_enabled ? 'Active' : 'Disabled'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- TAB: STAFF & ROLES --- */}
      {activeTab === 'staff' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-serif text-lg font-medium text-stone-900">Staff Memberships & Roles</h3>
              <p className="text-xs text-stone-500">
                Role assignments governed by server-side RLS. Temple Admins cannot create Superadmins.
              </p>
            </div>
            {(currentRole === 'superadmin' || currentRole === 'temple_admin') && (
              <button
                onClick={() => setIsAssignStaffModalOpen(true)}
                className="px-3.5 py-1.5 text-xs font-medium text-white bg-amber-800 hover:bg-amber-900 rounded flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                Assign Role
              </button>
            )}
          </div>

          <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-500">
                <tr>
                  <th className="py-3 px-4 font-medium">Staff Member</th>
                  <th className="py-3 px-4 font-medium">Verified Mobile</th>
                  <th className="py-3 px-4 font-medium">Assigned Role</th>
                  <th className="py-3 px-4 font-medium">Assigned Temple Scope</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {memberships.map((mem) => (
                  <tr key={mem.id} className="hover:bg-stone-50/50">
                    <td className="py-3 px-4 font-semibold text-stone-900">
                      {mem.profile?.full_name || 'System User'}
                    </td>
                    <td className="py-3 px-4 font-mono text-stone-600">
                      {mem.profile?.verified_mobile || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono uppercase text-[11px] bg-stone-100 text-stone-800 px-2 py-0.5 rounded font-medium">
                        {mem.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-stone-700">
                      {mem.temple ? mem.temple.name : 'Organization-level (All Temples)'}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono uppercase text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        {mem.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- TAB: AUDIT LOGS --- */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-serif text-lg font-medium text-stone-900">Immutable Audit Trail</h3>
              <p className="text-xs text-stone-500">
                Row-Level Security forbids any modifications or deletions to audit records.
              </p>
            </div>
            <span className="text-xs text-stone-400 font-mono">
              Total Log Entries: {auditLogs.length}
            </span>
          </div>

          <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 border-b border-stone-200 text-stone-500">
                <tr>
                  <th className="py-3 px-4 font-medium">Timestamp</th>
                  <th className="py-3 px-4 font-medium">Actor</th>
                  <th className="py-3 px-4 font-medium">Action</th>
                  <th className="py-3 px-4 font-medium">Entity</th>
                  <th className="py-3 px-4 font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-stone-50/50">
                    <td className="py-3 px-4 font-mono text-stone-500">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-stone-800 font-medium">
                      {log.actor_name || 'System Actor'}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-amber-900">
                      {log.action}
                    </td>
                    <td className="py-3 px-4 text-stone-600">
                      {log.entity_type} ({log.entity_id.slice(0, 8)}...)
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => setSelectedAuditLog(log)}
                        className="text-amber-800 hover:text-amber-950 font-medium inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Inspect Diffs
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- TAB: MIGRATIONS & SCHEMA --- */}
      {activeTab === 'migrations' && (
        <div className="space-y-6">
          <div className="bg-amber-50/70 border border-amber-300 rounded-lg p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-mono uppercase tracking-wider text-amber-900 bg-amber-200/60 px-2 py-0.5 rounded font-semibold">
                  Supabase Setup Guide
                </span>
                <h3 className="font-serif text-xl font-medium text-stone-900 mt-1">
                  How to Create Tables in your Supabase Database
                </h3>
                <p className="text-xs text-stone-600 mt-1 max-w-2xl leading-relaxed">
                  Supabase requires executing the SQL migration script once in your project's SQL Editor to create the 6 tables and insert initial seed data into PostgreSQL.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/full-schema.sql');
                      const sql = await res.text();
                      await navigator.clipboard.writeText(sql);
                      setNotice({
                        type: 'success',
                        message: 'Full SQL migration script copied to clipboard! Paste it into the Supabase SQL Editor.',
                      });
                    } catch {
                      setNotice({
                        type: 'error',
                        message: 'Failed to copy script automatically. Please open /supabase/full_schema_migration.sql.',
                      });
                    }
                  }}
                  className="px-4 py-2.5 text-xs font-semibold text-white bg-amber-800 hover:bg-amber-900 rounded flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  Copy Complete SQL (All 3 Migrations)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-amber-200/60 text-xs text-stone-700">
              <div className="p-3 bg-white rounded border border-amber-200/60 space-y-1">
                <div className="font-semibold text-stone-900">Step 1: Copy SQL</div>
                <p className="text-[11px] text-stone-600">
                  Click the button above to copy the combined schema, RLS policies, and Chickpet seed data.
                </p>
              </div>
              <div className="p-3 bg-white rounded border border-amber-200/60 space-y-1">
                <div className="font-semibold text-stone-900">Step 2: Open SQL Editor</div>
                <p className="text-[11px] text-stone-600">
                  In your Supabase project dashboard, click <strong>SQL Editor</strong> on the left, then click <strong>New query</strong>.
                </p>
              </div>
              <div className="p-3 bg-white rounded border border-amber-200/60 space-y-1">
                <div className="font-semibold text-stone-900">Step 3: Paste & Run</div>
                <p className="text-[11px] text-stone-600">
                  Paste the SQL into the editor and click <strong>Run</strong> (Ctrl+Enter). All 6 tables will appear in your Table Editor!
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="font-serif text-lg font-medium text-stone-900">
              Individual SQL Migration Files
            </h3>
            <p className="text-xs text-stone-500 mt-1">
              Exact SQL scripts stored in <code className="font-mono">/supabase/migrations/</code> for deployment to Supabase PostgreSQL.
            </p>
          </div>

          <div className="space-y-4">
            {/* Migration 001 */}
            <div className="bg-white rounded-lg border border-stone-200 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono text-xs font-semibold text-stone-900">
                    001_initial_schema.sql
                  </div>
                  <div className="text-xs text-stone-500">
                    Creates organizations, cities, temples, profiles, temple_memberships, audit_logs.
                  </div>
                </div>
                <button
                  onClick={() => copySqlMigration('-- See /supabase/migrations/001_initial_schema.sql in workspace', 1)}
                  className="px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedMigrationIndex === 1 ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedMigrationIndex === 1 ? 'Copied' : 'Copy File Path'}
                </button>
              </div>
              <pre className="p-3 bg-stone-900 text-stone-100 text-[11px] font-mono rounded overflow-x-auto max-h-48">
{`CREATE TABLE organizations (id UUID PRIMARY KEY, name TEXT, slug TEXT UNIQUE...);
CREATE TABLE cities (id UUID PRIMARY KEY, organization_id UUID REFERENCES organizations...);
CREATE TABLE temples (id UUID PRIMARY KEY, city_id UUID, pooja_start_time TIME, daily_family_capacity INT DEFAULT 15...);
CREATE TABLE profiles (id UUID PRIMARY KEY REFERENCES auth.users...);
CREATE TABLE temple_memberships (id UUID PRIMARY KEY, user_id UUID, role TEXT CHECK...);
CREATE TABLE audit_logs (id UUID PRIMARY KEY, actor_user_id UUID, action TEXT, before_data JSONB, after_data JSONB...);`}
              </pre>
            </div>

            {/* Migration 002 */}
            <div className="bg-white rounded-lg border border-stone-200 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono text-xs font-semibold text-stone-900">
                    002_rls_policies.sql
                  </div>
                  <div className="text-xs text-stone-500">
                    Enforces Row Level Security (RLS) on all tables with security definer functions.
                  </div>
                </div>
                <button
                  onClick={() => copySqlMigration('-- See /supabase/migrations/002_rls_policies.sql in workspace', 2)}
                  className="px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedMigrationIndex === 2 ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedMigrationIndex === 2 ? 'Copied' : 'Copy File Path'}
                </button>
              </div>
              <pre className="p-3 bg-stone-900 text-stone-100 text-[11px] font-mono rounded overflow-x-auto max-h-48">
{`ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE temples ENABLE ROW LEVEL SECURITY;
CREATE POLICY "temples_select_public_active" ON temples FOR SELECT USING (status = 'active' AND registration_enabled = TRUE);
CREATE POLICY "temples_update_admin" ON temples FOR UPDATE TO authenticated USING (public.is_temple_admin(id));
CREATE POLICY "audit_logs_deny_update" ON audit_logs FOR UPDATE TO authenticated USING (FALSE);`}
              </pre>
            </div>

            {/* Migration 003 */}
            <div className="bg-white rounded-lg border border-stone-200 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-mono text-xs font-semibold text-stone-900">
                    003_seed_data.sql
                  </div>
                  <div className="text-xs text-stone-500">
                    Seeds initial Chickpet Bengaluru temple, Chennai temple, and system initialization logs.
                  </div>
                </div>
                <button
                  onClick={() => copySqlMigration('-- See /supabase/migrations/003_seed_data.sql in workspace', 3)}
                  className="px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copiedMigrationIndex === 3 ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedMigrationIndex === 3 ? 'Copied' : 'Copy File Path'}
                </button>
              </div>
              <pre className="p-3 bg-stone-900 text-stone-100 text-[11px] font-mono rounded overflow-x-auto max-h-48">
{`INSERT INTO temples (name, slug, city_id, pooja_start_time, pooja_end_time, daily_family_capacity, closure_rules)
VALUES ('Shri Adinath Bhagwan Jain Shwetambar Temple', 'adinath-chickpet-bengaluru', ..., '06:00:00', '08:00:00', 15, '{"closed_days_of_week": [0]}');`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB: SETTINGS & PHASE 2 SPECS --- */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div>
            <h3 className="font-serif text-lg font-medium text-stone-900">
              Phase 1 Guardrails & Phase 2 Roadmap
            </h3>
            <p className="text-xs text-stone-500 mt-1">
              Adheres strictly to the specification: no fake booking operations or mock CRM features.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg border border-stone-200 space-y-4">
              <div className="font-semibold text-stone-900 text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Completed in Phase 1 (Foundation)
              </div>
              <ul className="text-xs text-stone-600 space-y-2 list-disc pl-4">
                <li>Multi-tenant relational architecture (Org → City → Temple → Staff/Users)</li>
                <li>PostgreSQL schema with foreign keys, checks, and update triggers</li>
                <li>Comprehensive Row Level Security (RLS) policies on all tables</li>
                <li>Dynamic temple operational parameters (timings, capacity, closure days)</li>
                <li>Supabase phone OTP authentication integration foundation</li>
                <li>Immutable security audit trail (audit_logs table)</li>
                <li>Express server proxy and migration documentation</li>
                <li>Development test harnesses and persona switching</li>
              </ul>
            </div>

            <div className="bg-[#FAF7F2] p-6 rounded-lg border border-stone-200 space-y-4">
              <div className="font-semibold text-stone-900 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-800" />
                Reserved for Phase 2 (Pooja Booking Engine)
              </div>
              <ul className="text-xs text-stone-600 space-y-2 list-disc pl-4">
                <li>Public booking calendar (current month + 5 rolling months)</li>
                <li>18:00 preceding-day cutoff automation</li>
                <li>PostgreSQL serializable row locks for concurrent overbooking prevention</li>
                <li>Family devotee verification and unique registration numbering (AS-...)</li>
                <li>SMS / WhatsApp confirmation dispatch via Supabase Edge Functions</li>
                <li>Temple gatekeeper attendance check-in desk</li>
                <li>Operational reporting on total attending devotees vs family count</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL: EDIT TEMPLE PARAMETERS --- */}
      {editingTemple && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 space-y-5 shadow-lg border border-stone-200">
            <div>
              <h3 className="font-serif text-lg font-medium text-stone-900">
                Configure Temple Parameters
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                {editingTemple.name} ({editingTemple.city?.name})
              </p>
            </div>

            <form onSubmit={handleSaveTempleEdit} className="space-y-4 text-xs">
              <div>
                <label className="block text-stone-700 font-medium mb-1">Temple Display Name</label>
                <input
                  type="text"
                  required
                  value={editingTemple.name}
                  onChange={(e) => setEditingTemple({ ...editingTemple, name: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded focus:bg-white focus:outline-none focus:ring-1 focus:ring-amber-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-700 font-medium mb-1">Pooja Start Time</label>
                  <input
                    type="time"
                    step="1"
                    required
                    value={editingTemple.pooja_start_time}
                    onChange={(e) => setEditingTemple({ ...editingTemple, pooja_start_time: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block text-stone-700 font-medium mb-1">Pooja End Time</label>
                  <input
                    type="time"
                    step="1"
                    required
                    value={editingTemple.pooja_end_time}
                    onChange={(e) => setEditingTemple({ ...editingTemple, pooja_end_time: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-700 font-medium mb-1">Daily Family Capacity</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={editingTemple.daily_family_capacity}
                    onChange={(e) =>
                      setEditingTemple({
                        ...editingTemple,
                        daily_family_capacity: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block text-stone-700 font-medium mb-1">Cutoff Time (Prev Day)</label>
                  <input
                    type="time"
                    step="1"
                    required
                    value={editingTemple.booking_cutoff_time}
                    onChange={(e) => setEditingTemple({ ...editingTemple, booking_cutoff_time: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-700 font-medium mb-1">Rolling Months</label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    required
                    value={editingTemple.rolling_booking_months}
                    onChange={(e) =>
                      setEditingTemple({
                        ...editingTemple,
                        rolling_booking_months: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block text-stone-700 font-medium mb-1">Registration Status</label>
                  <select
                    value={editingTemple.registration_enabled ? 'true' : 'false'}
                    onChange={(e) =>
                      setEditingTemple({
                        ...editingTemple,
                        registration_enabled: e.target.value === 'true',
                      })
                    }
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded"
                  >
                    <option value="true">Active & Visible</option>
                    <option value="false">Suspended / Hidden</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setEditingTemple(null)}
                  className="px-3.5 py-2 text-stone-600 hover:text-stone-900 border border-stone-200 rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-amber-800 hover:bg-amber-900 rounded font-medium cursor-pointer"
                >
                  Save Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: NEW TEMPLE --- */}
      {isNewTempleModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 space-y-5 shadow-lg border border-stone-200">
            <div>
              <h3 className="font-serif text-lg font-medium text-stone-900">
                Register New Temple Tenant
              </h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Add an additional temple in Bengaluru, Chennai, or another city.
              </p>
            </div>

            <form onSubmit={handleCreateTemple} className="space-y-4 text-xs">
              <div>
                <label className="block text-stone-700 font-medium mb-1">Temple Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Shri Godiji Parshwanath Jain Temple"
                  value={newTempleForm.name}
                  onChange={(e) => setNewTempleForm({ ...newTempleForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-700 font-medium mb-1">City</label>
                  <select
                    required
                    value={newTempleForm.city_id}
                    onChange={(e) => setNewTempleForm({ ...newTempleForm, city_id: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded"
                  >
                    <option value="">Select City...</option>
                    {cities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}, {c.state}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-stone-700 font-medium mb-1">Slug</label>
                  <input
                    type="text"
                    required
                    placeholder="godiji-bengaluru"
                    value={newTempleForm.slug}
                    onChange={(e) => setNewTempleForm({ ...newTempleForm, slug: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-stone-700 font-medium mb-1">Address</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Street, Locality, City, State & Pincode"
                  value={newTempleForm.address}
                  onChange={(e) => setNewTempleForm({ ...newTempleForm, address: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-stone-700 font-medium mb-1">Start Time</label>
                  <input
                    type="time"
                    step="1"
                    required
                    value={newTempleForm.pooja_start_time}
                    onChange={(e) => setNewTempleForm({ ...newTempleForm, pooja_start_time: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block text-stone-700 font-medium mb-1">End Time</label>
                  <input
                    type="time"
                    step="1"
                    required
                    value={newTempleForm.pooja_end_time}
                    onChange={(e) => setNewTempleForm({ ...newTempleForm, pooja_end_time: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block text-stone-700 font-medium mb-1">Daily Cap</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newTempleForm.daily_family_capacity}
                    onChange={(e) =>
                      setNewTempleForm({
                        ...newTempleForm,
                        daily_family_capacity: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsNewTempleModalOpen(false)}
                  className="px-3.5 py-2 text-stone-600 hover:text-stone-900 border border-stone-200 rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-amber-800 hover:bg-amber-900 rounded font-medium cursor-pointer"
                >
                  Register Temple
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: NEW CITY --- */}
      {isNewCityModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4 shadow-lg border border-stone-200">
            <div>
              <h3 className="font-serif text-lg font-medium text-stone-900">Add Operational City</h3>
              <p className="text-xs text-stone-500 mt-0.5">Define a new city region for temple onboarding.</p>
            </div>

            <form onSubmit={handleCreateCity} className="space-y-3 text-xs">
              <div>
                <label className="block text-stone-700 font-medium mb-1">City Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ahmedabad"
                  value={newCityForm.name}
                  onChange={(e) => setNewCityForm({ ...newCityForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-stone-700 font-medium mb-1">State</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Gujarat"
                    value={newCityForm.state}
                    onChange={(e) => setNewCityForm({ ...newCityForm, state: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded"
                  />
                </div>
                <div>
                  <label className="block text-stone-700 font-medium mb-1">Timezone</label>
                  <input
                    type="text"
                    required
                    value={newCityForm.timezone}
                    onChange={(e) => setNewCityForm({ ...newCityForm, timezone: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsNewCityModalOpen(false)}
                  className="px-3.5 py-2 text-stone-600 hover:text-stone-900 border border-stone-200 rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-amber-800 hover:bg-amber-900 rounded font-medium cursor-pointer"
                >
                  Create City
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: ASSIGN STAFF --- */}
      {isAssignStaffModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6 space-y-4 shadow-lg border border-stone-200">
            <div>
              <h3 className="font-serif text-lg font-medium text-stone-900">Assign Staff Role</h3>
              <p className="text-xs text-stone-500 mt-0.5">
                Assign administrative and manager privileges subject to server-side RLS.
              </p>
            </div>

            <form onSubmit={handleAssignStaff} className="space-y-3 text-xs">
              <div>
                <label className="block text-stone-700 font-medium mb-1">Select Profile</label>
                <select
                  required
                  value={staffForm.userId}
                  onChange={(e) => setStaffForm({ ...staffForm, userId: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded"
                >
                  <option value="">Select registered user...</option>
                  {aadiSparshRepository.getProfiles().map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name} ({p.verified_mobile})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-stone-700 font-medium mb-1">Role</label>
                <select
                  required
                  value={staffForm.role}
                  onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value as UserRole })}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded font-mono uppercase"
                >
                  {currentRole === 'superadmin' && <option value="superadmin">SUPERADMIN</option>}
                  <option value="temple_admin">TEMPLE_ADMIN</option>
                  <option value="temple_manager">TEMPLE_MANAGER</option>
                  <option value="family">FAMILY DEVOTEE</option>
                </select>
              </div>

              <div>
                <label className="block text-stone-700 font-medium mb-1">Assigned Temple</label>
                <select
                  value={staffForm.templeId}
                  onChange={(e) => setStaffForm({ ...staffForm, templeId: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded"
                >
                  {currentRole === 'superadmin' && <option value="">Org-wide (All Temples)</option>}
                  {temples.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.city?.name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsAssignStaffModalOpen(false)}
                  className="px-3.5 py-2 text-stone-600 hover:text-stone-900 border border-stone-200 rounded cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-amber-800 hover:bg-amber-900 rounded font-medium cursor-pointer"
                >
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: INSPECT AUDIT LOG DIFFS --- */}
      {selectedAuditLog && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-xl w-full p-6 space-y-4 shadow-lg border border-stone-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-serif text-lg font-medium text-stone-900">
                  Audit Entry: {selectedAuditLog.action}
                </h3>
                <div className="text-xs text-stone-500 font-mono mt-0.5">
                  ID: {selectedAuditLog.id} · Timestamp: {new Date(selectedAuditLog.created_at).toLocaleString()}
                </div>
              </div>
              <button
                onClick={() => setSelectedAuditLog(null)}
                className="text-stone-400 hover:text-stone-700 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-stone-500">Actor:</span>{' '}
                <span className="font-semibold text-stone-800">{selectedAuditLog.actor_name || 'System'}</span>
              </div>

              <div>
                <div className="text-stone-500 font-medium mb-1">State Before Change:</div>
                <pre className="p-3 bg-stone-50 border border-stone-200 rounded font-mono text-[11px] overflow-x-auto max-h-36">
                  {selectedAuditLog.before_data
                    ? JSON.stringify(selectedAuditLog.before_data, null, 2)
                    : '(Initial Creation / No Prior State)'}
                </pre>
              </div>

              <div>
                <div className="text-stone-500 font-medium mb-1">State After Change:</div>
                <pre className="p-3 bg-stone-50 border border-stone-200 rounded font-mono text-[11px] overflow-x-auto max-h-48 text-stone-800">
                  {JSON.stringify(selectedAuditLog.after_data, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-stone-100">
              <button
                onClick={() => setSelectedAuditLog(null)}
                className="px-4 py-2 text-xs font-medium text-white bg-amber-800 hover:bg-amber-900 rounded cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};
