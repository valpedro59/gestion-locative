/* ------------------------------------------------------------------ */
/* Montants : FCFA (entiers) avec équivalent en euro à l'affichage     */
/* ------------------------------------------------------------------ */

// Parité fixe du franc CFA (CEMAC) avec l'euro.
// Gardée en constante unique, facile à changer si la parité évoluait.
export const XAF_PER_EUR = 655.957;

export function xafToEur(amountXaf: number): number {
  return Math.round(amountXaf / XAF_PER_EUR);
}

export function formatXaf(amountXaf: number): string {
  return `${amountXaf.toLocaleString("fr-FR")} FCFA`;
}

// "150 000 FCFA (≈ 229 €)"
export function formatRent(amountXaf: number): string {
  return `${formatXaf(amountXaf)} (≈ ${xafToEur(amountXaf).toLocaleString("fr-FR")} €)`;
}

/* ------------------------------------------------------------------ */
/* Échéances                                                          */
/* ------------------------------------------------------------------ */

export type DueStatus = "a_venir" | "partielle" | "payee" | "en_retard";

type DueLike = { amountXaf: number; dueDate: string }; // dueDate : "YYYY-MM-DD"

// paidXaf = somme des paiements au statut "valide" pour cette échéance.
// Un paiement annulé ne compte pas : recalculer après chaque annulation.
export function computeDueStatus(
  due: DueLike,
  paidXaf: number,
  today: string, // "YYYY-MM-DD"
): DueStatus {
  if (paidXaf >= due.amountXaf) return "payee";
  if (today > due.dueDate) return "en_retard";
  if (paidXaf > 0) return "partielle";
  return "a_venir";
}

/* ------------------------------------------------------------------ */
/* Quittance ou reçu                                                  */
/* ------------------------------------------------------------------ */

export type ReceiptKind = "quittance" | "recu";

// paidAfterXaf = total payé sur l'échéance, ce paiement inclus.
// Quittance si l'échéance est soldée, reçu si le paiement est partiel.
// À confirmer avec les règles du pays avant la mise en production.
export function receiptKindFor(
  due: Pick<DueLike, "amountXaf">,
  paidAfterXaf: number,
): ReceiptKind {
  return paidAfterXaf >= due.amountXaf ? "quittance" : "recu";
}

/* ------------------------------------------------------------------ */
/* Génération mensuelle des échéances                                 */
/* ------------------------------------------------------------------ */

// Date limite = jour de paiement du bail, dans le mois de l'échéance.
// paymentDay est borné entre 1 et 28 par une contrainte en base.
export function dueDateFor(period: string, paymentDay: number): string {
  const [year, month] = period.split("-");
  return `${year}-${month}-${String(paymentDay).padStart(2, "0")}`;
}
