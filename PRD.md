# PRD — Application de gestion locative (Congo-Brazzaville)

_Product Requirements Document — version 0.1 (brouillon) — 25 octobre 2026_

## 1. Résumé

Application web (PWA, mobile-first) destinée aux **agences immobilières et gestionnaires de biens**. Elle permet de suivre les propriétaires, les biens, les locataires, les baux, les loyers, les quittances, les relances et les comptes rendus aux propriétaires.

Le produit s'inspire de Rentila, adapté au contexte de la **République du Congo (Brazzaville)** : interface en français, montants en FCFA avec l'équivalent en euro entre parenthèses, paiements par virement bancaire ou espèces. Le lancement se fait au Congo-Brazzaville, le Maroc viendra ensuite.

## 2. Problème à résoudre

Hypothèses issues du cadrage, à valider avec les agences en cours de discussion :

- Les agences, souvent petites (1 ou 2 employés), suivent les loyers sur des cahiers, des tableurs ou des messages WhatsApp.
- Les impayés sont oubliés ou relancés trop tard.
- Les quittances sont faites à la main, sans numérotation fiable.
- Les comptes rendus aux propriétaires (encaissé, commission, reversement) prennent du temps à produire.
- Il n'y a pas de trace de qui a saisi ou modifié quoi.
- Les contrats, états des lieux et justificatifs sont dispersés.

## 3. Utilisateurs

| Type                      | Rôle dans le produit                                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Gestionnaire d'agence** | Seul utilisateur de l'application. Chaque utilisateur d'une agence a tous les droits (agences de 1 à 2 personnes). |
| Propriétaire (mandant)    | Hors application : reçoit ses comptes rendus en PDF, envoyés par l'agence.                                         |
| Locataire                 | Hors application : pas d'accès. Reçoit quittances, avis d'échéance et relances en PDF, envoyés par l'agence.       |

Contexte d'usage : surtout sur mobile en 4G, sur PC au bureau.

## 4. Objectifs et non-objectifs

### Objectifs de la v1

1. Remplacer le cahier ou le tableur par un outil unique pour le cycle complet : bail, échéance, paiement, quittance.
2. Réduire les impayés non suivis grâce aux échéances en retard et aux relances.
3. Produire en quelques clics les documents (contrat, quittance, compte rendu propriétaire).
4. Garantir la traçabilité de tout ce qui touche à l'argent.
5. Fonctionner correctement sur mobile avec une connexion 4G.

### Non-objectifs (hors v1)

- Encaissement en ligne des loyers : l'application enregistre seulement les paiements.
- Gestion des travaux et des prestataires.
- Simulateur ou suivi du rendement locatif.
- Fiscalité : on suit les revenus et dépenses, sans déclaration d'impôt.
- Espace locataire ou espace propriétaire.
- Autres langues que le français.
- Le Maroc (prévu après le Congo-Brazzaville).
- Application mobile native.

## 5. Périmètre fonctionnel

Tout ce que couvre Rentila est visé pour la v1, construit par phases :

| Phase                     | Modules                                                                                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **1 — Noyau utilisable**  | Authentification et agence ; propriétaires et mandats ; biens et lots ; locataires ; baux ; échéances et paiements ; quittances et documents |
| **2 — Suivi de l'argent** | Relances et avis d'échéance ; dépenses ; comptes rendus propriétaires ; tableau de bord et suivi financier                                   |
| **3 — Compléments**       | États des lieux ; signalements (journal interne) ; paramètres et abonnement                                                                  |

Au bout de la phase 1, une agence peut créer un bail, suivre les loyers et remettre des quittances.

## 6. Proposition de valeur

- Un outil pensé pour le Congo : FCFA, français, virement et espèces, documents adaptés.
- Simple pour une agence de 1 ou 2 personnes : un seul niveau de droits, pas de configuration lourde.
- Des quittances numérotées sans trou et des comptes rendus propriétaires générés automatiquement.
- Une traçabilité complète des opérations sur l'argent.

## 7. Parcours clés

1. **Mise en location** : créer le propriétaire et son mandat, le bien et le lot, le locataire, puis le bail. Générer le contrat en PDF, encaisser le dépôt de garantie.
2. **Cycle mensuel** : les échéances sont générées, l'agence enregistre les paiements reçus, la quittance est émise (ou un reçu si le paiement est partiel).
3. **Impayé** : l'échéance passe en retard, l'agence envoie des relances par paliers.
4. **Fin du mois** : génération et envoi du compte rendu de chaque propriétaire.
5. **Sortie du locataire** : préavis, état des lieux de sortie, calcul des retenues sur le dépôt, restitution.

## 8. Principes produit

- Montants en FCFA, entiers. Affichage : « 150 000 FCFA (≈ 229 €) », avec la parité fixe 1 € = 655,957 FCFA.
- Un paiement règle une seule échéance. Un paiement d'avance se saisit en un paiement par échéance.
- Un paiement n'est jamais supprimé : il s'annule, et l'annulation est tracée.
- Les règles légales (dépôt de garantie, révision, préavis) sont des paramètres par pays, marqués « à confirmer » tant qu'elles ne sont pas validées. Elles produisent des avertissements, pas des blocages.

## 9. Modèle économique

- **Abonnement mensuel** payé par l'agence.
- Structure des plans (par exemple selon le nombre de lots) : à définir.
- Facturation manuelle au démarrage : option à valider.

## 10. Exigences non fonctionnelles de haut niveau

- Mobile-first, utilisable sur 4G (photos compressées, pages légères).
- Interface et documents en français.
- Données isolées entre agences.
- Journal d'audit des opérations sensibles.
- Sauvegardes de la base et reprise après incident.

## 11. Indicateurs de succès proposés

À valider avant le lancement :

- Nombre d'agences actives et de lots gérés.
- Part des loyers du mois enregistrés dans l'application.
- Délai moyen entre échéance en retard et première relance.
- Nombre de comptes rendus propriétaires générés par mois.
- Taux de rétention des abonnements après 3 mois.

## 12. Risques et hypothèses

| Risque                                                                                                                                                   | Mitigation                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Règles légales incertaines.** Les règles reçues au départ semblent correspondre à la RDC, et une source consultée donne un plafond de dépôt différent. | Faire valider par un notaire ou un avocat du Congo-Brazzaville ; règles paramétrables et marquées « à confirmer ». |
| Développeur unique face à un périmètre large.                                                                                                            | Phasage strict ; modules minimaux en v1 ; noyau livré en premier.                                                  |
| Connexion 4G instable.                                                                                                                                   | PWA, compression des photos, idempotence des paiements.                                                            |
| Adoption : habitudes papier ou WhatsApp.                                                                                                                 | Validation continue avec les agences ; export PDF partageable facilement.                                          |
| Besoin réel non confirmé.                                                                                                                                | Entretiens avec propriétaires et agences en cours ; rester sur un brouillon tant que ce n'est pas validé.          |

## 13. Questions ouvertes

1. Quelles règles légales exactes s'appliquent au Congo-Brazzaville (dépôt de garantie, révision, préavis, délais de restitution, enregistrement du bail) ?
2. Quelle structure de plans d'abonnement et quels tarifs ?
3. Le partage direct par WhatsApp des documents est-il souhaité en v1 ou plus tard ?
4. Comment les agences facturent-elles aujourd'hui leur commission, et faut-il gérer des commissions variables par bien ?
5. Quelles mentions obligatoires doivent figurer sur un contrat de bail et une quittance ?

## 14. Phasage

Pas de dates à ce stade, l'ordre de construction est :

1. Phase 1, dans cet ordre : authentification, propriétaires et mandats, biens et lots, locataires, baux, échéances et paiements, quittances et documents.
2. Phase 2 : relances, dépenses, comptes rendus propriétaires, tableau de bord.
3. Phase 3 : états des lieux, signalements, paramètres et abonnement.
4. Ensuite : extension au Maroc (règles, textes et contrats propres à ce pays).
