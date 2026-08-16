export const ROLES = ["OWNER", "ADMIN", "MEMBER", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "workspace:read",
  "workspace:update",
  "member:invite",
  "member:update",
  "member:remove",
  "project:create",
  "project:update",
  "project:delete",
  "document:create",
  "document:read",
  "document:update",
  "document:delete",
  "ai:use",
  "analytics:read",
  "billing:manage",
  "team:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  OWNER: PERMISSIONS,
  ADMIN: [
    "workspace:read",
    "workspace:update",
    "member:invite",
    "member:update",
    "member:remove",
    "project:create",
    "project:update",
    "project:delete",
    "document:create",
    "document:read",
    "document:update",
    "document:delete",
    "ai:use",
    "analytics:read",
    "team:manage",
  ],
  MEMBER: [
    "workspace:read",
    "project:create",
    "project:update",
    "document:create",
    "document:read",
    "document:update",
    "ai:use",
    "analytics:read",
  ],
  VIEWER: ["workspace:read", "document:read", "ai:use"],
};

export function can(role: Role | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function roleAtLeast(role: Role, minimum: Role): boolean {
  const order: Record<Role, number> = { OWNER: 4, ADMIN: 3, MEMBER: 2, VIEWER: 1 };
  return order[role] >= order[minimum];
}

export function isAdminOrAbove(role: Role | undefined): boolean {
  return role === "OWNER" || role === "ADMIN";
}
