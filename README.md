# MilkRoute

Mobile-first milk distribution management PWA built with React, TypeScript, Vite, Tailwind CSS and browser LocalStorage.

## Run locally

Requirements: Node.js 20.19+.

1. Run `cd client`, `npm install`, then `npm run dev`.
2. To test from a phone on the same Wi-Fi, run `npm run dev -- --host=0.0.0.0` and open the Network URL printed by Vite. This development URL is for browser testing; use HTTPS hosting to install the PWA.
3. Use the prefilled demo login to enter the app. Four sample shops are created automatically in this browser, with FCM rates of ₹63, ₹65, ₹66 and ₹68.

## Production builds

- `cd client && npm run build`

Deploy the contents of `client/dist` to any static HTTPS host. Vite PWA generates a web app manifest and service worker. After the first load, the app shell remains available offline and saved entries are stored in that browser's LocalStorage.

## Local data notice

This is a no-backend demo. Data is isolated to the browser and device where it is entered; it does not sync to another phone or computer. Clearing browser data can erase the ledger. The demo sign-in is a client-side convenience gate, not security. Do not use it as the authoritative business ledger or put sensitive customer information in a public deployment. Download daily/monthly reports for your records; those exports cannot restore app data. Supabase with row-level security and real authentication is the recommended next step before operational use.

Daily entries are unique per shop and date. Opening balances carry forward from the latest earlier closing balance, rates are snapshotted for saved bills, changed opening balances require an audit note, and daily totals include all active shops even when no entry has been made yet.
