# VIX Trading Dashboard

Persönliches VIX-Monitoring und Trading-Dashboard für Moritz.

## Setup

### 1. Supabase (Datenbank)
1. Gehe zu [supabase.com](https://supabase.com) und erstelle ein Projekt
2. Gehe zu **Project Settings → Database → Connection string**
3. Kopiere den "Transaction" URL → `DATABASE_URL` und "Direct connection" URL → `DIRECT_URL`

### 2. Resend (E-Mail Alerts)
1. Gehe zu [resend.com](https://resend.com) und erstelle einen API Key
2. Verifiziere deine Domain (oder nutze `onboarding@resend.dev` zum Testen)

### 3. Umgebungsvariablen
```bash
cp .env.example .env.local
# Fülle alle Werte aus
```

### 4. Datenbank initialisieren
```bash
npx prisma db push
```

### 5. Lokale Entwicklung

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://fonts.google.com/specimen/Geist).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

## Deploy auf Hostinger

Jeder Push zu `main` triggert automatisch ein Deployment auf Hostinger (vix-trading.de).
Env Vars setzen unter: Hostinger → Einsätze → Einstellungen und erneute Bereitstellung.
