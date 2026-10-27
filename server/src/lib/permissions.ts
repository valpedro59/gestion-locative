// Deux rôles :
//  - "admin" : le créateur de l'agence (et les utilisateurs qu'il promeut). Tous les droits.
//  - "agent" : employé. Représente l'admin dans tous les cas, sauf pour la gestion
//              des utilisateurs (ajouter, modifier, désactiver) et les réglages de l'agence.
// Toutes les routes passent par requirePermission(...) : ajuster les droits d'un rôle
// se fait ici, sans toucher aux routes.

export const ROLES = ["admin", "agent"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "payment.record",
  "payment.cancel",
  "lease.manage",
  "owner.manage",
  "property.manage",
  "tenant.manage",
  "expense.manage",
  "statement.close",
  "user.manage",
  "agency.settings",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ADMIN_ONLY: readonly Permission[] = ["user.manage", "agency.settings"];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: PERMISSIONS,
  agent: PERMISSIONS.filter((p) => !ADMIN_ONLY.includes(p)),
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
