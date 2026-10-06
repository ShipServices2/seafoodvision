# Import du catalogue photo — mode d'emploi

Les scripts vivent dans le dépôt **`C:\Projects\SeafoodVision`** (dossier `scripts\import_prep\`), pas dans ce dépôt web.
Ils lisent les photos dans Dropbox (lecture seule), écrivent dans Supabase (projet `pbrjxdpnonkfcjavfdsh`) et gardent leur journal dans `C:\Projects\SeafoodVision\exports\`.

## Avant de lancer

1. **Plan Supabase Pro** activé (l'import complet pèse environ 3,3 Go d'originaux + 0,6 Go d'aperçus et miniatures ; le plan gratuit n'a que 1 Go).
2. L'ordinateur reste allumé et ne se met pas en veille pendant l'import (estimation : **environ 4 h 30**, soit ~3,9 s par photo).
3. Les HEIC et BMP ont déjà été convertis en JPEG (cache `C:\Projects\SeafoodVision\cache\converted`). Si ce dossier est vide ou supprimé, relancer d'abord :

```powershell
powershell -ExecutionPolicy Bypass -File C:\Projects\SeafoodVision\scripts\import_prep\convert_unsupported.ps1
```

## 1. Simulation (n'écrit rien)

```powershell
cd C:\Projects\SeafoodVision
node scripts\import_prep\import_photos.js
```

Elle liste ce qui serait importé (4 263 photos) et ce qui serait ignoré, sans toucher à la base ni à Storage.

## 2. Lancer l'import complet

```powershell
cd C:\Projects\SeafoodVision
node scripts\import_prep\import_photos.js --apply --concurrency 8 --status published 2>&1 | Tee-Object -FilePath exports\import_run.log -Append
```

- Statut `published` : les photos sont visibles sur le site dès qu'elles sont importées.
- Chaque photo : original sans GPS ni numéro de série → `asset-originals`, aperçu filigrané → `asset-previews`, miniature → `asset-thumbnails`, lignes `assets`, `asset_files`, `asset_previews`, `asset_readiness`, mots-clés, espèce.

## 3. Suivre la progression

Une ligne s'affiche toutes les 10 secondes :

```
[14:32:10] traité 1250/4263 (29.3 %) | importées 1248 | déjà faites 0 | ignorées 2 | erreurs 0 | 0.26 photo/s | temps restant ~3 h 1 min
```

Depuis une autre fenêtre PowerShell :

```powershell
Get-Content C:\Projects\SeafoodVision\exports\import_progress.txt -Wait
```

## 4. Reprendre après une coupure

Relancer **exactement la même commande** (étape 2). Le script saute tout ce qui est déjà fait (fichier d'état `exports\import_state.json` + clé `assets.source_sha256` en base) ; une photo interrompue en cours est simplement refaite. Rien n'est jamais dupliqué.

```powershell
cd C:\Projects\SeafoodVision
node scripts\import_prep\import_photos.js --apply --concurrency 8 --status published 2>&1 | Tee-Object -FilePath exports\import_run.log -Append
```

Pour tout retraiter malgré l'état déjà enregistré (par exemple après un changement de filigrane) : ajouter `--force`.

## 5. Erreurs et contrôles

```powershell
# photos en erreur ou ignorées, avec la raison
Select-String -Path C:\Projects\SeafoodVision\exports\import_journal.jsonl -Pattern '"status":"(error|skip)"'
```

Les erreurs réseau passagères sont retentées 4 fois automatiquement ; si une photo reste en erreur, relancer la commande de l'étape 2 suffit.

Journal complet : `exports\import_journal.jsonl` (une ligne JSON par photo). Résumé de fin : affiché à la fin de la commande.

## 6. Essai sur un sous-ensemble

```powershell
node scripts\import_prep\import_photos.js --only-file exports\import_trial_50.csv --apply
node scripts\import_prep\import_photos.js --apply --limit 100        # les 100 premières photos du manifeste
```

## Paiements

Tout reste en mode **TEST** Dodo (`DODO_PAYMENTS_ENVIRONMENT` vide ou `test`). Le produit « Photo HD — Extended licence » (299 €) existe côté base, mais il faut créer le produit TEST à 299 € dans Dodo et le relier depuis `/admin/commerce/mappings` avant de pouvoir le payer.
