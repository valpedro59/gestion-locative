import { describe, expect, it } from "vitest";
import { PERMISSIONS, can } from "../src/lib/permissions";

describe("permissions", () => {
  it("admin a tous les droits", () => {
    for (const p of PERMISSIONS) expect(can("admin", p)).toBe(true);
  });
  it("agent : tout, sauf la gestion des utilisateurs et les réglages de l'agence", () => {
    const adminOnly = ["user.manage", "agency.settings"];
    for (const p of PERMISSIONS) {
      expect(can("agent", p)).toBe(!adminOnly.includes(p));
    }
    expect(can("agent", "payment.record")).toBe(true);
    expect(can("agent", "user.manage")).toBe(false);
    expect(can("agent", "agency.settings")).toBe(false);
  });
});
