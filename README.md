# Venmo/Cash App Tip Selector

A single-QR app for tipping technicians.

## What this does
- Customer scans one QR code.
- Customer sees only the tip page with one large technician dropdown list.
- Customer taps `Tip with Venmo` or `Tip with Cash App`.
- Staff directory editing is on a separate admin page.

## Setup
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

## Deploy on Render
1. Push this project to GitHub.
2. In Render, create a new **Blueprint** and select this repo.
3. Render will read `/Users/davidnguyen/Documents/Venmo Card/render.yaml`.
4. After deploy, open your live URL:
   - Customer: `https://YOUR-SERVICE.onrender.com`
   - Admin: `https://YOUR-SERVICE.onrender.com/admin`

Note:
- This app stores editable staff data in `technicians.json`.
- `render.yaml` mounts a persistent disk at `/var/data` and uses `DATA_DIR=/var/data` so updates are kept after restarts.

## Data source import
Technicians are imported from Bliss Nail Lounge Turn Management (`/Users/davidnguyen/Documents/Turn management/data/turns.json`) and stored in:
- `/Users/davidnguyen/Documents/Venmo Card/data/technicians.json`

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
