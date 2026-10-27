# Gestion locative — API

API d'une application web de gestion locative destinée aux **agences immobilières et gestionnaires de biens** de la République du Congo (Brazzaville). Elle suit les propriétaires, les biens, les locataires, les baux, les loyers, les quittances, les relances et les comptes rendus aux propriétaires.

> **Statut : brouillon (v0.1).** Le schéma de base de données du noyau et la route d'enregistrement de paiement sont en place et testés. Le reste est en cours de construction (voir [État d'avancement](#état-davancement)).

## Principes

- **Pour les agences uniquement** : pas d'espace locataire ni propriétaire. Deux rôles : `admin` (le créateur de l'agence : tous les droits, gestion des utilisateurs et réglages) et `agent` (représente l'admin dans tous les cas, sauf pour la gestion des utilisateurs et les réglages de l'agence).
- **Montants en FCFA**, entiers. Affichage : `150 000 FCFA (≈ 229 €)`, parité fixe 1 € = 655,957 FCFA.
- **L'argent d'abord** : transactions, verrous, idempotence, journal d'audit, aucune suppression de paiement ni de quittance.
- **Règles légales du pays en configuration** (statut « à confirmer » tant qu'elles ne sont pas validées par un professionnel du droit congolais).
- **Français uniquement** pour l'interface, les messages d'erreur et les documents.

## Stack

Node.js · TypeScript (strict) · Express 5 · Drizzle ORM · PostgreSQL (`pg`, TCP) · zod · JWT · Vitest + PGlite.

## Prérequis

- Node.js 22 ou plus récent (testé avec la version 22).
- Une base PostgreSQL (par exemple Neon, avec `sslmode=require` dans l'URL).

## Installation

```bash
npm install
cp .env.example .env     # puis renseigner les valeurs
npm run db:migrate       # applique la migration SQL
npm run dev              # démarre l'API avec rechargement
```

## Configuration

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | URL de connexion PostgreSQL |
| `JWT_SECRET` | Secret de signature des sessions, **32 caractères minimum** |
| `PORT` | Port du serveur (3000 par défaut) |

Le serveur refuse de démarrer si la configuration est invalide.

## Base de données

- Le schéma est dans `src/db/schema.ts`. Les migrations SQL sont dans `drizzle/`.
- Après une modification du schéma : `npm run db:generate`, relire le SQL produit, puis `npm run db:migrate`.
- **Tant que la base ne contient aucune donnée réelle**, la migration initiale peut être régénérée, à condition de **réinitialiser la base** avant (supprimer les schémas `public` et `drizzle`, ou créer une nouvelle base). **Dès les premières données réelles, ne modifiez plus la migration `0000`** : chaque changement passe par une nouvelle migration.

## Tests

```bash
npm run typecheck
npm test
```

Les tests rejouent la vraie migration SQL dans PGlite (Postgres en mémoire) : aucune base externe n'est nécessaire. Ils durent une à deux minutes (une base en mémoire est recréée pour chaque test, et le hachage des mots de passe est volontairement lent).

Limite connue : PGlite n'a qu'une seule connexion, donc le comportement des verrous avec deux connexions simultanées n'est pas couvert. Un test sur un vrai Postgres reste à ajouter.

## Structure

```
src/
  app.ts, server.ts
  db/          schema.ts, client.ts, types.ts
  lib/         domain.ts, env.ts, errors.ts, password.ts, permissions.ts, session.ts
  middleware/  auth.ts, error-handler.ts
  modules/
    auth/      auth.schemas.ts, auth.service.ts, auth.routes.ts
    payments/  payments.schemas.ts, payments.service.ts, payments.routes.ts
test/
drizzle/       migrations SQL
```

Chaque module suit le même modèle : schémas zod, service (règles métier et transactions), routes.

## API

Préfixe `/api/v1`. Format d'erreur : `{ "error": { "code", "message", "details" } }`.

### `POST /api/v1/auth/register-agency` (public)

Crée une agence et son premier utilisateur (`admin`) dans une seule transaction. Corps : `agencyName`, `fullName`, `email`, `password` (10 caractères minimum). `409 email_already_used` si l'e-mail existe déjà.

### `POST /api/v1/auth/login` (public)

Corps : `email`, `password`. Pose le cookie de session et renvoie `{ user }` (sans hash). `401 invalid_credentials` si l'e-mail est inconnu **ou** le mot de passe faux (même réponse dans les deux cas), `403 account_disabled` si le compte est désactivé et le mot de passe correct.

### `POST /api/v1/auth/logout`

Efface le cookie (`204`).

### `GET /api/v1/me`

Profil de l'utilisateur connecté et son agence.

### `POST /api/v1/users` (admin uniquement)

Ajoute un utilisateur (`agent` par défaut) à l'agence **de l'admin connecté** : l'agence vient du jeton de session, jamais du corps de la requête.

### `POST /api/v1/dues/:id/payments`

Enregistre un paiement sur une échéance, émet la quittance (échéance soldée) ou le reçu (paiement partiel) et recalcule le statut de l'échéance, dans une seule transaction.

```bash
curl -X POST http://localhost:3000/api/v1/dues/<id-échéance>/payments \
  -H "Authorization: Bearer <jeton>" \
  -H "Idempotency-Key: <clé unique, 8 caractères minimum>" \
  -H "Content-Type: application/json" \
  -d '{ "amountXaf": 150000, "method": "virement", "paidOn": "2026-10-20", "reference": "VIR-123" }'
```

- `201` à la création, `200` si la même `Idempotency-Key` est rejouée.
- `400` données invalides ou clé manquante · `401` non connecté · `404` échéance introuvable (ou d'une autre agence) · `409` échéance déjà soldée ou clé réutilisée sur une autre échéance · `422` montant supérieur au solde ou date dans le futur.

**Authentification** : cookie `session` (HttpOnly, posé par `/auth/login`) ou en-tête `Authorization: Bearer <jeton>`. Le jeton ne contient que l'identifiant de l'utilisateur (durée : 8 h) ; l'agence et le rôle sont relus en base à chaque requête, donc un utilisateur désactivé ou rétrogradé perd ses droits immédiatement.

## État d'avancement

| Module | État |
|---|---|
| Schéma de base de données du noyau | Fait |
| Paiement d'une échéance, quittance ou reçu, numérotation, audit | Fait |
| Contrôle de session et de permissions | Fait |
| Création d'agence + premier admin, ajout d'utilisateurs par un admin, hachage des mots de passe | Fait |
| Connexion, déconnexion, `/me`, session vérifiée en base (désactivation immédiate) | Fait |
| Mot de passe oublié, modification et désactivation d'utilisateurs, limitation de débit | À faire |
| Propriétaires et mandats · biens et lots · locataires · baux | À faire |
| Génération mensuelle des échéances (tâche planifiée) | À faire |
| PDF des quittances et documents | À faire |
| Relances, dépenses, comptes rendus, tableau de bord | À faire (phase 2) |
| États des lieux, signalements, paramètres et abonnement | À faire (phase 3) |

## Documentation

Les documents de conception sont à part : **PRD** (produit), **FRD** (exigences fonctionnelles) et **TRD** (exigences techniques).

## Limites connues

- Pas de limitation de débit sur `/auth/login` et `/auth/register-agency` (à ajouter avant la mise en production), ni de mot de passe oublié, ni de modification ou désactivation d'utilisateurs.
- Pas de génération de PDF.
- Pas d'annulation de paiement (les colonnes existent, la route reste à écrire).
- Pas d'en-têtes de sécurité (`helmet`), de CORS restreint ni de limitation de débit.
- Règles légales du Congo-Brazzaville à valider (dépôt de garantie, révision du loyer, préavis, quittance ou reçu).
