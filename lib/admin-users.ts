export type ManagedRole = "admin" | "user";

export type TokenAllocation = {
  role: ManagedRole;
  is_active: boolean;
  monthly_token_quota: number;
};

export type TokenPoolSummary = {
  total: number;
  allocated: number;
  unallocated: number;
};

export function summarizeTokenPool(total: number, users: TokenAllocation[]): TokenPoolSummary {
  const allocated = users.reduce((sum, user) => (
    user.role === "user" && user.is_active ? sum + user.monthly_token_quota : sum
  ), 0);

  if (allocated > total) {
    throw new Error(
      `User limits exceed the shared monthly pool by ${(allocated - total).toLocaleString()} tokens. Lower a user limit or increase the pool first.`,
    );
  }

  return { total, allocated, unallocated: total - allocated };
}

type AdminMutation = {
  actorId: string;
  targetId: string;
  currentRole: ManagedRole;
  currentIsActive: boolean;
  nextRole?: ManagedRole;
  nextIsActive?: boolean;
  deleteUser?: boolean;
  activeAdminCount: number;
};

export function validateAdminMutation(mutation: AdminMutation) {
  const isSelf = mutation.actorId === mutation.targetId;
  const removesOwnAdminAccess = mutation.nextRole === "user" || mutation.nextIsActive === false;

  if (isSelf && (mutation.deleteUser || removesOwnAdminAccess)) {
    throw new Error("You cannot delete, demote, or disable your own administrator account.");
  }

  const removesActiveAdmin = mutation.currentRole === "admin"
    && mutation.currentIsActive
    && (mutation.deleteUser || mutation.nextRole === "user" || mutation.nextIsActive === false);

  if (removesActiveAdmin && mutation.activeAdminCount <= 1) {
    throw new Error("At least one active administrator must remain.");
  }
}