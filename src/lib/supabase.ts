import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  Organization,
  City,
  Temple,
  Profile,
  TempleMembership,
  AuditLog,
  UserRole,
} from '../types/database';
import {
  INITIAL_ORGANIZATION,
  INITIAL_CITIES,
  INITIAL_TEMPLES,
  INITIAL_PROFILES,
  INITIAL_MEMBERSHIPS,
  INITIAL_AUDIT_LOGS,
} from './devData';

const getEnvVar = (name: string): string => {
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[name]) {
      return (import.meta as any).env[name];
    }
  } catch {
    // ignore
  }
  try {
    if (typeof process !== 'undefined' && process.env && process.env[name]) {
      return process.env[name] || '';
    }
  } catch {
    // ignore
  }
  return '';
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY');

export type PersistenceMode = 'supabase' | 'unmigrated_supabase' | 'local_sandbox';

// Detect if valid remote Supabase credentials are provided
export const isSupabaseConfigured = (): boolean => {
  return (
    Boolean(supabaseUrl) &&
    Boolean(supabaseAnonKey) &&
    !supabaseUrl.includes('your-project') &&
    !supabaseUrl.includes('example.com') &&
    supabaseUrl.startsWith('https://')
  );
};

// Create real client if configured, otherwise create a placeholder client
export const supabase: SupabaseClient = createClient(
  isSupabaseConfigured() ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured() ? supabaseAnonKey : 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);

/**
 * In-Memory Transactional Store for Development & Verification
 */
class DevMemoryStore {
  private organizations: Organization[] = JSON.parse(JSON.stringify([INITIAL_ORGANIZATION]));
  private cities: City[] = JSON.parse(JSON.stringify(INITIAL_CITIES));
  private temples: Temple[] = JSON.parse(JSON.stringify(INITIAL_TEMPLES));
  private profiles: Profile[] = JSON.parse(JSON.stringify(INITIAL_PROFILES));
  private memberships: TempleMembership[] = JSON.parse(JSON.stringify(INITIAL_MEMBERSHIPS));
  private auditLogs: AuditLog[] = JSON.parse(JSON.stringify(INITIAL_AUDIT_LOGS));

  // Verified Public Temples (Chickpet Bengaluru is the ONLY verified launch temple)
  getVerifiedPublicTemples(): Temple[] {
    return this.temples
      .filter((t) => t.status === 'active' && t.registration_enabled && t.slug.includes('chickpet'))
      .map((t) => ({
        ...t,
        city: this.cities.find((c) => c.id === t.city_id),
        organization: this.organizations.find((o) => o.id === t.organization_id),
      }));
  }

  getAllTemples(): Temple[] {
    return this.temples.map((t) => ({
      ...t,
      city: this.cities.find((c) => c.id === t.city_id),
      organization: this.organizations.find((o) => o.id === t.organization_id),
    }));
  }

  getOrganizations(): Organization[] {
    return [...this.organizations];
  }

  getCities(): City[] {
    return [...this.cities];
  }

  getTemplesForActor(actorRole: UserRole, actorTempleId?: string | null): Temple[] {
    let result: Temple[] = [];
    if (actorRole === 'superadmin') {
      result = [...this.temples];
    } else if (actorRole === 'temple_admin' || actorRole === 'temple_manager') {
      result = this.temples.filter((t) => t.id === actorTempleId);
    } else {
      result = this.temples.filter((t) => t.status === 'active' && t.registration_enabled && t.slug.includes('chickpet'));
    }

    return result.map((t) => ({
      ...t,
      city: this.cities.find((c) => c.id === t.city_id),
      organization: this.organizations.find((o) => o.id === t.organization_id),
    }));
  }

  updateTemple(
    templeId: string,
    updates: Partial<Temple>,
    actorUserId: string,
    actorRole: UserRole,
    actorTempleId?: string | null,
    actorName?: string
  ): { success: boolean; data?: Temple; error?: string } {
    const isAuthorized =
      actorRole === 'superadmin' ||
      (actorRole === 'temple_admin' && actorTempleId === templeId);

    if (!isAuthorized) {
      return {
        success: false,
        error: `RLS Security Violation: Role '${actorRole}' is not authorized to modify temple '${templeId}'.`,
      };
    }

    const index = this.temples.findIndex((t) => t.id === templeId);
    if (index === -1) {
      return { success: false, error: 'Temple not found.' };
    }

    const beforeData = { ...this.temples[index] };
    const updatedTemple: Temple = {
      ...this.temples[index],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    this.temples[index] = updatedTemple;

    this.auditLogs.unshift({
      id: crypto.randomUUID ? crypto.randomUUID() : `audit-${Date.now()}`,
      actor_user_id: actorUserId,
      organization_id: updatedTemple.organization_id,
      temple_id: templeId,
      entity_type: 'temple',
      entity_id: templeId,
      action: 'UPDATE_TEMPLE_CONFIG',
      before_data: beforeData as unknown as Record<string, unknown>,
      after_data: updatedTemple as unknown as Record<string, unknown>,
      created_at: new Date().toISOString(),
      actor_name: actorName || 'Authorized Administrator',
    });

    return {
      success: true,
      data: {
        ...updatedTemple,
        city: this.cities.find((c) => c.id === updatedTemple.city_id),
        organization: this.organizations.find((o) => o.id === updatedTemple.organization_id),
      },
    };
  }

  createTemple(
    newTemple: Omit<Temple, 'id' | 'created_at' | 'updated_at'>,
    actorUserId: string,
    actorRole: UserRole,
    actorName?: string
  ): { success: boolean; data?: Temple; error?: string } {
    if (actorRole !== 'superadmin') {
      return {
        success: false,
        error: `RLS Security Violation: Only Superadmin may create new temple tenants.`,
      };
    }

    const created: Temple = {
      ...newTemple,
      id: crypto.randomUUID ? crypto.randomUUID() : `temple-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.temples.push(created);

    this.auditLogs.unshift({
      id: crypto.randomUUID ? crypto.randomUUID() : `audit-${Date.now()}`,
      actor_user_id: actorUserId,
      organization_id: created.organization_id,
      temple_id: created.id,
      entity_type: 'temple',
      entity_id: created.id,
      action: 'CREATE_TEMPLE',
      before_data: null,
      after_data: created as unknown as Record<string, unknown>,
      created_at: new Date().toISOString(),
      actor_name: actorName || 'Superadmin',
    });

    return {
      success: true,
      data: {
        ...created,
        city: this.cities.find((c) => c.id === created.city_id),
        organization: this.organizations.find((o) => o.id === created.organization_id),
      },
    };
  }

  createCity(
    newCity: Omit<City, 'id' | 'created_at' | 'updated_at'>,
    actorRole: UserRole
  ): { success: boolean; data?: City; error?: string } {
    if (actorRole !== 'superadmin') {
      return {
        success: false,
        error: `RLS Security Violation: Only Superadmin can add cities.`,
      };
    }

    const created: City = {
      ...newCity,
      id: crypto.randomUUID ? crypto.randomUUID() : `city-${Date.now()}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.cities.push(created);
    return { success: true, data: created };
  }

  getMembershipsForActor(actorRole: UserRole, actorTempleId?: string | null): TempleMembership[] {
    let result: TempleMembership[] = [];
    if (actorRole === 'superadmin') {
      result = [...this.memberships];
    } else if (actorRole === 'temple_admin') {
      result = this.memberships.filter((m) => m.temple_id === actorTempleId);
    } else {
      result = [];
    }

    return result.map((m) => ({
      ...m,
      profile: this.profiles.find((p) => p.id === m.user_id),
      temple: this.temples.find((t) => t.id === m.temple_id),
      organization: this.organizations.find((o) => o.id === m.organization_id),
    }));
  }

  assignMembership(
    assignment: {
      userId: string;
      organizationId: string;
      templeId: string | null;
      role: UserRole;
    },
    actorUserId: string,
    actorRole: UserRole,
    actorTempleId?: string | null,
    actorName?: string
  ): { success: boolean; data?: TempleMembership; error?: string } {
    if (actorRole === 'superadmin') {
      // Superadmin authorized
    } else if (actorRole === 'temple_admin') {
      if (assignment.templeId !== actorTempleId) {
        return {
          success: false,
          error: 'RLS Security Violation: Temple Admin cannot assign staff outside their own temple.',
        };
      }
      if (assignment.role === 'superadmin') {
        return {
          success: false,
          error: 'RLS Security Violation: Temple Admin cannot elevate users to Superadmin.',
        };
      }
    } else {
      return {
        success: false,
        error: 'RLS Security Violation: Unauthorized to manage staff memberships.',
      };
    }

    const newMembership: TempleMembership = {
      id: crypto.randomUUID ? crypto.randomUUID() : `mem-${Date.now()}`,
      user_id: assignment.userId,
      organization_id: assignment.organizationId,
      temple_id: assignment.templeId,
      role: assignment.role,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.memberships.push(newMembership);

    this.auditLogs.unshift({
      id: crypto.randomUUID ? crypto.randomUUID() : `audit-${Date.now()}`,
      actor_user_id: actorUserId,
      organization_id: assignment.organizationId,
      temple_id: assignment.templeId,
      entity_type: 'temple_membership',
      entity_id: newMembership.id,
      action: 'ASSIGN_STAFF_ROLE',
      before_data: null,
      after_data: newMembership as unknown as Record<string, unknown>,
      created_at: new Date().toISOString(),
      actor_name: actorName || 'Administrator',
    });

    return {
      success: true,
      data: {
        ...newMembership,
        profile: this.profiles.find((p) => p.id === newMembership.user_id),
        temple: this.temples.find((t) => t.id === newMembership.temple_id),
        organization: this.organizations.find((o) => o.id === newMembership.organization_id),
      },
    };
  }

  getAuditLogsForActor(actorRole: UserRole, actorTempleId?: string | null): AuditLog[] {
    if (actorRole === 'superadmin') {
      return [...this.auditLogs];
    }
    if (actorRole === 'temple_admin') {
      return this.auditLogs.filter((l) => l.temple_id === actorTempleId);
    }
    return [];
  }

  getProfiles(): Profile[] {
    return [...this.profiles];
  }

  resetToSeeds(): void {
    this.organizations = JSON.parse(JSON.stringify([INITIAL_ORGANIZATION]));
    this.cities = JSON.parse(JSON.stringify(INITIAL_CITIES));
    this.temples = JSON.parse(JSON.stringify(INITIAL_TEMPLES));
    this.profiles = JSON.parse(JSON.stringify(INITIAL_PROFILES));
    this.memberships = JSON.parse(JSON.stringify(INITIAL_MEMBERSHIPS));
    this.auditLogs = JSON.parse(JSON.stringify(INITIAL_AUDIT_LOGS));
  }
}

export const devStore = new DevMemoryStore();

// Track remote table availability
let remoteTablesVerified: boolean | null = null;

export const checkRemoteTablesAvailable = async (): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    remoteTablesVerified = false;
    return false;
  }
  try {
    const { error } = await supabase.from('temples').select('id').limit(1);
    if (error && error.code === 'PGRST205') {
      // Table not found in schema cache
      remoteTablesVerified = false;
      return false;
    }
    remoteTablesVerified = !error;
    return Boolean(remoteTablesVerified);
  } catch {
    remoteTablesVerified = false;
    return false;
  }
};

export const ensureRemoteReady = async (): Promise<boolean> => {
  if (remoteTablesVerified !== null) return remoteTablesVerified;
  return await checkRemoteTablesAvailable();
};

/**
 * Unified Repository Layer with Strict Safe Persistence Checks
 */
export const aadiSparshRepository = {
  getPersistenceMode(): PersistenceMode {
    if (!isSupabaseConfigured()) return 'local_sandbox';
    if (remoteTablesVerified === false) return 'unmigrated_supabase';
    return 'supabase';
  },

  /**
   * Public View: ONLY displays verified launch temples (Chickpet Bengaluru).
   * Unverified demo entries like Chennai are excluded from the public site per Requirement 8.
   */
  async getPublicTemples(): Promise<Temple[]> {
    if (isSupabaseConfigured() && (await ensureRemoteReady())) {
      try {
        const { data, error } = await supabase
          .from('temples')
          .select(`*, city:cities(*), organization:organizations(*)`)
          .eq('status', 'active')
          .eq('registration_enabled', true)
          .ilike('slug', '%chickpet%');

        if (!error && data && data.length > 0) {
          return data as Temple[];
        }
      } catch (err) {
        console.warn('Error reading remote public temples:', err);
      }
    }
    return devStore.getVerifiedPublicTemples();
  },

  async getTemplesForActor(actorRole: UserRole, actorTempleId?: string | null): Promise<Temple[]> {
    if (isSupabaseConfigured() && (await ensureRemoteReady())) {
      try {
        let query = supabase.from('temples').select(`*, city:cities(*), organization:organizations(*)`);

        if (actorRole === 'temple_admin' || actorRole === 'temple_manager') {
          if (actorTempleId) {
            query = query.eq('id', actorTempleId);
          }
        }

        const { data, error } = await query;
        if (!error && data) return data as Temple[];
      } catch (err) {
        console.warn('Falling back to dev store for actor temples:', err);
      }
    }
    return devStore.getTemplesForActor(actorRole, actorTempleId);
  },

  async getCities(): Promise<City[]> {
    if (isSupabaseConfigured() && (await ensureRemoteReady())) {
      try {
        const { data, error } = await supabase.from('cities').select('*');
        if (!error && data) return data as City[];
      } catch (err) {
        console.warn('Falling back to dev store for cities:', err);
      }
    }
    return devStore.getCities();
  },

  async getOrganizations(): Promise<Organization[]> {
    if (isSupabaseConfigured() && (await ensureRemoteReady())) {
      try {
        const { data, error } = await supabase.from('organizations').select('*');
        if (!error && data) return data as Organization[];
      } catch (err) {
        console.warn('Falling back to dev store for organizations:', err);
      }
    }
    return devStore.getOrganizations();
  },

  async getMemberships(actorRole: UserRole, actorTempleId?: string | null): Promise<TempleMembership[]> {
    if (isSupabaseConfigured() && (await ensureRemoteReady())) {
      try {
        let query = supabase.from('temple_memberships').select(`*, profile:profiles(*), temple:temples(*), organization:organizations(*)`);
        if (actorRole === 'temple_admin' && actorTempleId) {
          query = query.eq('temple_id', actorTempleId);
        }
        const { data, error } = await query;
        if (!error && data) return data as TempleMembership[];
      } catch (err) {
        console.warn('Falling back to dev store for memberships:', err);
      }
    }
    return devStore.getMembershipsForActor(actorRole, actorTempleId);
  },

  async getAuditLogs(actorRole: UserRole, actorTempleId?: string | null): Promise<AuditLog[]> {
    if (isSupabaseConfigured() && (await ensureRemoteReady())) {
      try {
        let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false });
        if (actorRole === 'temple_admin' && actorTempleId) {
          query = query.eq('temple_id', actorTempleId);
        }
        const { data, error } = await query;
        if (!error && data) return data as AuditLog[];
      } catch (err) {
        console.warn('Falling back to dev store for audit logs:', err);
      }
    }
    return devStore.getAuditLogsForActor(actorRole, actorTempleId);
  },

  /**
   * Safe Persistence Enforcement (Requirement 9):
   * When Supabase credentials are configured, DO NOT silently save into temporary memory!
   * Fail safely with an explicit actionable message if remote tables are not yet migrated.
   */
  async updateTemple(
    templeId: string,
    updates: Partial<Temple>,
    actorUserId: string,
    actorRole: UserRole,
    actorTempleId?: string | null,
    actorName?: string
  ): Promise<{ success: boolean; data?: Temple; error?: string }> {
    if (isSupabaseConfigured()) {
      if (!remoteTablesVerified) {
        const available = await checkRemoteTablesAvailable();
        if (!available) {
          return {
            success: false,
            error: 'Persistence Error: Supabase project is connected, but database tables are not yet created. Please run the Phase 1 SQL migration in your Supabase SQL Editor before saving changes.',
          };
        }
      }

      try {
        const { data, error } = await supabase
          .from('temples')
          .update(updates)
          .eq('id', templeId)
          .select()
          .single();

        if (error) throw error;
        return { success: true, data: data as Temple };
      } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
      }
    }
    // Local development sandbox only
    return devStore.updateTemple(templeId, updates, actorUserId, actorRole, actorTempleId, actorName);
  },

  async createTemple(
    newTemple: Omit<Temple, 'id' | 'created_at' | 'updated_at'>,
    actorUserId: string,
    actorRole: UserRole,
    actorName?: string
  ): Promise<{ success: boolean; data?: Temple; error?: string }> {
    if (isSupabaseConfigured()) {
      if (!remoteTablesVerified) {
        const available = await checkRemoteTablesAvailable();
        if (!available) {
          return {
            success: false,
            error: 'Persistence Error: Database tables not yet migrated in Supabase. Run /supabase/full_schema_migration.sql first.',
          };
        }
      }

      try {
        const { data, error } = await supabase.from('temples').insert(newTemple).select().single();
        if (error) throw error;
        return { success: true, data: data as Temple };
      } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
      }
    }
    return devStore.createTemple(newTemple, actorUserId, actorRole, actorName);
  },

  async createCity(
    newCity: Omit<City, 'id' | 'created_at' | 'updated_at'>,
    actorRole: UserRole
  ): Promise<{ success: boolean; data?: City; error?: string }> {
    if (isSupabaseConfigured()) {
      if (!remoteTablesVerified) {
        return {
          success: false,
          error: 'Persistence Error: Database tables not yet migrated in Supabase. Run /supabase/full_schema_migration.sql first.',
        };
      }
      try {
        const { data, error } = await supabase.from('cities').insert(newCity).select().single();
        if (error) throw error;
        return { success: true, data: data as City };
      } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
      }
    }
    return devStore.createCity(newCity, actorRole);
  },

  async assignMembership(
    assignment: {
      userId: string;
      organizationId: string;
      templeId: string | null;
      role: UserRole;
    },
    actorUserId: string,
    actorRole: UserRole,
    actorTempleId?: string | null,
    actorName?: string
  ): Promise<{ success: boolean; data?: TempleMembership; error?: string }> {
    if (isSupabaseConfigured()) {
      if (!remoteTablesVerified) {
        return {
          success: false,
          error: 'Persistence Error: Database tables not yet migrated in Supabase. Run /supabase/full_schema_migration.sql first.',
        };
      }
      try {
        const { data, error } = await supabase
          .from('temple_memberships')
          .insert({
            user_id: assignment.userId,
            organization_id: assignment.organizationId,
            temple_id: assignment.templeId,
            role: assignment.role,
          })
          .select()
          .single();

        if (error) throw error;
        return { success: true, data: data as TempleMembership };
      } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
      }
    }
    return devStore.assignMembership(assignment, actorUserId, actorRole, actorTempleId, actorName);
  },

  getProfiles(): Profile[] {
    return devStore.getProfiles();
  },

  resetSeeds(): void {
    devStore.resetToSeeds();
  },
};
