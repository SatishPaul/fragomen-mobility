import { describe, expect, it } from "vitest";
import { validateAdminMutation } from "./admin-users";

const baseMutation = {
  actorId: "admin-1",
  targetId: "user-1",
  currentRole: "user" as const,
  currentIsActive: true,
  activeAdminCount: 1,
};

describe("administrator user mutation policy", () => {
  it.each([
    { deleteUser: true },
    { nextRole: "user" as const },
    { nextIsActive: false },
  ])("blocks an administrator from removing their own access", (change) => {
    expect(() => validateAdminMutation({
      ...baseMutation,
      actorId: "admin-1",
      targetId: "admin-1",
      currentRole: "admin",
      ...change,
    })).toThrow("You cannot delete, demote, or disable your own administrator account.");
  });

  it("blocks deletion of the last active administrator", () => {
    expect(() => validateAdminMutation({
      ...baseMutation,
      targetId: "admin-2",
      currentRole: "admin",
      deleteUser: true,
    })).toThrow("At least one active administrator must remain.");
  });

  it("allows another administrator to be removed when one remains", () => {
    expect(() => validateAdminMutation({
      ...baseMutation,
      targetId: "admin-2",
      currentRole: "admin",
      activeAdminCount: 2,
      deleteUser: true,
    })).not.toThrow();
  });

  it("allows regular users to be updated or deleted", () => {
    expect(() => validateAdminMutation({ ...baseMutation, nextRole: "admin" })).not.toThrow();
    expect(() => validateAdminMutation({ ...baseMutation, deleteUser: true })).not.toThrow();
  });
});