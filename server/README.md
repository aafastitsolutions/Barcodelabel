# Barcode Label Studio License Server

Server mic pentru activarea online a aplicatiei desktop prin Lemon Squeezy.

## Flux

1. Clientul cumpara un produs/variant Lemon Squeezy cu license keys activate.
2. Clientul introduce cheia Lemon Squeezy in aplicatia desktop.
3. Aplicatia trimite `licenseKey + Machine ID + email` catre `/api/activate`.
4. Serverul valideaza/activeaza cheia cu Lemon Squeezy.
5. Serverul genereaza un `license.json` semnat pentru acel Machine ID.
6. Aplicatia salveaza licenta local si poate functiona offline pana la expirare.

## Configurare

1. Copiaza `server/.env.example` intr-un fisier `.env` pe serverul unde deployezi.
2. Seteaza `BLS_LICENSE_SECRET_KEY_B64` cu valoarea `secretKeyB64` din `tools/keys.json`.
3. Seteaza `LEMON_WEBHOOK_SECRET` cu signing secret-ul webhook-ului Lemon Squeezy.
4. Completeaza mapping-ul `LEMON_VARIANT_MONTHS_JSON` cu `variant_id` pentru planurile 1/6/12 luni.

## Rulare Locala

```powershell
$env:BLS_LICENSE_SECRET_KEY_B64="..."
$env:LEMON_WEBHOOK_SECRET="..."
npm run license-server
```

Health check:

```powershell
Invoke-RestMethod http://localhost:8787/api/health
```

## Endpointuri

- `POST /api/activate`
- `POST /api/webhooks/lemonsqueezy`
- `GET /api/health`

## Lemon Squeezy

In dashboard creezi webhook catre:

```text
https://license.aafastitsolutions.com/api/webhooks/lemonsqueezy
```

Evenimente recomandate:

- `license_key_created`
- `license_key_updated`
- `subscription_created`
- `subscription_updated`
- `subscription_payment_success`
- `subscription_expired`
- `order_refunded`

Aplicatia desktop foloseste pentru activare:

```text
https://license.aafastitsolutions.com/api/activate
```

## Important

Nu publica niciodata `BLS_LICENSE_SECRET_KEY_B64`, `tools/keys.json`, `.env` sau folderul `server/data`.
