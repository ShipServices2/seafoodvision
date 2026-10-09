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

## Fusion du travail Rocket

`origin/main` (11e8ece) a été fusionné dans `main` local, sans conflit (merge commit `818961a`, non poussé). 82 commits, du 2026-07-20 au 2026-07-27 (21 le 20/07, 15 le 21/07, 3 le 25/07, 43 le 27/07), 180 fichiers (+6 463 / −1 435), dont 9 nouvelles migrations. Aucun repair ni SQL exécuté pour ces migrations.

### Fonctionnalités apportées

- Page `/identify` : identification d'espèces par OpenAI Vision, calcul de checksum et cache, débit de crédits seulement après succès.
- Route d'upload d'identification : erreur HTTP 500 explicite si le stockage échoue, bucket `identification-uploads`.
- Achat de licence photo depuis la fiche asset (Photo Web 5 €, HD 20 €, Ultra HD 40 €) via `/api/payments/dodo/checkout`.
- Administration Dodo : `/admin/commerce/dodo-products`, `/admin/commerce/dodo-credit-config`, API `list-products` et `auto-configure-credits` (écrit dans `payment_product_mappings`).
- Validation commerciale des packs de crédits : détection des identifiants placeholder, repli par variables d'environnement.
- Seafood Intelligence Hub, phase 1 : composants `src/app/hub/*`, tables `hub_*`, coûts en crédits.
- Page d'accueil : slider de 4 photos, vraies photos pour catégories, médias et espèces, nouveau logo.
- Menu : Knowledge, Assistant, Discover et Licensing masqués, libellés en majuscules.
- Bibliothèque : paramètre `?q` synchronisé avec l'URL (Suspense).
- Pricing : « Select an asset » mène à `/library?licenseType=commercial`, boutons panier retirés des packs de crédits.
- Divers : `netlify.toml`, `mcp.json`, durcissement de `createServiceClient`, nettoyage des URL Dodo de retour et d'annulation, retrait de plusieurs imports circulaires.

### Problèmes constatés après fusion

- **`LibraryContent.tsx` et `LibraryFilters.tsx` sont corrompus sur `origin/main`** : 142 octets chacun, ils contiennent le texte d'une erreur de limite de débit (`{"code":"rate-limited",...}`) à la place du code (avant : 14 879 et 7 954 octets). Dernière bonne version : `c281c2b` pour les deux. `/library` ne peut pas compiler.
- type-check : 8 erreurs (ces deux fichiers). lint : 2 erreurs de parsing (mêmes fichiers), 285 warnings. Tests : 4 échecs (voir ci-dessous).
- Tests en échec : `supabaseRuntimeConfig` (normalisation du service client), `dodoTestMappings` (aucun identifiant Dodo dans un composant front), `marketplaceStabilization` (message d'erreur de mapping de pack de crédits modifié), `multiProductCart` (le panier n'accepte plus les packs de crédits).

### Les 9 migrations (lecture seule)

| Migration | Verdict | Constaté en base |
|---|---|---|
| `20260720230000_repair_credit_pack_test_mappings` | ABSENTE | les 4 mappings de packs existent avec d'autres identifiants et la note « Placeholder » ; ses identifiants (`…5ltiwa…`, `…FPXk`) ne sont pas ceux en base |
| `20260720240000_fix_credit_pack_test_mappings_real_ids` | ABSENTE, dangereuse | son `DELETE` supprimerait les mappings `credits_500` et `credits_1000` actuels (leurs identifiants sont dans sa liste) |
| `20260721160000_activate_photo_license_commerce` | APPLIQUÉE | `asset_readiness` + 2 politiques ; 608 assets `commercial_use` + `commercial` ; 608 lignes de préparation, 5 indicateurs vrais ; 608 fichiers `original` |
| `20260721180000_fix_sv_b500_0500_and_photo_commerce` | APPLIQUÉE | `SV-B500-0500` approved, published, commercial ; 3 mappings photo (note « Fix SV-B500-0500 ») |
| `20260721190000_add_test_credits_identify` | APPLIQUÉE | ligne `credit_ledger` : 20 crédits, référence `test_credit_identify_20260721` |
| `20260721200000_seafood_intelligence_hub` | APPLIQUÉE | 3 tables `hub_*`, RLS active, 5 politiques, 8 lignes `hub_credit_costs` |
| `20260721210000_credit_pack_env_var_mappings` | APPLIQUÉE, puis modifiée | 4 mappings de packs avec ses notes ; identifiants réels et actifs, donc mis à jour ensuite par l'administration Dodo |
| `20260721220000_photo_license_env_var_mappings` | SANS OBJET VÉRIFIABLE | licence `commercial` et 3 `unit_products` présents (déjà par d'autres migrations) ; ses mappings placeholder n'ont pas d'effet (`DO NOTHING`) ; `unit_products.license_type_code` est NULL |
| `20260721230000_create_identification_uploads_bucket` | APPLIQUÉE | bucket privé, 20 Mo, 6 types d'images, 5 politiques `identification_uploads_*` |

Point d'attention sur `20260721160000` et `20260721180000` : les 608 fichiers `original` créés pointent vers le même chemin que l'aperçu (bucket `asset-previews`, 608 sur 608). Ce ne sont pas de vrais originaux : la livraison payante d'un fichier « original » enverrait l'aperçu.

### `20260720220000` modifiée par Rocket

Le contenu ajoute la création de la colonne `billing_cycle`, de la contrainte de cohérence (non validée) et des deux index uniques, et retire le contrôle des prix. Rien ne contredit la base : colonne, contrainte non validée, index `uq_payment_mapping_*` et mapping Professional mensuel sont présents (plan 79 / 790 EUR). Une incohérence demeure : l'ancienne contrainte unique `payment_product_mappings_internal_product_type_internal_pro_key` existe toujours (le nom du `DROP` dépasse 63 caractères et ne correspond pas). Elle empêche d'avoir un mapping mensuel et annuel pour le même plan : à traiter à l'étape 6 avant les mappings annuels.

Historique distant : parmi les versions ≥ 20260720, seules `20260720120000`, `20260720180000` et `20260720220000` sont enregistrées.

### Migrations Rocket : décision

Les 9 migrations Rocket sont marquées `applied` via `migration repair` (aucun SQL exécuté). `migration list` : 49 locales, 49 distantes, toutes alignées.

- **`20260720230000` et `20260720240000` : NEUTRALISÉES, ne doivent jamais être exécutées.** `20260720230000` contient des identifiants Dodo faux (confusions I/l, X/x). `20260720240000` fait un `DELETE` sur les mappings `credits_500` et `credits_1000` actuels.
- **`20260721220000` : neutralisée car sans effet propre** (ses licences et produits existent déjà, ses mappings placeholder n'ont pas d'effet).
- Les 6 autres (`20260721160000`, `180000`, `190000`, `200000`, `210000`, `230000`) sont APPLIQUÉES : leur effet est constaté en base.

### Corrections après fusion

- `LibraryContent.tsx` et `LibraryFilters.tsx` restaurés depuis `c281c2b` (les versions de `origin/main` contenaient un message d'erreur de limite de débit). Aucune adaptation d'import ou de type n'a été nécessaire : le type-check passe.
- 4 tests corrigés :
  - `supabaseRuntimeConfig` : le TEST était faux (clé factice sans le préfixe `eyJ`, alors que le code valide désormais la forme JWT) ; clé factice de forme JWT.
  - `marketplaceStabilization` : le TEST était faux (le message de blocage a été volontairement allongé) ; comparaison par sous-chaîne.
  - `multiProductCart` : le TEST était faux (le code retire volontairement le panier des packs de crédits) ; il vérifie maintenant le paiement direct (`credit_pack: packCode`) et l'absence de `itemType: 'credit_pack'`.
  - `dodoTestMappings` (aucun `pdt_` dans le front) : le CODE était à corriger. Aucun vrai identifiant Dodo n'était dans le front : seulement un texte indicatif (`placeholder` d'un champ de l'admin) et une expression de détection de placeholder dans une route API sous `src/app`. Le texte indicatif est neutre, la détection est déplacée côté serveur dans `src/lib/payments/dodoPlaceholders.ts`. Les identifiants réels viennent de `payment_product_mappings` via les API serveur.

## Points bloquants avant vente réelle

- **Aucune vente réelle n'est possible avant l'étape 4.** Les 608 fichiers `original` de `asset_files` pointent vers les aperçus filigranés (même chemin, bucket `asset-previews`, 608 sur 608). Il faut de vrais originaux dans un bucket privé, et remplacer ces lignes.
- **Contrainte unique `payment_product_mappings_internal_product_type_internal_pro_key` toujours présente** (étape 6) : elle empêche un mapping mensuel et un mapping annuel pour le même plan. Le nom utilisé par les migrations dépasse 63 caractères, donc le `DROP` ne l'atteint pas.
- Mappings Dodo à rejouer en version additive et à vérifier contre le tableau de bord Dodo (étape 6) ; ne jamais réutiliser les identifiants de `20260719120000` et `20260720230000`.

## Étape 2 — Recentrage V1

Branche `v1/etape-2-recentrage` (non commitée au moment de l'écriture). Libellés conservés en anglais (français prévu à l'étape 8).

### Interrupteur
- `NEXT_PUBLIC_V1_SCOPE=true` (voir `.env.example`), logique dans `src/lib/v1Scope.ts`. Rien n'est supprimé : les routes sont masquées, pas effacées. Retour à la V2 = passer la variable à `false`.
- Script `dev` fixé sur le port 4028.

### Routes masquées (404 via `src/middleware.ts`)
- Pages publiques : `/identify`, `/assistant`, `/knowledge`, `/api-access`, `/mvp-report`, `/marketing-kit`, `/account/credits`.
- Admin : `/admin/ai-identification`, `/admin/ai-studio`, `/admin/assistant`, `/admin/knowledge`, `/admin/identification`, `/admin/reviewer-dashboard`.
- Hub (validé comme V2) : `/hub`, `/admin/hub`, `/api/hub`.
- API : `/api/ai`, `/api/sie`, `/api/assistant`, `/api/identification`, `/api/payments/dodo/credit-checkout` (réponse JSON 404).
- Produits à l'unité non vendus en V1 : `photo_ultrahd`, `video`, `view_360` (filtrés dans tarifs, panier, `/api/cart/items`, pages asset/produit). Offres crédits/AI/API/Marketing kit filtrées dans `/pricing`, `/pricing/compare`, `/pricing/faq`.

### Liens retirés / navigation
- Menu V1 : Library, Species, Collections (`/discover`), Pricing, Enterprise, About, Contact. Le lien « Collections » du footer pointe désormais vers `/discover`.
- Footer : liens vers routes masquées filtrés ; une section vide n'est pas affichée.
- Accueil : 3 boutons (HeroSection, HomepageCTA).
- `/discover` affiche les collections ; l'ancienne vue est conservée dans `src/app/discover/DiscoverKnowledgeView.tsx`.

### Migration appliquée
- `20261004120000_v1_restore_review_workflow.sql` appliquée avec `supabase db push` sur le projet lié (`pbrjxdpnonkfcjavfdsh`).
- `migration list` : 50/50 locales = distantes, aucun écart.
- Vérifié en base : tables `asset_workflow`, `asset_badges`, `asset_review_comments`, `license_definitions` présentes ; `license_definitions` = 5 lignes ; fonction `recalculate_asset_completion` présente.
- `asset_workflow` est vide (620 assets). `/admin/reviews` et `/admin` lisent les assets depuis `assets` et traitent le workflow comme optionnel (`workflow ?? null`, statut par défaut `imported`) : pas de seed nécessaire, aucune migration de seed ajoutée. `asset_readiness`, `asset_status_history` et `profiles` existent.

### Résultats
- `type-check` : OK, 0 erreur.
- `lint` : 0 erreur, 289 avertissements (surtout `no-explicit-any`, dont `prefer-const` dans `middleware.ts:129`).
- `test` : 11 suites, 283 tests OK.
- `build` : OK.
- `npm run dev` (port 4028) : `/`, `/library`, `/species`, `/discover`, `/pricing`, `/enterprise`, `/contact` → 200 ; `/identify`, `/assistant`, `/knowledge`, `/hub` → 404 ; `/admin` et `/admin/reviews` → 307 vers `/auth`.
- Remarque : juste après `npm run build`, le serveur dev renvoyait 500 partout (erreur Turbopack `next/font/google`, cache `.next` périmé). Après suppression de `.next`, tout est revenu normal. Si cela se reproduit, supprimer `.next` avant `npm run dev`.
- Non testé : le rendu de `/admin` et `/admin/reviews` une fois connecté (nécessite une session admin) ; à regarder dans le navigateur.

## Étape 5 — Espèces et collections

Branche `v1/etape-5-especes`. Rien n'est supprimé : on masque (`species.is_public = false`) ou on passe en `draft`.

### Fiches espèces
- 24 fiches publiées avec description (habitat, profondeur, aire de répartition et taille maximale d'après FishBase), famille alignée sur FishBase, `seo_title` et `seo_description`. Aucun nombre de photos dans les textes SEO.
- Lecture publique : les requêtes espèces filtrent sur `is_public = true` (`queries.ts`, `encyclopediaQueries.ts`, `SpeciesHighlight.tsx`).
- 56 espèces visibles sur 61 ; masquées : `penaeus-monodon`, `loligo-vulgaris`, `scomber-scombrus` (démo), `cyneglossus-cyneglossus` et `unclassified` (aucune photo publiée).
- Constat : seules 3 espèces portent `is_demo = true` en base (et non 7). 32 espèces visibles n'ont pas encore de fiche rédigée (description vide) ; elles restent visibles avec leurs photos.

### Penaeus monodon
- Fiche masquée. Ses 10 photos non démo (dont SV-IMP-0020 et SV-IMP-0349) sont en `draft` et absentes de toutes les collections ; les 2 photos SV-DEMO sont `archived`.

### Collections
- 8 collections actives (`is_active = true`), `asset_count` égal au nombre d'éléments, tous publiés (829 liens au total).
- Aperçus et miniatures de SV-IMP-0092, 0122 et 0123 régénérés (7 oct. 2026, 20:21 UTC).

### Résultats
- `type-check` : OK. `lint` : 0 erreur, 289 avertissements. `test` : 12 suites, 287 tests OK. `build` : OK.
- Visibilité publique vérifiée avec la clé anon : SV-IMP-0020 et SV-IMP-0349 invisibles, `penaeus-monodon` masquée, 8 collections lisibles.
- Aucune migration de schéma ajoutée.

### Reprise de l'étape 5 (9 oct. 2026) — fiches espèces
- Logo, `no_image.png` et favicon restaurés depuis `c26b3d4`.
- Photo principale réelle sur la fiche espèce (aperçu filigrané, URL signée) ; grille de 6 photos « From 5€ » et bouton « View all photos ».
- Photothèque : filtre `?species=<slug>`.
- Badge unique basé sur `validation_status` ; champs vides masqués dans « Species Data ».
- Noms FAO : 24 fiches renommées (ex. `sardinella-aurita` → Round sardinella), début des descriptions aligné ; `genus` rempli ; catégories au pluriel (Fish, Crustaceans, Cephalopods, Molluscs — `cymbium-spp` passe de « Other seafood » à Molluscs).
- 24 fiches en `validation_status = verified` et `is_validated = true` ; `taxonomic_status` reste vide.
- Codes FAO alpha-3 posés sur 13 espèces (SKJ, YFT, TUN, SAL, BON, PIL, SAA, MAS, OCC, CTC, LHT, SWO, GFB) ; les 11 autres restent vides et sont masqués à l'affichage.
- 32 espèces sans fiche masquées (`is_public = false`) : rien n'est supprimé, leurs photos restent publiées et en vente. Au total 24 espèces visibles, 37 masquées.
- Fiches prioritaires à rédiger plus tard : `litopenaeus-vannamei`, `gadus-morhua`, `coryphaena-hippurus`, `merluccius-spp`.
- Aucune migration ; Dodo reste en TEST.

## Étape 6 — Commerce (9 oct. 2026)

Procédures (fichiers web, tunnel cloudflared, achats test) : `docs/ETAPE_6_COMMERCE.md`. Dodo reste en **TEST**.

### Comptages exacts (l'API REST plafonne une réponse à 1000 lignes)
- 1215 assets, **1061 publiés** ; 1189 originaux, 1189 aperçus, 1185 miniatures. Les chiffres 332 + 398 + 270 = 1000 étaient tronqués.
- Aucun asset publié sans original ni sans aperçu. Les 4 assets sans miniature (SV-IMP-0127, 0133, 0139, 0141) sont en `draft` : rien à régénérer.
- 216 publiés ont un grand côté ≤ 1920 px (leur fichier web est l'original nettoyé), 845 sont plus grands.

### Faille corrigée : une Photo Web livrait l'original HD
- `/api/downloads/[entitlementId]` choisissait le fichier parmi `original|hd|full` sans lire `allowed_resolution`. Désormais : `web` → fichier `web` ; `hd` / `ultrahd` / extended → `original` ; valeur absente ou inconnue → `web`. Si le fichier web manque, la route répond 404 `WEB_FILE_NOT_AVAILABLE` : **pas de repli sur l'original**, aucun quota consommé.
- URL signée : **300 s** par défaut (`DOWNLOAD_SIGNED_URL_DURATION`, plafonné à 3600), servie en pièce jointe sous le nom `<ID public>-web.jpg` / `-hd.jpg`.
- Tests : sur l'ancienne route, 4 des tests de téléchargement échouent ; sur la nouvelle, tous passent.

### Migrations appliquées (`supabase db push`, liste vérifiée à blanc : exactement ces trois)
1. `20261009100000` : `unit_products.list_price` et `promo_ends_at` (+ contrainte `list_price >= price`) ; prix normaux 15 / 39 / 299 / 290 (web, HD, HD + extended, pack), fin de promotion 2027-01-31.
2. `20261009110000` : niveau de fichier `web` ; les policies de lecture publique et authentifiée de `asset_files` passent de `file_level != 'original'` à la liste blanche `preview`, `thumbnail` (sinon le chemin du fichier web aurait été lisible). Vérifié avec la clé anon : 1061 aperçus, 1061 miniatures, 0 original, 0 fichier web ; l'URL publique et le téléchargement anonyme du fichier web sont refusés.
3. `20261009120000` : `pack_10` devient « Pack 10 Photos HD » (résolution `hd`, `pack_size` 10, quota 1 par photo).
- **Migration 4 (reportée à la V2, abonnements)** : `DROP` de la contrainte `payment_product_mappings_internal_product_type_internal_pro_key`. Non appliquée.

### Fichiers web (Photo Web)
- 1920 px max, JPEG q85, sans filigrane, GPS et numéros de série retirés, copyright IPTC/XMP conservé ou ajouté ; bucket privé `asset-originals`, chemin `web/<sha[0:2]>/<sha>.jpg`. Original déjà ≤ 1920 px et JPEG : l'original nettoyé, sans recompression.
- Scripts dans `C:\Projects\SeafoodVision\scripts\import_prep\` (hors de ce dépôt) : `generate_web_files.js` (idempotent, concurrence 3, reprise réseau) et génération intégrée à `import_photos.js` pour les lots 2 et 3.
- Fait en essai réel : 2 fichiers (SV-IMP, 1440 × 1920) ; les 1059 autres publiés restent à générer par l'utilisateur.

### Pack 10 Photos HD (remise automatique)
- Seules les Photo HD standard comptent. Par bloc de 10 : un produit Dodo « Pack 10 Photos HD » (150 €), le reste à l'unité (12 HD = 1 pack + 2 × 20 € = 190 €). Chaque photo reste une ligne de commande : le webhook crée donc une licence et un droit de téléchargement par photo.
- `orders.discount_amount` et `total_amount` sont recalculés à chaque modification du panier ; au paiement, le panier Dodo est construit avec le pack et une garde refuse le paiement si le total Dodo diffère du total en base. `pack_10` ne peut pas être ajouté comme ligne (« pack products are applied automatically at checkout »).

### Licence PDF
- `GET /api/licenses/[licenseId]/pdf` (pdf-lib 1.17.1) : numéro `SVL-<année>-<12 hex>` dérivé de l'identifiant de licence, numéro de commande, acheteur, ID public de la photo, type de licence, résolution livrée, date, conditions (`license_types`), concédant. Générée à la première demande (pas dans le webhook), stockée dans le bucket privé `license-documents`, réutilisée ensuite ; bouton sur `/account/licenses`.
- Concédant : constante `LICENSOR_NAME` (`src/lib/licensing/config.ts`, « SeafoodVision » par défaut, surchargeable par la variable `LICENSOR_NAME`). **À remplacer par la société avant la mise en ligne.**
- Le bucket `license-documents` est créé au premier usage par le code (service role, privé, PDF uniquement, 2 Mo) et non par une migration. À formaliser en migration si l'on veut tout versionner.
- Mise en page non vérifiée à l'œil (pas de rendu PDF disponible dans l'environnement de travail) ; structure et contenu testés.

### Prix : la base est la source de vérité
- `pricingConfig.ts` ne contient plus aucun prix d'unité ; `/pricing`, la fiche photo, la carte espèce et le panier lisent `unit_products` et affichent prix barré + « Launch price until 31 Jan 2027 ». L'extended (299 = 299) n'est pas barré. Prix de l'extended retiré de `LICENSE_TYPES` (null).
- **Après le 31/01/2027, il faudra changer les prix à la main dans la base ET dans Dodo** : l'affichage de la promotion s'arrête seul, mais les produits Dodo ont un prix fixe (5 / 20 / 150 €…) et `unit_products.price` est ce que le panier facture. Rien ne bloque la vente à l'ancien prix.

### Dodo TEST : produits et mappings
- Créé : « Photo HD + licence étendue » (299 €, paiement unique, taxe incluse). Renommé : « Pack 10 images » → « Pack 10 Photos HD » (150 €) et passé en **taxe incluse**, comme Photo HD, pour que le total affiché soit le total payé.
- Mappings `one_time_asset_license` (environnement test) : `photo_hd_extended` et `pack_10` ajoutés.
- **Erreur de mapping corrigée** : les ids de **Photo Web** et **Photo Ultra HD** en base avaient des I majuscules à la place de l minuscules (`…cviI5DWtIC` au lieu de `…cvil5DWtlC`, `…wTCalm9m` au lieu de `…wTCaIm9m`) : ils n'existaient pas dans Dodo et un achat de Photo Web aurait échoué. Remplacés par les ids lus dans l'API Dodo. Les 5 mappings photo, les 4 packs de crédits et les 3 abonnements mensuels ont été comparés un à un aux produits Dodo : tous exacts.
- Les anciennes migrations (`20260719120000`, `20260721160000`, `20260721180000`) et `docs/sprint-1-5-dodo-test-mappings-report.md` portent toujours les ids erronés : sans effet sur la base actuelle, mais à corriger avant de rejouer l'historique sur une base neuve.
- Mappings des crédits et des abonnements : non touchés.

### Webhook
- Signature Standard Webhooks vérifiée (valide : 200 et traitement ; signature invalide, corps modifié, en-tête manquant, horodatage périmé : 401 sans rien enregistrer ; secret absent : 503 ; doublon : acquitté sans second traitement ; échec de traitement : 500 pour que Dodo réessaie). `DODO_PAYMENTS_WEBHOOK_SECRET` est vide dans `.env.local` : à saisir (procédure dans `docs/ETAPE_6_COMMERCE.md`).

### Résultats
- `type-check` : OK. `lint` : 0 erreur, 289 avertissements (inchangé). `test` : **17 suites, 353 tests OK** (+5 suites, +66 tests : webhook, accès aux téléchargements, pack, prix, licence PDF). `build` : OK. Redémarrage propre sur le port 4028 (arrêt, suppression de `.next`, `npm run dev`).
- Les 31 commandes existantes (13 draft, 10 pending, 8 cancelled) n'ont pas été touchées.
