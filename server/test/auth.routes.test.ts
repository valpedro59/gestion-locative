import { eq } from "drizzle-orm";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as schema from "../src/db/schema";
import type { Database } from "../src/db/types";
import { createApp } from "../src/app";
import { signSession } from "../src/lib/session";
import { createAuthService } from "../src/modules/auth/auth.service";
import { createTestDb } from "./helpers";

const PASSWORD = "un-mot-de-passe-solide";

describe("routes d'authentification", () => {
  let db: Database;
  let server: Server;
  let base: string;

  beforeEach(async () => {
    db = await createTestDb();
    server = createApp(db).listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  });
  afterEach(() => new Promise<void>((resolve) => server.close(() => resolve())));

  const call = (method: string, path: string, opts: { body?: unknown; token?: string; cookie?: string } = {}) =>
    fetch(base + path, {
      method,
      headers: {
        "content-type": "application/json",
        ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}),
        ...(opts.cookie ? { cookie: opts.cookie } : {}),
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });

  const sessionSetCookie = (res: Response) => res.headers.getSetCookie().find((c) => c.startsWith("session="))!;
  const cookieHeader = (setCookie: string) => setCookie.split(";")[0]!;

  const newUser = { fullName: "Paul Agent", email: "paul@immo.cg", password: "autre-mot-de-passe" };

  async function seedAgencies() {
    const svc = createAuthService(db);
    const a = await svc.createAgency({ agencyName: "A", country: "CG", fullName: "Admin A", email: "a@a.cg", password: "mot-de-passe-a-1" });
    const b = await svc.createAgency({ agencyName: "B", country: "CG", fullName: "Admin B", email: "b@b.cg", password: "mot-de-passe-b-1" });
    return { svc, a, b };
  }

  async function loginCookie(email = "marie@immo.cg") {
    const res = await call("POST", "/auth/login", { body: { email, password: PASSWORD } });
    return { res, cookie: cookieHeader(sessionSetCookie(res)) };
  }

  async function registerMarie() {
    await createAuthService(db).createAgency({
      agencyName: "Immo", country: "CG", fullName: "Marie", email: "marie@immo.cg", password: PASSWORD,
    });
  }

  it("inscription publique : 201, sans hash dans la réponse", async () => {
    const res = await call("POST", "/auth/register-agency", {
      body: { agencyName: "Immo", fullName: "Marie", email: "Marie@Immo.CG", password: PASSWORD },
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.user.email).toBe("marie@immo.cg");
    expect(body.user.role).toBe("admin");
    expect(JSON.stringify(body)).not.toContain("passwordHash");
  });

  it("inscription : validation (mot de passe trop court)", async () => {
    const res = await call("POST", "/auth/register-agency", {
      body: { agencyName: "Immo", fullName: "Marie", email: "m@i.cg", password: "court" },
    });
    expect(res.status).toBe(400);
  });

  it("connexion : cookie HttpOnly SameSite=Lax, e-mail insensible à la casse, aucun hash renvoyé", async () => {
    await registerMarie();
    const res = await call("POST", "/auth/login", { body: { email: "  Marie@Immo.CG ", password: PASSWORD } });
    expect(res.status).toBe(200);
    const setCookie = sessionSetCookie(res);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    const body = await res.json();
    expect(body.user.email).toBe("marie@immo.cg");
    expect(JSON.stringify(body)).not.toContain("passwordHash");
  });

  it("/me avec le cookie : profil et agence ; sans cookie : 401", async () => {
    await registerMarie();
    const { cookie } = await loginCookie();
    const me = await call("GET", "/me", { cookie });
    expect(me.status).toBe(200);
    const body = await me.json();
    expect(body.user.email).toBe("marie@immo.cg");
    expect(body.agency).toMatchObject({ name: "Immo", country: "CG" });
    expect((await call("GET", "/me")).status).toBe(401);
  });

  it("mauvais mot de passe ou e-mail inconnu : même réponse 401", async () => {
    await registerMarie();
    const wrong = await call("POST", "/auth/login", { body: { email: "marie@immo.cg", password: "mauvais-mot-de-passe" } });
    const unknown = await call("POST", "/auth/login", { body: { email: "inconnu@immo.cg", password: "mauvais-mot-de-passe" } });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(await unknown.json()).toEqual(await wrong.json());
  });

  it("jeton falsifié ou signé avec un autre secret : 401", async () => {
    await registerMarie();
    const jwt = (await import("jsonwebtoken")).default;
    const [user] = await db.select().from(schema.users);
    const forged = jwt.sign({}, "un-autre-secret-un-autre-secret-0123456789", { subject: user!.id });
    expect((await call("GET", "/me", { token: forged })).status).toBe(401);
    expect((await call("GET", "/me", { token: "n-importe-quoi" })).status).toBe(401);
  });

  it("utilisateur désactivé : la session en cours est coupée tout de suite, et il ne peut plus se reconnecter", async () => {
    await registerMarie();
    const { cookie } = await loginCookie();
    expect((await call("GET", "/me", { cookie })).status).toBe(200);

    await db.update(schema.users).set({ isActive: false }).where(eq(schema.users.email, "marie@immo.cg"));

    expect((await call("GET", "/me", { cookie })).status).toBe(401);
    const again = await call("POST", "/auth/login", { body: { email: "marie@immo.cg", password: PASSWORD } });
    expect(again.status).toBe(403);
    expect((await again.json()).error.code).toBe("account_disabled");
  });

  it("déconnexion : 204 et cookie effacé", async () => {
    await registerMarie();
    const { cookie } = await loginCookie();
    const res = await call("POST", "/auth/logout", { cookie });
    expect(res.status).toBe(204);
    expect(sessionSetCookie(res)).toMatch(/Expires=Thu, 01 Jan 1970/i);
  });

  it("ajout d'un utilisateur sans connexion : 401", async () => {
    expect((await call("POST", "/users", { body: newUser })).status).toBe(401);
  });

  it("ajout d'un utilisateur par un agent : 403", async () => {
    const { svc, a } = await seedAgencies();
    const agent = await svc.addUser({ agencyId: a.agency.id, userId: a.user.id }, { ...newUser, role: "agent" });
    const res = await call("POST", "/users", { token: signSession(agent.id), body: { ...newUser, email: "autre@immo.cg" } });
    expect(res.status).toBe(403);
  });

  it("le rôle vient de la base, pas du jeton : un admin rétrogradé perd ses droits immédiatement", async () => {
    const { a } = await seedAgencies();
    const token = signSession(a.user.id);
    expect((await call("POST", "/users", { token, body: newUser })).status).toBe(201);
    await db.update(schema.users).set({ role: "agent" }).where(eq(schema.users.id, a.user.id));
    expect((await call("POST", "/users", { token, body: { ...newUser, email: "autre@immo.cg" } })).status).toBe(403);
  });

  it("l'admin ajoute un agent dans SA agence, même si le corps désigne une autre", async () => {
    const { a, b } = await seedAgencies();
    const res = await call("POST", "/users", { token: signSession(a.user.id), body: { ...newUser, agencyId: b.agency.id } });
    expect(res.status).toBe(201);
    const { user } = await res.json();
    expect(user.agencyId).toBe(a.agency.id);
    expect(user.role).toBe("agent");
    const inB = (await db.select().from(schema.users)).filter((u) => u.agencyId === b.agency.id);
    expect(inB).toHaveLength(1);
  });
});
