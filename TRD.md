# TRD — Application de gestion locative (Congo-Brazzaville)

_Technical Requirements Document — version 0.1 (brouillon) — 25 octobre 2026_

## 1. Objet

Ce document décrit l'architecture et les exigences techniques de l'application de gestion locative décrite dans le PRD et le FRD. Il distingue ce qui est **en place** (code écrit et testé) de ce qui est **prévu** ou **à décider**.

## 2. Principes d'architecture

1. **Monolithe modulaire** : un seul déploiement, un module par domaine (paiements, baux, etc.). Choix adapté à un développeur seul ; pas de microservices.
2. **L'argent d'abord** : transactions, verrous, idempotence, audit, aucune suppression.
3. **Règles du pays en configuration**, pas en dur dans le code.
4. **Isolation stricte par agence** sur chaque requête.
5. **Mobile-first, 4G** : pages légères, photos compressées, opérations rejouables sans risque.
6. **Tout est testé contre un vrai Postgres** (PGlite en mémoire), avec la vraie migration SQL.

## 3. Stack technique

| Composant                  | Choix                                                                                 | État                                            |
| -------------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Langage                    | TypeScript, mode `strict`                                                             | En place                                        |
| Serveur                    | Node.js, Express `^5.3.0`                                                             | En place                                        |
| Validation                 | zod `^4.6.7`                                                                          | En place                                        |
| ORM et migrations          | Drizzle ORM `^0.45.4`, drizzle-kit `^0.31.11`                                         | En place                                        |
| Base de données            | PostgreSQL via le driver `pg` `^8.23.1` (connexion TCP) ; hébergement envisagé : Neon | Schéma en place, hébergement à confirmer        |
| Authentification           | JWT (`jsonwebtoken` `^9.0.3`), cookie via `cookie-parser`                             | Contrôle de session en place, connexion à faire |
| Tests                      | Vitest `^5.0.5`, PGlite `^0.5.11`                                                     | En place                                        |
| Exécution en développement | `tsx`                                                                                 | En place                                        |
| Frontend                   | Next.js en PWA, mobile-first                                                          | Prévu                                           |
| Tâches planifiées          | `pg-boss` (file de travaux dans Postgres, sans Redis)                                 | Prévu                                           |
| Génération de PDF          | Bibliothèque à choisir (voir § 12)                                                    | À décider                                       |
| Stockage de fichiers       | Stockage compatible S3                                                                | Prévu, fournisseur à choisir                    |

## 4. Structure du code

```
src/
  app.ts, server.ts
  db/          schema.ts, client.ts, types.ts
  lib/         domain.ts, env.ts, errors.ts, permissions.ts
  middleware/  auth.ts, error-handler.ts
  modules/
    payments/  payments.schemas.ts, payments.service.ts, payments.routes.ts
test/          domain, permissions, payments.service
drizzle/       migrations SQL générées
```

Chaque module suit le même modèle : **schémas zod** (entrées), **service** (règles métier, transactions), **routes** (HTTP). Le service reçoit la base en paramètre (`createPaymentsService(db)`), ce qui permet de le tester avec PGlite.

## 5. Modèle de données

### Conventions

- Clés primaires `uuid` (`gen_random_uuid()`), horodatages `timestamptz`.
- Montants en FCFA, entiers (`*_xaf`) ; l'euro n'est jamais stocké.
- Dates métier de type `date`, manipulées au format AAAA-MM-JJ.
- Presque toutes les tables portent `agency_id`, indexé.
- Types énumérés Postgres pour les statuts (bail, échéance, paiement, quittance, mouvement de dépôt, entité de document, statut de règle) ; le rôle n'a pour l'instant qu'une valeur, `admin`.

### Contraintes garanties par la base

| Contrainte                                                                               | Effet                                                                 |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Index unique partiel sur `leases(unit_id)` pour les statuts `actif` et `preavis`         | Un seul bail en cours par lot (RG-08)                                 |
| Unique `dues(lease_id, period)`                                                          | Une échéance par bail et par mois ; tâche mensuelle rejouable (RG-09) |
| Unique `payments(agency_id, idempotency_key)`                                            | Idempotence des paiements (RG-15)                                     |
| Unique `receipts(agency_id, number)` et `receipts(payment_id)`                           | Numérotation sans doublon, une quittance par paiement (RG-12)         |
| Unique `units(property_id, label)`                                                       | Libellé de lot unique dans un bien                                    |
| `CHECK` sur montants positifs, jour de paiement entre 1 et 28, commission entre 0 et 100 | Données cohérentes                                                    |
| `CHECK` : un paiement est `annule` si et seulement si `cancelled_at` est renseigné       | Annulation toujours horodatée (RG-04)                                 |

### Migrations

Générées par `drizzle-kit generate`, appliquées par `drizzle-kit migrate`. Tant qu'aucune donnée réelle n'existe, la migration initiale peut être régénérée après réinitialisation de la base. **Dès les premières données réelles, `0000` n'est plus modifiée** : tout changement passe par une migration incrémentale.

## 6. API

- Préfixe `/api/v1`, JSON, taille de corps limitée à 100 ko.
- L'agence vient de la session, jamais de l'URL.
- Route de santé : `GET /health`.
- Format d'erreur unique : `{ "error": { "code", "message", "details" } }`, messages en français.

| Statut | Codes d'erreur actuels                         |
| ------ | ---------------------------------------------- |
| 400    | `validation_error`, `idempotency_key_required` |
| 401    | `unauthenticated`, `invalid_session`           |
| 403    | `forbidden`                                    |
| 404    | `not_found`                                    |
| 409    | `due_already_paid`, `idempotency_key_reused`   |
| 422    | `amount_exceeds_balance`, `paid_on_in_future`  |
| 500    | `internal_error`                               |

**Route en place** : `POST /api/v1/dues/:id/payments` (en-tête `Idempotency-Key` obligatoire ; `201` à la création, `200` pour un rejeu).

**À prévoir pour les listes** : pagination `?page=&limit=`, recherche `q`, filtres par statut.

## 7. Authentification et autorisations

**En place** : middleware `requireAuth` (lit le cookie `session` ou l'en-tête `Authorization: Bearer`, vérifie le JWT, exige les champs `sub`, `agencyId`, `role`) et `requirePermission(permission)`. Le rôle unique `admin` possède toutes les permissions (`src/lib/permissions.ts`). Ajouter un rôle restreint se fait dans ce fichier et dans l'énumération du schéma, sans toucher aux routes.

**À faire (module 1)** : création d'agence et du premier admin, connexion, déconnexion, réinitialisation du mot de passe, `/me`, gestion des utilisateurs, interdiction de désactiver le dernier utilisateur actif.

**Exigences** :

- Cookie de session `HttpOnly`, `Secure`, `SameSite` strict ou lax ; pour les requêtes modifiantes authentifiées par cookie, contrôler l'en-tête `Origin`.
- Hachage des mots de passe avec un algorithme dédié (argon2id recommandé, bcrypt acceptable) : choix à faire.
- `JWT_SECRET` d'au moins 32 caractères ; durée de vie courte du jeton ; politique de renouvellement à définir.
- Limitation de débit sur la connexion et la réinitialisation du mot de passe.

## 8. Isolation entre agences

Chaque requête métier filtre par `agency_id` issu de la session. Une ressource d'une autre agence répond « introuvable » (404), pour ne pas révéler son existence. Ce comportement est testé pour les paiements. **À envisager** : sécurité au niveau des lignes (RLS) de Postgres en deuxième ligne de défense.

## 9. Transactions, concurrence et idempotence

Enregistrement d'un paiement, dans **une seule transaction** :

1. Verrouiller l'échéance (`SELECT ... FOR UPDATE`) en vérifiant l'agence. Deux requêtes simultanées sur la même échéance passent l'une après l'autre.
2. Chercher une clé d'idempotence existante : même échéance, renvoyer le résultat initial ; autre échéance, refuser (409).
3. Valider : date non future, échéance non soldée, montant ≤ solde.
4. Insérer le paiement, recalculer le statut de l'échéance.
5. Incrémenter atomiquement `agencies.receipt_counter` (`UPDATE ... RETURNING`, verrou de ligne), insérer la quittance ou le reçu avec ce numéro. Si la transaction échoue, le compteur revient en arrière : pas de trou.
6. Écrire la ligne d'audit.

La génération du PDF se fait **après le commit**, dans une tâche de fond : la ligne de quittance existe avec `pdf_storage_key` à `null` jusque-là.

Le driver HTTP de Neon ne gère pas les transactions interactives : on utilise donc le driver `pg` en TCP, avec un pool de 10 connexions.

## 10. Montants, dates et devise

- `formatRent(150000)` renvoie « 150 000 FCFA (≈ 229 €) ». La parité `XAF_PER_EUR = 655,957` est une constante unique dans `src/lib/domain.ts`.
- Le jour courant est calculé au fuseau `Africa/Brazzaville`.
- Fonctions métier pures et testées : `computeDueStatus`, `receiptKindFor`, `dueDateFor`.
- **Extension Maroc** : la devise (MAD), ses règles et ses textes ne sont pas gérés. Prévoir une devise par agence et des règles par pays avant d'ouvrir ce marché.

## 11. Tâches planifiées (prévu)

Avec `pg-boss`, sur la même base Postgres :

| Tâche                              | Rôle                                                                             |
| ---------------------------------- | -------------------------------------------------------------------------------- |
| Génération mensuelle des échéances | Une échéance par bail actif ; idempotente grâce à l'unicité `(lease_id, period)` |
| Passage en retard                  | Recalcul quotidien des statuts d'échéance                                        |
| Relances                           | Envoi par paliers (phase 2)                                                      |
| Alertes de fin de bail             | Liste des baux proches de leur terme                                             |
| PDF de quittance                   | Génération après commit, avec reprise en cas d'échec                             |

## 12. Documents PDF et stockage (prévu)

- Documents à générer : contrat de bail, quittance ou reçu, avis d'échéance, relance, état des lieux, compte rendu propriétaire.
- **Décision à prendre** sur l'outil : un rendu de modèles HTML par un navigateur sans interface (fidèle mais lourd pour un petit serveur) ou une bibliothèque PDF programmatique (plus légère, mise en page à coder).
- Fichiers (justificatifs, photos, PDF) dans un stockage compatible S3 ; la base ne garde que la clé (`storage_key`). Téléchargement par URL signée à durée limitée.
- Photos compressées côté client avant envoi (4G).

## 13. Frontend (prévu)

- Next.js, installable en PWA, mobile-first, tableaux plus denses sur PC.
- Consomme l'API avec le cookie de session ; messages d'erreur issus des codes de l'API.
- Hors ligne : pas en v1.
- Décision à prendre : même dépôt que l'API ou dépôt séparé.

## 14. Sécurité

| Sujet                | Exigence                                                                                                  | État                                   |
| -------------------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Entrées              | Validation zod sur toutes les routes                                                                      | En place pour les paiements            |
| Secrets              | Variables d'environnement, jamais dans le code                                                            | En place                               |
| En-têtes HTTP        | `helmet`, CORS limité à l'origine du frontend                                                             | À faire                                |
| Limitation de débit  | Connexion, réinitialisation, API en général                                                               | À faire                                |
| Mots de passe        | Hachage dédié                                                                                             | À faire                                |
| Fichiers             | Contrôle du type et de la taille, URL signées                                                             | À faire                                |
| Journal d'audit      | Opérations sensibles                                                                                      | En place pour les paiements, à étendre |
| Données personnelles | Noms, téléphones, e-mails de locataires et propriétaires : accès limité à l'agence, sauvegardes protégées | À formaliser                           |
| Dépendances          | Mise à jour régulière, audit des paquets                                                                  | À faire                                |

## 15. Qualité et tests

- **16 tests automatisés** passent : 11 sur l'enregistrement de paiement, 4 sur les règles métier pures, 1 sur les permissions. Durée d'environ 30 secondes (une base mémoire recréée par test).
- Les tests rejouent la **vraie migration SQL** dans PGlite : un écart entre le schéma et la migration serait détecté.
- `npm run typecheck` : vérification des types.
- **Limite connue** : PGlite n'a qu'une connexion, donc les tests ne prouvent pas le comportement du verrou avec deux connexions réelles. Un test de concurrence sur un vrai Postgres est à ajouter.
- Intégration continue (typecheck et tests à chaque envoi) : à mettre en place.

## 16. Configuration et déploiement

| Variable       | Rôle                                                  |
| -------------- | ----------------------------------------------------- |
| `DATABASE_URL` | Connexion Postgres (avec `sslmode=require` pour Neon) |
| `JWT_SECRET`   | Secret de signature, 32 caractères minimum            |
| `PORT`         | Port du serveur, 3000 par défaut                      |

Le serveur refuse de démarrer si la configuration est invalide (validation zod au démarrage).

Déploiement : à décider. Il faut un hébergeur Node.js, une base Postgres gérée, un stockage de fichiers et un moyen d'envoyer des e-mails. Le choix doit tenir compte de la latence depuis le Congo-Brazzaville et du coût en devise.

## 17. Observabilité et sauvegardes

- Logs structurés (pino envisagé), sans données personnelles ni secrets.
- Suivi des erreurs : outil à choisir.
- Sauvegardes de la base et possibilité de restauration à un instant donné selon l'offre de l'hébergeur ; test de restauration avant le premier client réel.

## 18. Exigences non fonctionnelles

Les cibles chiffrées (temps de réponse, disponibilité, taille de la base) sont à définir avec les premiers retours d'agences. Qualitativement : réponses rapides sur 4G, aucune perte ni duplication de paiement en cas de coupure réseau, données isolées entre agences.

## 19. Décisions d'architecture

| Décision                                                | Raison                                                                              |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Monolithe modulaire                                     | Développeur seul ; simplicité de déploiement                                        |
| PostgreSQL + Drizzle                                    | Contraintes et transactions solides ; types TypeScript                              |
| Driver `pg` en TCP                                      | Le driver HTTP de Neon ne gère pas les transactions interactives                    |
| Montants en FCFA entiers                                | Pas d'erreurs d'arrondi ; le FCFA n'a pas de décimales                              |
| Parité fixe 655,957 en constante                        | Parité officielle fixe ; un seul endroit à modifier                                 |
| Rôle unique `admin` + contrôle de permission centralisé | Agences de 1 à 2 personnes ; évolutif sans réécrire les routes                      |
| Clé d'idempotence obligatoire sur les paiements         | Coupures 4G et doubles clics                                                        |
| Un paiement = une échéance                              | Version simple ; l'affectation multi-échéances peut s'ajouter sans casser le schéma |
| Aucune suppression de paiement ou de quittance          | Traçabilité comptable                                                               |
| Compteur de quittances dans la ligne de l'agence        | Incrément atomique, sans trou                                                       |
| Règles du pays en table de configuration                | Les règles légales ne sont pas encore validées                                      |
| Pas d'espace locataire                                  | Simplifie le produit et l'authentification ; réversible                             |

## 20. Limites connues et dette technique

- Pas encore de connexion, de gestion des utilisateurs ni de génération de PDF.
- Annulation d'un paiement : colonnes prêtes, route à écrire.
- Relations Drizzle (`relations()`) non écrites.
- Pas de sécurité au niveau des lignes, pas de limitation de débit, pas d'en-têtes de sécurité.
- Pas de test de concurrence sur un vrai Postgres.
- Le choix « quittance si soldé, reçu si partiel » et le refus des surpaiements restent à valider avec les règles du pays.
- Tables des phases 2 et 3 non encore créées.

## 21. Feuille de route technique

1. Module 1 : authentification, création d'agence, gestion des utilisateurs.
2. Modules 2 à 5 : propriétaires et mandats, biens et lots, locataires, baux.
3. Module 6 : génération mensuelle des échéances (tâche planifiée), annulation de paiement.
4. Module 7 : PDF de quittance, stockage de documents.
5. Sécurité de base (helmet, CORS, limitation de débit), CI, test de concurrence sur Postgres réel.
6. Frontend PWA sur le noyau, puis phases 2 et 3.
