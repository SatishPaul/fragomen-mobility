export type ManagedRole = "admin" | "user";

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