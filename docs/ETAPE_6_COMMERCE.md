# Étape 6 — Commerce : procédures

Tout se fait en **Dodo TEST**. Aucun secret n'est écrit dans ce dépôt : `DODO_PAYMENTS_WEBHOOK_SECRET` se saisit à la main dans `.env.local`.

## 1. Générer les fichiers « web » (une fois, puis à chaque lot importé avant l'étape 6)

Depuis `C:\Projects\SeafoodVision`, dans PowerShell :

```powershell
node scripts\import_prep\generate_web_files.js --status published                       # essai à blanc : ne modifie rien, affiche ce qui serait généré
node scripts\import_prep\generate_web_files.js --status published --apply --concurrency 3 2>&1 | Tee-Object -FilePath exports\web_files_run.log -Append
```

- Idempotent : les assets qui ont déjà un fichier `web` sont ignorés. En cas de coupure, relancer **la même commande**.
- Sans `--status`, les photos en `draft` sont traitées aussi (utile avant de les publier).
- Les lots 2 et 3 (`import_photos.js`) génèrent le fichier web automatiquement.
- Suivi : `exports\web_files_progress.txt` ; journal : `exports\web_files_journal.jsonl`.
- Vérification de fin : l'essai à blanc doit afficher `0 a generer`.

## 2. Tunnel cloudflared + endpoint webhook Dodo TEST

1. Installer cloudflared : `winget install --id Cloudflare.cloudflared` (puis rouvrir PowerShell).
2. Démarrer le site : `npm run dev` (port 4028).
3. Dans un second PowerShell : `cloudflared tunnel --url http://localhost:4028`. Noter l'adresse `https://<mots>.trycloudflare.com` affichée. **Elle change à chaque lancement.**
4. Tableau de bord Dodo, interrupteur sur **Test Mode** → *Developer* → *Webhooks* → *Add Endpoint* :
   - URL : `https://<mots>.trycloudflare.com/api/webhooks/dodo-payments`
   - événements : `payment.succeeded` (obligatoire), `payment.failed`, `refund.succeeded` (facultatifs)
   - copier la **clé de signature** (`whsec_…`) de l'endpoint.
5. Dans `.env.local` : `DODO_PAYMENTS_WEBHOOK_SECRET=whsec_…`. Vérifier aussi `DODO_PAYMENTS_ENVIRONMENT=test` (vide = test) et, pour revenir sur le tunnel après paiement, `DODO_PAYMENTS_RETURN_URL=https://<mots>.trycloudflare.com/checkout/success` et `DODO_PAYMENTS_CANCEL_URL=https://<mots>.trycloudflare.com/checkout/cancel`.
6. **Redémarrer** `npm run dev` (les variables ne sont lues qu'au démarrage).
7. Contrôle : `curl.exe -s -o NUL -w "%{http_code}" -X POST https://<mots>.trycloudflare.com/api/webhooks/dodo-payments -d "{}"` doit répondre **401** (signature absente). 503 = secret non lu.
8. Si le tunnel est relancé : modifier l'URL de l'endpoint dans Dodo (la clé de signature reste la même) et mettre à jour les deux URL de retour.

## 3. Procédure d'achat test

Carte de test Dodo : `4242 4242 4242 4242`, date future, CVC quelconque. Utiliser un compte acheteur **différent** du compte admin, avec une photo en **résolution HD** (≥ 4 Mpx) pour les achats 2 à 4.

Achats 1 à 3 : bouton **Buy License** de la fiche photo (paiement direct) ou « Add to cart » puis panier, au choix. Achat 4 : obligatoirement par le **panier** (« Add to cart » sur 12 photos).

Avant chaque achat : panier vide. Après chaque achat, dans le tableau de bord Dodo → Webhooks → l'endpoint → *Logs* : `payment.succeeded` doit afficher **200**.

| # | Achat | Total attendu | À vérifier |
|---|-------|---------------|------------|
| 1 | **Photo Web** (une photo) | 5 € | Prix 15 € barré + « Launch price until 31 Jan 2027 » sur la fiche photo, `/pricing` et le panier. Après paiement : `orders.status = paid`, 1 `purchased_licenses` (`active`), 1 `download_entitlements` (`allowed_resolution = web`). `/account/downloads` → le fichier reçu fait **≤ 1920 px, sans filigrane**, nommé `SV-…-web.jpg`. **Ce n'est pas l'original** (comparer avec la taille de l'original HD). L'URL signée expire après 5 min. |
| 2 | **Photo HD** | 20 € | Prix 39 € barré. 1 licence, 1 droit `allowed_resolution = hd`. Fichier reçu = **original pleine résolution**, nommé `SV-…-hd.jpg`. Un second clic sur « Download » est refusé (quota 1). |
| 3 | **Photo HD + extended licence** | 299 € | Pas de prix barré (299 = 299). Licence de type *Extended* ; fichier = original ; `/account/licenses` → bouton **Licence PDF** : le PDF indique le type *Extended*, la résolution HD, le concédant `SeafoodVision`, un numéro `SVL-2026-…` et le numéro de commande. |
| 4 | **Pack de 10** : mettre **12 photos HD** (HD standard, pas extended) dans le panier | 190 € = 150 € + 2 × 20 € | Panier : ligne « Pack 10 Photos HD × 1 … −50.00 EUR », total 190. Page de paiement Dodo : « Pack 10 Photos HD × 1 » et « Photo HD × 2 ». Après paiement : **12** licences et **12** droits de téléchargement (un par photo), `orders.total_amount = 190`, `discount_amount = 50`. |

Contrôles communs :
- `/account/licenses` : bouton **Licence PDF** → 1ʳᵉ demande : génération ; 2ᵉ demande : le **même** PDF (même numéro `SVL-…`), `purchased_licenses.metadata.licensePdf.path` renseigné.
- Le PDF contient : numéro de licence, numéro de commande, nom de l'acheteur, ID public de la photo, type de licence, résolution livrée, date, conditions (droits, restrictions, territoire, durée), concédant.
- Rejouer le même webhook depuis Dodo (*Resend*) ne crée **aucune** licence en double (`payment_webhook_events` : un seul événement traité).
- Un autre compte ne peut ni télécharger (403) ni obtenir le PDF (403).
- Les 31 commandes antérieures (draft / pending / cancelled) ne bougent pas.
