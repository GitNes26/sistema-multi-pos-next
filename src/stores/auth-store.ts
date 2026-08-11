import { create } from "zustand";

export type OrgRole = "owner" | "manager" | "cashier" | "superadmin" | "admin";

export interface OrgMembership {
  organizationId: string;
  organizationName: string;
  role: OrgRole;
}

interface AuthState {
  user: {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    role?: string;
  } | null;
  memberships: OrgMembership[];
  activeOrgId: string | null;
  setSession: (user: AuthState["user"]) => void;
  setMemberships: (memberships: OrgMembership[]) => void;
  setActiveOrg: (organizationId: string) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  memberships: [],
  activeOrgId: null,
  setSession: (user) => set({ user }),
  setMemberships: (memberships) =>
    set({
      memberships,
      activeOrgId: memberships[0]?.organizationId ?? null,
    }),
  setActiveOrg: (organizationId) => set({ activeOrgId: organizationId }),
  clear: () =>
    set({ user: null, memberships: [], activeOrgId: null }),
}));