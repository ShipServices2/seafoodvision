# Audit V1 — État des lieux (lecture seule)

Date : 2026-10-03 · Branche : `main` · Aucun code, migration, écriture en base ni commit.

## Synthèse

| Élément | État | Remarque |
|---|---|---|
| Git | OK | Branche `main`, arbre propre au démarrage, remote `origin` = `https://github.com/ShipServices2/seafoodvision.git` |
| `.env.local` ignoré par Git | OK | `.gitignore:39`, fichier non suivi |
| Supabase CLI | OK | `npx supabase@latest` 2.119.0, projet lié, `migration list` fonctionne (3e passage) |
| Comparaison migrations locales / distantes | ATTENTION | **0 des 40** migrations n'est enregistrée côté distant (historique `schema_migrations` vide), alors que la base contient les données/tables : schéma très probablement appliqué hors CLI (SQL editor). Voir §2 ter |
| Migrations locales | INFO | **40** fichiers (pas 46 comme annoncé) |
| Audit base de données (lignes, statuts, buckets) | OK | Refait au 5e passage (§3). 620 assets, tous `published` + `approved` ; **3 buckets Storage, tous privés** : `asset-thumbnails` (608), `asset-previews` (608), `identification-uploads` (8) |
| `npm run type-check` | OK | 0 erreur |
| `npm run lint` | OK | 0 erreur, **223 warnings** |
| `npm test` | OK | 11 suites, 283 tests passés |
| `npm run build` | OK | Compilé en 3,2 min, mêmes warnings ESLint |
| Variables `.env.local` | À COMPLÉTER | Seules `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` sont renseignées ; le reste est vide |
| `.env.example` vs `.env.local` | ATTENTION | Aucune variable manquante dans `.env.local`, mais `SUPABASE_SERVICE_ROLE_KEY` n'existe dans aucun des deux |

## 1. Git

- Branche : `main`. `git status` : propre.
- Remote : `origin` → `https://github.com/ShipServices2/seafoodvision.git` (fetch/push).
- 15 derniers commits :

```
58f275e Merge Professional Monthly Dodo mapping fix
26c2c81 Repair Professional Monthly Dodo TEST mapping
4ee75db Merge Dodo configuration source-of-truth fix
dd42924 Unify Dodo runtime configuration checks
2865e29 Merge subscription plan resolution fix
8397ef1 Fix subscription plan resolution
0863ebf Fix cart prerender suspense boundary
34e97bd Merge Sprint 2 multi-product cart
e40d1b2 Implement secure multi-product cart checkout
5d7b0e0 Fix post-merge validation regressions
669839f Merge Sprint 1 and 1.5 marketplace stabilization
1d31019 Finalize Dodo TEST product mappings
9616175 Merge pull request #18 from ShipServices2/rocket-update
cc20c2a Local Commit 2026-07-19 — middleware : config Supabase lue au request time
e769d4e Local Commit 2026-07-19 — AuthContext : setState dans setTimeout(0) (React 19)
```

(Les deux derniers messages sont abrégés ; le texte complet est dans `git log`.)

## 2. Supabase CLI et migrations

- `supabase --version` : `/usr/bin/bash: line 1: supabase: command not found`.
- `npx --no-install supabase --version` : `npx canceled due to missing packages ... ["supabase@2.119.0"]`.
- `supabase migration list` : impossible, pas de CLI.
- Le MCP Supabase connecté ne voit que `univers-shopping-staging` et `shopmybest-production`, deux autres projets, sans lien avec SeafoodVision ; ils n'ont **pas** été interrogés. `list_migrations` sur `pbrjxdpnonkfcjavfdsh` → `MCP error -32600: You do not have permission to perform this action`.
- Comparaison local/distant : **non réalisable** dans cet état. Migrations manquantes d'un côté ou de l'autre : inconnu.

Migrations locales (40) : `20260712140000_seafoodvision_full_schema` → `20260720220000_repair_professional_monthly_test_mapping`.
Point d'attention : deux fichiers partagent le même horodatage `20260717060000` (`backfill_propagation_and_fix_confirm` et `fix_suggest_search_correction_return_type`). Supabase exige des versions uniques, donc l'un des deux risque d'échouer ou d'être ignoré à l'application.

Tables métier créées par les migrations (extrait utile à V1) : `profiles`, `assets`, `asset_files`, `asset_previews`, `species`, `categories`, `keywords`, `collections`, `collection_items`, `pricing_plans`, `payment_product_mappings`, `orders`, `order_items`, `purchased_licenses`, `download_entitlements`, `checkout_intents`, `contact_requests`, `user_subscriptions`, `credit_ledger`, `payment_webhook_events`, plus les tables knowledge graph, SIE, IA, metadata review.
Note : la table des mappings Dodo s'appelle `payment_product_mappings`.

## 2 bis. Suite (2e passage)

- `.env.local` est ignoré par Git (`.gitignore:39`) et non suivi.
- Le projet est lié : `supabase/.temp/project-ref` = `pbrjxdpnonkfcjavfdsh`.
- `npx supabase@latest migration list` (CLI 2.119.0) → ÉCHEC : `DbConfigLoginRoleStatusError ... unexpected login role status 403: Your account does not have the necessary privileges to access this endpoint`. Le compte connecté au CLI n'a pas les droits sur ce projet (ou n'est pas le propriétaire/admin). La comparaison reste impossible.
- `.env.local` ne contient toujours **aucune** variable `SERVICE_ROLE` (seules les deux `NEXT_PUBLIC_SUPABASE_*` sont présentes). Le script `_audit_db.mjs` n'a donc pas été créé.

## 2 ter. Migrations locales vs distantes (3e passage)

`npx supabase@latest migration list` fonctionne maintenant (compte propriétaire).

- Locales : 40. Distantes enregistrées : **0**. La colonne « remote » est vide pour les 40 lignes.
- Manquantes côté distant : **les 40** (`20260712140000` → `20260720220000`).
- Manquantes côté local (présentes à distance seulement) : **aucune**.
- Deux fichiers partagent `20260717060000` (`backfill_propagation_and_fix_confirm`, `fix_suggest_search_correction_return_type`) : le distant n'en montre **aucun** (ni l'un ni l'autre), la CLI les liste comme deux lignes locales identiques. Un `db push` échouerait sur la clé primaire dupliquée : renommer l'un avant toute application.
- Interprétation : la base contient pourtant les tables et données du schéma (§3), donc les migrations ont été appliquées hors CLI (SQL editor ou MCP). Ne PAS lancer `db push` tel quel (il rejouerait les 40 migrations) ; il faudra d'abord `migration repair --status applied` pour les versions réellement appliquées, après vérification. Non fait ici (lecture seule).

## 3. Base de données

Audit fait par un script SELECT uniquement (clé service role lue dans `.env.local`, non affichée), puis supprimé. Tables testées : les 148 créées par les migrations.

### Tables métier principales (nombre de lignes)

| Table | Lignes | Table | Lignes |
|---|---|---|---|
| `assets` | 620 | `asset_files` | 1824 |
| `asset_previews` | 608 | `asset_readiness` | 608 |
| `asset_keywords` | 1502 | `asset_species` | 134 |
| `asset_status_history` | 645 | `asset_metadata_reviews` | 1 |
| `species` | 32 | `species_names` | 91 |
| `categories` | 9 | `keywords` | 36 |
| `profiles` | 1 | `collections` / `collection_items` | 1 / 1 |
| `orders` | 31 | `order_items` | 30 |
| `pricing_plans` | 5 | `payment_product_mappings` | 10 |
| `credit_packs` | 4 | `credit_ledger` | 1 |
| `license_types` | 4 | `marketplace_settings` | 10 |
| `purchased_licenses`, `download_entitlements`, `checkout_intents`, `user_subscriptions`, `subscriptions`, `payment_transactions`, `payment_webhook_events`, `contact_requests`, `downloads`, `favorites`, `coupons`, `licenses` | 0 | `audit_logs` | 6 |
| `metadata_suggestions` | 306 | `import_batches` | 3 |
| `openai_pilot_candidates` | 1249 | `openai_pilot_results` / `_job_assets` | 520 / 520 |
| `sie_jobs` | 314 | `sie_species_candidates` | 260 |
| `identification_requests` / `_events` | 11 / 16 | `assistant_conversations` / `_messages` | 2 / 4 |
| `knowledge_*` (entités, relations, claims…) | 0 | `ai_knowledge_sources` / `ai_provider_config` | 5 / 4 |

Constats :
- **31 commandes et 30 order_items mais 0** `purchased_licenses`, `download_entitlements`, `payment_transactions`, `payment_webhook_events`, `checkout_intents` : aucune commande n'a abouti à une licence ni à un webhook Dodo. À examiner (données de test ?).
- Tables vides pour les référentiels (`markets`, `countries`, `fao_areas`, `processing_methods`, `product_forms`, `packaging_types`, `certifications`, `commercial_products`…) : le catalogue commercial structuré n'est pas peuplé.
- Quelques tables listées dans les migrations renvoient un comptage `null` sans erreur (`asset_badges`, `asset_review_comments`, `asset_workflow`, `license_definitions`, `search_events`, `search_zero_results`) : probablement supprimées/renommées par une migration ultérieure ; non confirmé.
- 1 seul profil.

### Assets (620)

| Colonne | Répartition |
|---|---|
| `publication_status` | `published` : 620 |
| `review_status` | `approved` : 620 |
| `rights_status` | **la colonne n'existe pas dans `assets`**. Équivalents (re-vérifiés au 4e passage) : `assets.rights_info` = `review_required` : 608, `NULL` : 12 ; `asset_readiness.rights_verified` = `true` : 608 (aucune ligne pour les 12 autres). Incohérence à trancher : droits « à revoir » (`rights_info`) mais « vérifiés » (`rights_verified`), et 12 assets publiés sans droits ni miniature |

### Storage

| Bucket | Visibilité | Fichiers |
|---|---|---|
| `asset-thumbnails` | privé | 608 |
| `asset-previews` | privé | 608 |
| `identification-uploads` | privé | 8 |

Correction : les passages précédents n'avaient vu qu'`asset-thumbnails` ; il existe bien 3 buckets, tous privés. 608 fichiers par bucket d'assets pour 620 assets : 12 assets sans miniature ni aperçu.

Note (5e passage) : le comptage des tables via l'API REST (spec OpenAPI) en expose **139**, contre 148 citées plus haut d'après les migrations ; les 9 manquantes sont les tables non exposées ou supprimées/renommées (cohérent avec les comptages `null` ci-dessus). Les comptages de lignes restent identiques à ceux du tableau.

## 4. Code

| Commande | Résultat | Détail |
|---|---|---|
| `npm run type-check` | OK | 0 erreur |
| `npm run lint` | OK | 0 erreur, 223 warnings. Premiers : `about/page.tsx:6` `Icon` inutilisé ; `admin/ai-identification/analytics/page.tsx:12` `Icon` inutilisé ; `admin/ai-identification/bulk/page.tsx:50` `previewMode` inutilisé ; `admin/ai-identification/page.tsx:11` `Icon` inutilisé ; `admin/ai-identification/review/page.tsx:410:82` et `:94` guillemets non échappés ; `admin/ai-studio/analytics/page.tsx:12` `Icon` inutilisé ; `admin/ai-studio/import-real-ai/page.tsx:11` `Upload` inutilisé ; `admin/ai-studio/validation/page.tsx:1175` et `:1214` `prefer-const` |
| `npm test` | OK | 11 suites, 283 tests passés (importValidator, supabaseClients, supabaseRuntimeConfig, et 8 suites payments/Dodo) |
| `npm run build` | OK | Next.js 15.5.18, « Compiled successfully in 3.2min », mêmes warnings, middleware 67.5 kB |

## 5. Variables d'environnement (noms uniquement)

`.env.local` et `.env.example` contiennent exactement les mêmes 26 noms :
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_ADSENSE_ID`, `PERPLEXITY_API_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `AI_ASSISTANT_ENABLED`, `AI_PROVIDER`, `AI_MODEL`, `AI_PROVIDER_API_KEY`, `AI_MAX_CONTEXT_ITEMS`, `AI_MAX_RESPONSE_TOKENS`, `AI_DAILY_GUEST_LIMIT`, `AI_DAILY_MEMBER_LIMIT`, `AI_LOG_PROMPTS`, `DODO_PAYMENTS_API_KEY`, `DODO_PAYMENTS_WEBHOOK_SECRET`, `DODO_PAYMENTS_ENVIRONMENT`, `DODO_PAYMENTS_RETURN_URL`, `DODO_PAYMENTS_CANCEL_URL`, `DODO_PAYMENTS_WEBHOOK_URL`, `NEXT_PUBLIC_DODO_PAYMENTS_ENABLED`.

- Manquantes de `.env.example` dans `.env.local` : aucune.
- Renseignées (non vides) dans `.env.local` : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Toutes les autres, dont `DODO_PAYMENTS_*` et `NEXT_PUBLIC_SITE_URL`, sont vides localement.
- Absente partout : `SUPABASE_SERVICE_ROLE_KEY`. Vérifier comment le code serveur crée son client admin (grep non fait dans cette étape).

## Fichiers créés ou supprimés

- Créé : `docs/AUDIT_V1_ETAT_DES_LIEUX.md`
- Créé puis supprimé (3 fois, dont le 5e passage) : `scripts/_audit_db.mjs` (et le dossier `scripts/`, vide).
- Modifié (non lié à l'audit, déjà modifié au démarrage) : `next-env.d.ts`, non touché par moi.
- Effet de bord : `npm run build` a régénéré le dossier `.next/` (ignoré par git).

---

# Étape 1 — Remise en état

Branche : `v1/etape-1-remise-en-etat` (aucun commit). Aucun `db push`, aucune migration exécutée, aucune écriture dans les tables métier. Seules écritures distantes : l'historique `supabase_migrations` via `migration repair --status applied`.

## Actions

1. `next-env.d.ts` remis à l'état Git, branche créée.
2. Doublon `20260717060000` : les deux fichiers sont indépendants (le « backfill » ne touche pas `suggest_search_correction`). Le second est renommé `20260717060001_fix_suggest_search_correction_return_type.sql` (contenu inchangé, `git mv`).
3. Vérification des 40 migrations : objets extraits des fichiers, comparés à la spec OpenAPI PostgREST (clé service role), puis, pour les migrations de données, par SELECT (API et `supabase db query --linked` sur `pg_policies`, `pg_indexes`, `pg_constraint` et les tables métier).
4. `migration repair --status applied` pour 32 versions (25 + 7, voir tableau).
5. Vérifications : type-check, lint, tests, build, serveur de dev.

## Tableau des migrations

| Migration | Verdict | Repair | Détail |
|---|---|---|---|
| 20260712140000, 20260712220000, 20260713000000, 20260713010000, 20260713020000, 20260713220000, 20260714120000, 20260714220000, 20260715030000, 20260715120000, 20260715200000, 20260715400000, 20260715500000, 20260715600000, 20260715700000, 20260715710000, 20260715800000, 20260716000000, 20260716100000, 20260716200000, 20260717020000, 20260717040000, 20260717050000, 20260717060000, 20260717060001 | APPLIQUÉE (25) | oui | Tous les objets attendus sont présents |
| 20260714002200 | APPLIQUÉE | oui | 7 politiques RLS + RLS sur `keywords` |
| 20260714130000 | APPLIQUÉE | oui | `SV-PILOT-0001..8` approved/published ; politiques `anon_read_*` et lecture publique |
| 20260715900000 | APPLIQUÉE | oui | 2 index uniques présents |
| 20260716300000 | APPLIQUÉE | oui | plans `*_monthly`, 3 mappings test mensuels |
| 20260716310000 | APPLIQUÉE | oui | Explorer, Professional, Business actifs |
| 20260717010000 | APPLIQUÉE | oui | contrainte unique présente ; `job_assets` = `results` pour chaque job |
| 20260720220000 | APPLIQUÉE | oui | mapping Professional mensuel présent (note « Targeted repair ») |
| 20260712200000 | PARTIELLE | non | manque : tables `asset_workflow`, `asset_badges`, `asset_review_comments`, `license_definitions` ; fonction `recalculate_asset_completion` |
| 20260712230000 | PARTIELLE | non | manque : tables `search_events`, `search_zero_results`, vue `search_analytics_summary` ; fonctions `search_seafood_knowledge`, `autocomplete_seafood`, `log_search_event` |
| 20260712235900 | PARTIELLE | non | mêmes objets manquants que la précédente |
| 20260717030000 | NON CONSTATÉE | non | jobs anciens suffixés `[superseded]` au lieu du préfixe prévu ; Batch 02 : 91 `job_assets` validés pour 92 `results` |
| 20260718100000 | ABSENTE | non | manque : fonction `apply_credit_purchase`, colonne `credit_ledger.transaction_id`, index uniques. Non strictement additive : `DELETE` sur 6 tables, `UPDATE`, `DROP CONSTRAINT` |
| 20260719120000 | NON CONSTATÉE | non | 3/6 produits unitaires mappés, 0 abonnement annuel, packs de crédits en « Placeholder ». Identifiants Dodo différents de ceux en base (I/l, X/x) : ne pas appliquer sans relecture |
| 20260720120000 | ABSENTE | non | manque : colonne `purchased_licenses.order_item_id` et ses index. Un seul élément destructif : `DROP CONSTRAINT` de l'ancienne clé unique |
| 20260720180000 | NON CONSTATÉE | non | codes de plans non normalisés, 6 mappings absents |

Limites : pas de contrôle du corps des fonctions ni des triggers. Les verdicts reposent sur la présence des objets et sur l'effet des données.

## Code V1 appelant des objets manquants

- `/admin` : `asset_workflow` (`admin/page.tsx:67`).
- `/admin/reviews` : `asset_workflow`, `asset_badges`, `asset_review_comments` (page cassée).
- `/admin/reviewer-dashboard` : `asset_workflow` (page cassée, hors liste V1).
- `/licensing-center` : `license_definitions`.
- `/knowledge/search`, `/discover`, `/api/assistant` : `search_seafood_knowledge`, `autocomplete_seafood` ; `log_search_event` appelé sans bloquer en cas d'erreur.
- Paiements : `apply_credit_purchase` (`WebhookService.ts:371`) sans repli, donc l'achat de pack de crédits échouerait ; `purchased_licenses.order_item_id` avec repli explicite.
- Aucune dépendance manquante pour `/`, `/library`, `/asset`, `/species`, `/pricing`, `/admin/assets`, `/admin/species`, `/admin/imports`, `/admin/commerce`.

## Migrations restant à traiter (non enregistrées à distance)

`20260712200000`, `20260712230000`, `20260712235900`, `20260717030000`, `20260718100000`, `20260719120000`, `20260720120000`, `20260720180000`. Résultat de `migration list` : ces 8 versions sont les seules locales sans correspondance distante.

## Résultats

| Vérification | Résultat |
|---|---|
| `npm run type-check` | OK, 0 erreur |
| `npm run lint` | OK, 0 erreur, 223 warnings |
| `npm test` | OK, 11 suites, 283 tests |
| `npm run build` | OK, compilé en 51 s |
| `npm run dev` (port 4028) | `/` 200, `/library` 200, `/species` 200, `/pricing` 200, `/admin` 307 vers `/auth?next=%2Fadmin`. Serveur arrêté |

## Fichiers (étape 1)

- Créé : `docs/AUDIT_V1_ETAT_DES_LIEUX.md` (non suivi par Git, section ajoutée).
- Renommé : `supabase/migrations/20260717060000_fix_suggest_search_correction_return_type.sql` → `20260717060001_fix_suggest_search_correction_return_type.sql`.
- Temporaires créés puis supprimés : `_eff.mjs`, `_conf.mjs`, `dev.log` (racine du projet). Scripts de vérification dans le dossier temporaire de session, hors dépôt.
- `next-env.d.ts` : régénéré par build et dev, remis à l'état Git (`git checkout`).
- Base distante : historique des migrations modifié (32 versions marquées `applied`). Schéma et données inchangés.

## Migrations neutralisées

Décision : les 8 migrations ci-dessous sont marquées `applied` via `migration repair` comme base de référence. **Leur SQL n'a pas été exécuté** : ce qu'elles décrivent n'est donc PAS (ou pas entièrement) en base. Chaque manque sera traité par une NOUVELLE migration additive, jamais en rejouant ces fichiers. Après cette étape, `migration list` montre 40/40 versions locales alignées avec le distant.

| Migration | Ce qui n'est PAS en base | Traitement prévu |
|---|---|---|
| `20260712200000_phase44_workflow_certification` | tables `asset_workflow`, `asset_badges`, `asset_review_comments`, `license_definitions` ; fonction `recalculate_asset_completion` | Étape 2 (workflow et badges 4.4) : nouvelle migration additive |
| `20260712230000_phase_5_3_semantic_search` | tables `search_events`, `search_zero_results`, vue `search_analytics_summary` ; fonctions `search_seafood_knowledge`, `autocomplete_seafood`, `log_search_event` | V2 (recherche sémantique 5.3) |
| `20260712235900_phase_5_3_semantic_search_fix` | mêmes objets que la précédente | V2 (recherche sémantique 5.3) |
| `20260717030000_fix_batch02_label_and_backfill_propagation` | renommage des jobs (Batch 01/02), format `[superseded]` prévu, backfill de validation (Batch 02 : 91 `job_assets` validés pour 92 `results`) | V2 (lots IA) |
| `20260718100000_marketplace_exact_once` | index uniques exact-once (transactions, crédits, abonnements, entitlements, remboursements, commandes), contrainte de cohérence `billing_cycle`, fonction `apply_credit_purchase`, colonne `credit_ledger.transaction_id`, dédoublonnages | Exact-once : étape 6, en version additive. Crédits (`apply_credit_purchase`, `credit_ledger.transaction_id`) : V2. Tant que `apply_credit_purchase` n'existe pas, l'achat de pack de crédits échoue (`WebhookService.ts:371`, sans repli) |
| `20260719120000_dodo_test_certain_mappings` | 3 produits unitaires sur 6 (`video`, `view_360`, `pack_10`), 6 mappings d'abonnement au format normalisé (dont les annuels), mappings de packs de crédits validés (les lignes en base portent la note « Placeholder ») | Étape 6, à vérifier contre le tableau de bord Dodo |
| `20260720120000_multi_product_cart_line_fulfillment` | colonne `purchased_licenses.order_item_id`, ses index uniques, suppression de l'ancienne clé unique | Étape 6 (order_item_id), en version additive. Le code a un repli tant que la colonne manque |
| `20260720180000_normalize_subscription_plan_codes` | normalisation `explorer_monthly` → `explorer` (idem Professional, Business) ; 6 mappings d'abonnement actifs | Étape 6, à vérifier contre le tableau de bord Dodo |

**Avertissement : les identifiants Dodo de `20260719120000` ne doivent jamais être appliqués tels quels.** Ils diffèrent de ceux en base sur au moins 3 valeurs (Business mensuel `…AIR` contre `…AlR` ; `credits_100` `…5ltiwa…` contre `…5Itiwa…` ; `credits_250` `…FPXk` contre `…FPxk`, confusions I/l et X/x). Toute nouvelle migration devra reprendre des identifiants copiés depuis le tableau de bord Dodo.

Conséquence connue : `/admin/reviews`, `/admin/reviewer-dashboard`, le compteur de `/admin`, `/licensing-center` et la recherche sémantique (`/knowledge/search`, `/discover`) restent cassés ou dégradés jusqu'aux étapes ci-dessus.

Après neutralisation : `npx supabase@latest migration list` → 40 migrations locales, 40 distantes, aucune différence.
