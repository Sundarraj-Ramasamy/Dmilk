# MilkRoute client

The client uses the MilkRoute API for all shop and ledger data. Run the sibling `server` app and configure its MongoDB connection and admin account before signing in.

From the workspace root:

1. Copy `server/.env.example` to `server/.env` and set a MongoDB URI, an administrator email/password, and a random JWT secret of at least 32 characters.
2. Run `cd server`, `npm install`, `npm run dev`.
3. In another terminal run `cd client`, `npm install`, `npm run dev`.
4. Open the Vite URL and sign in with the administrator credentials in `server/.env`.

The Vite development server proxies `/api` to `http://localhost:4000`. For deployment, set `VITE_API_URL` to the public API origin before building, and allow the deployed frontend origin in the API's `CLIENT_ORIGIN`.

MongoDB stores business records. The browser stores only the JWT session token. Existing demo records in LocalStorage are not automatically imported into MongoDB.
