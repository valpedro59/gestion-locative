import { describe, expect, it } from "vitest";
import { computeDueStatus, dueDateFor, formatRent, receiptKindFor, xafToEur } from "../src/lib/domain";

describe("domain", () => {
  it("formate un loyer avec l'euro entre parenthèses", () => {
    expect(xafToEur(150000)).toBe(229);
    expect(formatRent(150000).replace(/\s/g, " ")).toBe("150 000 FCFA (≈ 229 €)");
  });
  it("calcule le statut d'une échéance", () => {
    const due = { amountXaf: 100, dueDate: "2026-10-05" };
    expect(computeDueStatus(due, 100, "2026-10-24")).toBe("payee");
    expect(computeDueStatus(due, 0, "2026-10-24")).toBe("en_retard");
    expect(computeDueStatus(due, 0, "2026-10-01")).toBe("a_venir");
    expect(computeDueStatus(due, 40, "2026-10-01")).toBe("partielle");
  });
  it("choisit quittance ou reçu", () => {
    expect(receiptKindFor({ amountXaf: 100 }, 100)).toBe("quittance");
    expect(receiptKindFor({ amountXaf: 100 }, 99)).toBe("recu");
  });
  it("calcule la date limite", () => {
    expect(dueDateFor("2026-10-01", 5)).toBe("2026-10-05");
  });
});
