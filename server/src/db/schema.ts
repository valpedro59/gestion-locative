import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Enums                                                              */
/* ------------------------------------------------------------------ */

export const roleEnum = pgEnum("role", ["admin", "agent"]);

export const leaseStatusEnum = pgEnum("lease_status", [
  "brouillon",
  "actif",
  "preavis",
  "termine",
]);

export const dueStatusEnum = pgEnum("due_status", [
  "a_venir",
  "partielle",
  "payee",
  "en_retard",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "virement",
  "especes",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "valide",
  "annule",
]);

export const receiptKindEnum = pgEnum("receipt_kind", ["quittance", "recu"]);

export const depositMovementTypeEnum = pgEnum("deposit_movement_type", [
  "encaissement",
  "retenue",
  "restitution",
]);

export const documentEntityEnum = pgEnum("document_entity", [
  "bail",
  "bien",
  "lot",
  "locataire",
  "proprietaire",
  "etat_des_lieux",
  "signalement",
  "paiement",
]);

export const ruleStatusEnum = pgEnum("rule_status", [
  "a_confirmer",
  "valide",
]);

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

/* ------------------------------------------------------------------ */
/* Agences et utilisateurs                                            */
/* ------------------------------------------------------------------ */

export const agencies = pgTable("agencies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  country: text("country").notNull().default("CG"),
  plan: text("plan").notNull().default("essai"),
  // Compteur incrémenté dans une transaction (SELECT ... FOR UPDATE)
  // pour numéroter les quittances sans trou ni doublon.
  receiptCounter: integer("receipt_counter").notNull().default(0),
  ...timestamps,
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: uuid("agency_id")
      .notNull()
      .references(() => agencies.id),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    fullName: text("full_name").notNull(),
    role: roleEnum("role").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("users_email_uq").on(t.email),
    index("users_agency_idx").on(t.agencyId),
  ],
);

/* ------------------------------------------------------------------ */
/* Propriétaires et mandats                                           */
/* ------------------------------------------------------------------ */

export const owners = pgTable(
  "owners",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: uuid("agency_id")
      .notNull()
      .references(() => agencies.id),
    fullName: text("full_name").notNull(),
    phone: text("phone"),
    email: text("email"),
    address: text("address"),
    ...timestamps,
  },
  (t) => [index("owners_agency_idx").on(t.agencyId)],
);

export const mandates = pgTable(
  "mandates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: uuid("agency_id")
      .notNull()
      .references(() => agencies.id),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => owners.id),
    commissionPct: numeric("commission_pct", { precision: 5, scale: 2 }).notNull(),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on"),
    ...timestamps,
  },
  (t) => [
    index("mandates_agency_idx").on(t.agencyId),
    index("mandates_owner_idx").on(t.ownerId),
    check(
      "mandates_commission_range",
      sql`${t.commissionPct} >= 0 AND ${t.commissionPct} <= 100`,
    ),
  ],
);

/* ------------------------------------------------------------------ */
/* Biens et lots                                                      */
/* ------------------------------------------------------------------ */

export const properties = pgTable(
  "properties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: uuid("agency_id")
      .notNull()
      .references(() => agencies.id),
    mandateId: uuid("mandate_id")
      .notNull()
      .references(() => mandates.id),
    name: text("name").notNull(),
    address: text("address").notNull(),
    city: text("city"),
    ...timestamps,
  },
  (t) => [
    index("properties_agency_idx").on(t.agencyId),
    index("properties_mandate_idx").on(t.mandateId),
  ],
);

export const units = pgTable(
  "units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: uuid("agency_id")
      .notNull()
      .references(() => agencies.id),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
    label: text("label").notNull(),
    defaultRentXaf: integer("default_rent_xaf").notNull().default(0),
    defaultChargesXaf: integer("default_charges_xaf").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    index("units_agency_idx").on(t.agencyId),
    uniqueIndex("units_property_label_uq").on(t.propertyId, t.label),
  ],
);

/* ------------------------------------------------------------------ */
/* Locataires                                                         */
/* ------------------------------------------------------------------ */

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: uuid("agency_id")
      .notNull()
      .references(() => agencies.id),
    fullName: text("full_name").notNull(),
    phone: text("phone"),
    email: text("email"),
    ...timestamps,
  },
  (t) => [
    index("tenants_agency_idx").on(t.agencyId),
  ],
);

/* ------------------------------------------------------------------ */
/* Baux                                                               */
/* ------------------------------------------------------------------ */

export const leases = pgTable(
  "leases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: uuid("agency_id")
      .notNull()
      .references(() => agencies.id),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id),
    status: leaseStatusEnum("status").notNull().default("brouillon"),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on"),
    rentXaf: integer("rent_xaf").notNull(),
    chargesXaf: integer("charges_xaf").notNull().default(0),
    depositXaf: integer("deposit_xaf").notNull().default(0),
    paymentDay: integer("payment_day").notNull().default(5),
    revisionClause: boolean("revision_clause").notNull().default(false),
    noticeGivenOn: date("notice_given_on"),
    terminatedOn: date("terminated_on"),
    ...timestamps,
  },
  (t) => [
    index("leases_agency_idx").on(t.agencyId),
    index("leases_tenant_idx").on(t.tenantId),
    // Un lot ne peut avoir qu'un seul bail en cours.
    uniqueIndex("leases_one_active_per_unit_uq")
      .on(t.unitId)
      .where(sql`${t.status} IN ('actif', 'preavis')`),
    check("leases_rent_positive", sql`${t.rentXaf} > 0`),
    check("leases_amounts_nonneg", sql`${t.chargesXaf} >= 0 AND ${t.depositXaf} >= 0`),
    check("leases_payment_day", sql`${t.paymentDay} BETWEEN 1 AND 28`),
  ],
);

export const depositMovements = pgTable(
  "deposit_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: uuid("agency_id")
      .notNull()
      .references(() => agencies.id),
    leaseId: uuid("lease_id")
      .notNull()
      .references(() => leases.id),
    type: depositMovementTypeEnum("type").notNull(),
    amountXaf: integer("amount_xaf").notNull(),
    occurredOn: date("occurred_on").notNull(),
    note: text("note"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    index("deposit_movements_lease_idx").on(t.leaseId),
    check("deposit_movements_amount_positive", sql`${t.amountXaf} > 0`),
  ],
);

/* ------------------------------------------------------------------ */
/* Échéances, paiements, quittances                                   */
/* ------------------------------------------------------------------ */

export const dues = pgTable(
  "dues",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: uuid("agency_id")
      .notNull()
      .references(() => agencies.id),
    leaseId: uuid("lease_id")
      .notNull()
      .references(() => leases.id),
    // Premier jour du mois concerné.
    period: date("period").notNull(),
    dueDate: date("due_date").notNull(),
    amountXaf: integer("amount_xaf").notNull(),
    // Recalculé à chaque paiement ou annulation, et par la tâche nocturne.
    status: dueStatusEnum("status").notNull().default("a_venir"),
    ...timestamps,
  },
  (t) => [
    index("dues_agency_status_idx").on(t.agencyId, t.status),
    // Garantit l'idempotence de la tâche mensuelle de génération.
    uniqueIndex("dues_lease_period_uq").on(t.leaseId, t.period),
    check("dues_amount_positive", sql`${t.amountXaf} > 0`),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: uuid("agency_id")
      .notNull()
      .references(() => agencies.id),
    // Version simple : un paiement règle une seule échéance.
    dueId: uuid("due_id")
      .notNull()
      .references(() => dues.id),
    amountXaf: integer("amount_xaf").notNull(),
    method: paymentMethodEnum("method").notNull(),
    paidOn: date("paid_on").notNull(),
    reference: text("reference"),
    status: paymentStatusEnum("status").notNull().default("valide"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: uuid("cancelled_by").references(() => users.id),
    cancelReason: text("cancel_reason"),
    idempotencyKey: text("idempotency_key"),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    index("payments_due_idx").on(t.dueId),
    index("payments_agency_paid_on_idx").on(t.agencyId, t.paidOn),
    uniqueIndex("payments_idempotency_uq").on(t.agencyId, t.idempotencyKey),
    check("payments_amount_positive", sql`${t.amountXaf} > 0`),
    check(
      "payments_cancel_consistent",
      sql`(${t.status} = 'annule') = (${t.cancelledAt} IS NOT NULL)`,
    ),
  ],
);

export const receipts = pgTable(
  "receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: uuid("agency_id")
      .notNull()
      .references(() => agencies.id),
    paymentId: uuid("payment_id")
      .notNull()
      .references(() => payments.id),
    number: integer("number").notNull(),
    kind: receiptKindEnum("kind").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    pdfStorageKey: text("pdf_storage_key"),
  },
  (t) => [
    uniqueIndex("receipts_payment_uq").on(t.paymentId),
    uniqueIndex("receipts_agency_number_uq").on(t.agencyId, t.number),
  ],
);

/* ------------------------------------------------------------------ */
/* Documents, règles du pays, audit                                   */
/* ------------------------------------------------------------------ */

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: uuid("agency_id")
      .notNull()
      .references(() => agencies.id),
    entityType: documentEntityEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageKey: text("storage_key").notNull(),
    uploadedBy: uuid("uploaded_by").references(() => users.id),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    index("documents_entity_idx").on(t.agencyId, t.entityType, t.entityId),
  ],
);

export const countryRules = pgTable(
  "country_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    country: text("country").notNull(),
    key: text("key").notNull(),
    // Exemple : { "max_months": 2 } ou { "months": 3 }
    value: jsonb("value").notNull(),
    status: ruleStatusEnum("status").notNull().default("a_confirmer"),
    source: text("source"),
    updatedAt: timestamps.updatedAt,
  },
  (t) => [uniqueIndex("country_rules_uq").on(t.country, t.key)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agencyId: uuid("agency_id").references(() => agencies.id),
    userId: uuid("user_id").references(() => users.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    index("audit_log_entity_idx").on(t.entityType, t.entityId),
    index("audit_log_agency_created_idx").on(t.agencyId, t.createdAt),
  ],
);
