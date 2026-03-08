// Validation constants — safe to import on both server (API routes) and client.

export const VALID_EVENT_STATUSES = ['pending', 'approved', 'denied'];
export const VALID_ORG_STATUSES   = ['active', 'pending', 'disabled'];
export const VALID_ROLES          = ['super_admin', 'admin', 'partner'];
export const VALID_INVITE_ROLES   = ['admin', 'super_admin'];
