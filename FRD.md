# FRD — Application de gestion locative (Congo-Brazzaville)

_Functional Requirements Document — version 0.1 (brouillon) — 25 octobre 2026_

## 0. Conventions

- **FR-xxx** : exigence fonctionnelle. **RG-xx** : règle de gestion transversale.
- **Phase** : 1 (noyau), 2 (suivi de l'argent), 3 (compléments), comme dans le PRD.
- **État** : _Fait_ (implémenté et testé), _À faire_.
- Les règles légales du pays sont des paramètres **« à confirmer »** tant qu'un notaire ou un avocat du Congo-Brazzaville ne les a pas validées.

## 1. Acteurs et droits

| Acteur                 | Accès           | Droits                                                              |
| ---------------------- | --------------- | ------------------------------------------------------------------- |
| Utilisateur d'agence   | Application web | Rôle unique `admin` : tous les droits sur les données de son agence |
| Propriétaire (mandant) | Aucun           | Reçoit ses comptes rendus en PDF                                    |
| Locataire              | Aucun           | Reçoit quittances, avis d'échéance et relances en PDF               |

Toute action passe par un contrôle de permission centralisé (`requirePermission`). Ajouter un rôle restreint plus tard ne doit pas obliger à modifier les routes.

## 2. Règles de gestion transversales

| ID    | Règle                                                                                                                                                                                                                                                                                   |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RG-01 | Les montants sont stockés en FCFA, en nombres entiers.                                                                                                                                                                                                                                  |
| RG-02 | Affichage d'un montant : « 150 000 FCFA (≈ 229 €) ». Parité fixe 1 € = 655,957 FCFA, équivalent arrondi à l'euro. L'euro n'est jamais stocké.                                                                                                                                           |
| RG-03 | Toutes les données appartiennent à une agence ; un utilisateur ne voit et ne modifie que celles de son agence. Une ressource d'une autre agence se comporte comme « introuvable ».                                                                                                      |
| RG-04 | Un paiement et une quittance ne sont jamais supprimés. Une erreur s'annule, avec date, auteur et motif.                                                                                                                                                                                 |
| RG-05 | Les opérations sensibles (paiements, annulations, baux, dépôts de garantie, comptes rendus, utilisateurs) écrivent une ligne d'audit : qui, quoi, quand, valeurs avant et après.                                                                                                        |
| RG-06 | Les dates du jour sont calculées au fuseau Africa/Brazzaville (UTC+1). Les dates métier sont au format AAAA-MM-JJ.                                                                                                                                                                      |
| RG-07 | Les règles légales (plafond du dépôt de garantie, révision du loyer, préavis, délais de restitution, enregistrement du bail) sont lues depuis une table de paramètres par pays, avec un statut « à confirmer » ou « validé ». Elles produisent des avertissements, jamais des blocages. |
| RG-08 | Un lot ne peut avoir qu'un seul bail en cours (statut « actif » ou « préavis »).                                                                                                                                                                                                        |
| RG-09 | Il existe au plus une échéance par bail et par mois.                                                                                                                                                                                                                                    |
| RG-10 | Un paiement règle une seule échéance, et son montant ne peut pas dépasser le solde restant de cette échéance. Un paiement d'avance se saisit en un paiement par échéance.                                                                                                               |
| RG-11 | Un paiement qui solde l'échéance produit une **quittance** ; un paiement partiel produit un **reçu**. À valider avec les règles du pays.                                                                                                                                                |
| RG-12 | Les quittances et reçus sont numérotés de façon séquentielle par agence, sans doublon ni trou.                                                                                                                                                                                          |
| RG-13 | Statut d'une échéance : _payée_ si la somme des paiements valides atteint le montant dû ; sinon _en retard_ si la date limite est dépassée ; sinon _partielle_ si un paiement existe ; sinon _à venir_.                                                                                 |
| RG-14 | Interface, messages d'erreur et documents générés sont en français.                                                                                                                                                                                                                     |
| RG-15 | Une saisie de paiement est idempotente : rejouer la même requête ne crée ni second paiement ni seconde quittance.                                                                                                                                                                       |

## 3. Exigences par module

### Phase 1 — Noyau

#### M1. Authentification et agence

| ID         | Exigence                                                                                            | État                                                     |
| ---------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| FR-AUTH-01 | La création d'une agence crée en même temps son premier utilisateur, avec le rôle `admin`.          | À faire                                                  |
| FR-AUTH-02 | Se connecter par e-mail et mot de passe.                                                            | À faire                                                  |
| FR-AUTH-03 | La session est portée par un cookie HttpOnly ; l'en-tête `Authorization: Bearer` est aussi accepté. | Contrôle de session fait, création de la session à faire |
| FR-AUTH-04 | Se déconnecter.                                                                                     | À faire                                                  |
| FR-AUTH-05 | Réinitialiser son mot de passe par e-mail.                                                          | À faire                                                  |
| FR-AUTH-06 | Consulter et modifier son profil (`/me`).                                                           | À faire                                                  |
| FR-AUTH-07 | Créer, modifier et désactiver des utilisateurs de l'agence. Tout nouvel utilisateur est `admin`.    | À faire                                                  |
| FR-AUTH-08 | Il est impossible de désactiver le dernier utilisateur actif d'une agence.                          | À faire                                                  |
| FR-AUTH-09 | Consulter et modifier les informations de l'agence (nom, pays).                                     | À faire                                                  |

#### M2. Propriétaires et mandats

| ID        | Exigence                                                                                                                       | État    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------ | ------- |
| FR-OWN-01 | Créer, consulter, modifier un propriétaire (nom, téléphone, e-mail, adresse).                                                  | À faire |
| FR-OWN-02 | Créer un mandat rattaché à un propriétaire : pourcentage de commission entre 0 et 100, date de début, date de fin facultative. | À faire |
| FR-OWN-03 | Terminer un mandat.                                                                                                            | À faire |
| FR-OWN-04 | La fiche propriétaire affiche ses mandats, ses biens et ses comptes rendus.                                                    | À faire |

#### M3. Biens et lots

| ID        | Exigence                                                                                                | État    |
| --------- | ------------------------------------------------------------------------------------------------------- | ------- |
| FR-PRO-01 | Créer un bien (nom, adresse, ville), rattaché à un mandat.                                              | À faire |
| FR-PRO-02 | Créer des lots dans un bien (libellé, loyer et charges par défaut). Le libellé est unique dans un bien. | À faire |
| FR-PRO-03 | La fiche lot affiche l'occupant actuel et l'historique des baux.                                        | À faire |
| FR-PRO-04 | Désactiver un lot sans le supprimer.                                                                    | À faire |

#### M4. Locataires

| ID        | Exigence                                                          | État    |
| --------- | ----------------------------------------------------------------- | ------- |
| FR-TEN-01 | Créer, consulter, modifier un locataire (nom, téléphone, e-mail). | À faire |
| FR-TEN-02 | Rechercher un locataire par nom ou téléphone.                     | À faire |
| FR-TEN-03 | La fiche locataire affiche ses baux, paiements et documents.      | À faire |

#### M5. Baux

| ID        | Exigence                                                                                                                                                                                                                       | État    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| FR-LSE-01 | Créer un bail en étapes : lot, locataire, conditions, dépôt de garantie, contrat. Champs : date de début, date de fin facultative, loyer, charges, dépôt de garantie, jour de paiement (1 à 28), clause de révision (oui/non). | À faire |
| FR-LSE-02 | Cycle de vie : brouillon → actif → préavis → terminé.                                                                                                                                                                          | À faire |
| FR-LSE-03 | À la création et à l'activation, afficher des avertissements issus des règles du pays (dépôt au-dessus du plafond, etc.), sans bloquer.                                                                                        | À faire |
| FR-LSE-04 | Générer le contrat de bail en PDF, en français.                                                                                                                                                                                | À faire |
| FR-LSE-05 | Enregistrer les mouvements du dépôt de garantie : encaissement, retenue, restitution, avec montant, date et note.                                                                                                              | À faire |
| FR-LSE-06 | Enregistrer un préavis (date de notification), puis la fin du bail.                                                                                                                                                            | À faire |
| FR-LSE-07 | Calculer les retenues et la restitution du dépôt à la sortie, avec rappel du délai légal paramétré.                                                                                                                            | À faire |

#### M6. Échéances et paiements

| ID        | Exigence                                                                                                                                          | État     |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-DUE-01 | Une tâche planifiée génère chaque mois les échéances des baux actifs. Elle est rejouable sans doublon (RG-09).                                    | À faire  |
| FR-DUE-02 | Lister les échéances avec filtres : mois, statut, bail.                                                                                           | À faire  |
| FR-PAY-01 | Enregistrer un paiement sur une échéance : montant, mode (virement ou espèces), date de paiement, référence facultative, justificatif facultatif. | **Fait** |
| FR-PAY-02 | Refuser un paiement dont la date est dans le futur, dont le montant dépasse le solde, ou sur une échéance déjà soldée.                            | **Fait** |
| FR-PAY-03 | La saisie exige une clé d'idempotence ; la rejouer renvoie le résultat initial. Réutiliser la clé sur une autre échéance est refusé.              | **Fait** |
| FR-PAY-04 | Après chaque paiement, recalculer le statut de l'échéance (RG-13), émettre la quittance ou le reçu (RG-11, RG-12) et écrire l'audit (RG-05).      | **Fait** |
| FR-PAY-05 | Annuler un paiement avec un motif obligatoire ; le statut de l'échéance est recalculé.                                                            | À faire  |
| FR-PAY-06 | Consulter l'historique des paiements d'un bail.                                                                                                   | À faire  |

#### M7. Quittances et documents

| ID        | Exigence                                                                                                                             | État     |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| FR-RCP-01 | Numérotation séquentielle par agence des quittances et reçus.                                                                        | **Fait** |
| FR-RCP-02 | Générer le PDF de la quittance ou du reçu, après l'enregistrement du paiement.                                                       | À faire  |
| FR-RCP-03 | Télécharger le PDF et l'envoyer par e-mail.                                                                                          | À faire  |
| FR-DOC-01 | Téléverser un document rattaché à un bail, un bien, un lot, un locataire, un propriétaire ou un paiement. Taille maximale à définir. | À faire  |
| FR-DOC-02 | Lister, télécharger et supprimer les documents.                                                                                      | À faire  |

### Phase 2 — Suivi de l'argent

#### M8. Relances et avis d'échéance

| ID        | Exigence                                                                                          | État    |
| --------- | ------------------------------------------------------------------------------------------------- | ------- |
| FR-RMD-01 | Générer l'avis d'échéance de chaque loyer à venir, en PDF.                                        | À faire |
| FR-RMD-02 | Lister les impayés avec leur niveau de relance.                                                   | À faire |
| FR-RMD-03 | Relances par paliers : rappel, deuxième rappel, mise en demeure. Modèles de messages modifiables. | À faire |
| FR-RMD-04 | Envoyer une relance manuellement ; historique des relances par échéance.                          | À faire |

#### M9. Dépenses

| ID        | Exigence                                                                                                                     | État    |
| --------- | ---------------------------------------------------------------------------------------------------------------------------- | ------- |
| FR-EXP-01 | Enregistrer une dépense sur un bien ou un lot : catégorie, montant, date, justificatif, refacturable au propriétaire ou non. | À faire |
| FR-EXP-02 | Lister et filtrer les dépenses par bien, lot, période.                                                                       | À faire |

#### M10. Comptes rendus propriétaires

| ID        | Exigence                                                                                                                      | État    |
| --------- | ----------------------------------------------------------------------------------------------------------------------------- | ------- |
| FR-STM-01 | Calculer, pour un propriétaire et un mois : loyers encaissés, commission de l'agence, dépenses refacturables, net à reverser. | À faire |
| FR-STM-02 | Aperçu sans enregistrer, puis clôture du mois. Une fois clôturé, le compte rendu est figé.                                    | À faire |
| FR-STM-03 | Générer le PDF, l'envoyer, et marquer le reversement comme effectué.                                                          | À faire |

#### M11. Tableau de bord et suivi financier

| ID        | Exigence                                                                        | État    |
| --------- | ------------------------------------------------------------------------------- | ------- |
| FR-DSH-01 | Synthèse du mois : loyers attendus, encaissés, impayés.                         | À faire |
| FR-DSH-02 | Listes : échéances en retard, baux qui se terminent bientôt.                    | À faire |
| FR-FIN-01 | Revenus et dépenses par période, par bien et par propriétaire, avec export CSV. | À faire |

### Phase 3 — Compléments

#### M12. États des lieux

| ID        | Exigence                                                                                                   | État    |
| --------- | ---------------------------------------------------------------------------------------------------------- | ------- |
| FR-INS-01 | Créer un état des lieux d'entrée ou de sortie pour un bail : checklist par pièce, état, remarques, photos. | À faire |
| FR-INS-02 | Signature sur mobile.                                                                                      | À faire |
| FR-INS-03 | Comparer l'entrée et la sortie ; export PDF.                                                               | À faire |

#### M13. Signalements (journal interne)

| ID        | Exigence                                                                                                | État    |
| --------- | ------------------------------------------------------------------------------------------------------- | ------- |
| FR-TKT-01 | Enregistrer un problème déclaré par un locataire (par téléphone ou message) : lot, description, photos. | À faire |
| FR-TKT-02 | Suivre le statut et ajouter des notes jusqu'à la clôture.                                               | À faire |

#### M14. Paramètres et abonnement

| ID        | Exigence                                          | État    |
| --------- | ------------------------------------------------- | ------- |
| FR-SET-01 | Modifier les modèles de documents et de messages. | À faire |
| FR-SET-02 | Consulter les règles du pays et leur statut.      | À faire |
| FR-SET-03 | Consulter son abonnement et le quota de lots.     | À faire |

## 4. Documents générés (PDF, en français)

Contrat de bail, quittance ou reçu, avis d'échéance, relance, état des lieux, compte rendu propriétaire. Ils sont générés côté serveur ; l'agence les télécharge ou les envoie par e-mail, et peut les partager elle-même (par exemple sur WhatsApp).

## 5. Entités principales

| Entité             | Champs clés                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| Agence             | nom, pays, plan, compteur de quittances                                                                  |
| Utilisateur        | agence, e-mail, mot de passe (haché), nom, rôle, actif                                                   |
| Propriétaire       | agence, nom, téléphone, e-mail, adresse                                                                  |
| Mandat             | propriétaire, commission (%), début, fin                                                                 |
| Bien               | mandat, nom, adresse, ville                                                                              |
| Lot                | bien, libellé, loyer et charges par défaut, actif                                                        |
| Locataire          | agence, nom, téléphone, e-mail                                                                           |
| Bail               | lot, locataire, statut, dates, loyer, charges, dépôt, jour de paiement, clause de révision, préavis, fin |
| Mouvement de dépôt | bail, type, montant, date, note                                                                          |
| Échéance           | bail, période, date limite, montant, statut                                                              |
| Paiement           | échéance, montant, mode, date, référence, statut, annulation, clé d'idempotence                          |
| Quittance          | paiement, numéro, type (quittance ou reçu), PDF                                                          |
| Document           | entité liée, nom, type, taille, clé de stockage                                                          |
| Règle du pays      | pays, clé, valeur, statut, source                                                                        |
| Journal d'audit    | agence, utilisateur, action, entité, avant, après, date                                                  |

Les entités des phases 2 et 3 (relances, états des lieux, signalements, dépenses, comptes rendus, abonnement) seront ajoutées avec leurs modules.

## 6. Exigences d'interface

- Mobile-first, avec tableaux plus denses sur PC ; installable comme PWA.
- Écrans de liste avec recherche et filtres ; fiches détaillées pour propriétaire, bien, lot, locataire, bail.
- Assistant de création de bail en étapes.
- Saisie de paiement rapide : montant, mode, date, référence.
- Avertissements lisibles (par exemple dépôt supérieur au plafond), non bloquants.
- Messages d'erreur en français, avec le détail utile (par exemple le solde restant d'une échéance).

## 7. Critères d'acceptation — saisie d'un paiement

Ces critères sont couverts par des tests automatisés.

1. Un paiement égal au solde d'une échéance de 150 000 FCFA la passe en _payée_ et émet la quittance n°1.
2. Un paiement de 100 000 FCFA sur la même échéance la passe en _partielle_, émet le reçu n°1 ; un second paiement de 50 000 FCFA la solde et émet la quittance n°2.
3. Un paiement partiel sur une échéance dont la date limite est dépassée la laisse _en retard_.
4. Rejouer la même clé d'idempotence renvoie le même paiement et le même numéro, sans créer de ligne supplémentaire.
5. Un montant supérieur au solde est refusé (422) ; une échéance déjà soldée refuse tout paiement (409) ; une date future est refusée (422).
6. L'échéance d'une autre agence est introuvable (404).
7. Chaque agence a sa propre numérotation, qui commence à 1.
8. Chaque paiement écrit une ligne d'audit.

## 8. Hors périmètre

Encaissement en ligne, travaux et prestataires, rendement locatif, fiscalité, espace locataire ou propriétaire, autres langues, application mobile native, Maroc.
