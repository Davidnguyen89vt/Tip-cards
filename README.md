# Venmo/Cash App Tip Selector

A single-QR app for tipping technicians.

## What this does
- Customer scans one QR code.
- Customer sees only the tip page with one large technician dropdown list.
- Customer taps `Tip with Venmo` or `Tip with Cash App`.
- Staff directory editing is on a separate admin page.

## Setup (Local)
1. Install dependencies:
   ```bash
   npm install
   ```
2. Run the app:
   ```bash
   npm start
   ```
3. Open customer page: `http://localhost:4000`.
4. Open admin page for edits: `http://localhost:4000/admin`.

## Free Deployment (Render + Supabase)
This avoids Render disk cost.

1. Create a free Supabase project.
2. In Supabase, copy your Postgres connection string (URI format).
3. In Render (your web service), add environment variable:
   - `DATABASE_URL` = `<your-supabase-postgres-uri>`
4. Deploy this repo on Render using `render.yaml`.

How it works:
- If `DATABASE_URL` is set, app stores technicians in PostgreSQL.
- On first run, it auto-creates table `technicians` and seeds from `data/technicians.json`.

Important for Supabase connection string:
- SSL is enabled by default in this app.
- Use the direct Postgres URI from Supabase settings.

## Edit technicians anytime
On the admin page (`/admin`):
- Use **Add Technician** to add a new person.
- Use **Save** on an existing row to update name/Venmo/Cash App.
- Use **Remove** to delete a technician.

## One QR code
Create one QR code pointing to your deployed app URL (example: `https://tips.yourbusiness.com`).
That single QR code works for all technicians.

Generate/update QR files with:
```bash
npm run qr -- https://YOUR-SERVICE.onrender.com
```
Output files:
- `/Users/davidnguyen/Documents/Venmo Card/public/qr/customer-tip-qr.png`
- `/Users/davidnguyen/Documents/Venmo Card/public/qr/customer-tip-qr.svg`
