# BizBook — your work diary in your pocket

**BizBook** is a simple phone app for busy business owners who make many promises to many clients,
take site measurements, and send quotations and bills. It keeps everything in one place.

> **Case study: an interior designer.** He visits a site, measures every room, works out the
> area, prices the work, sends a quotation, promises "delivery next Monday", collects an advance,
> and does this for ten clients at once. Today all of that is spread across a notebook, the phone
> calculator, WhatsApp and memory. BizBook puts it in one app.

---

## What it does

| Tab | What he uses it for |
|---|---|
| **Today** | Opens to one screen showing what's **overdue**, what's **due today**, and what's due **this week**. One tap marks a promise as done. |
| **Clients** | Every client with their phone and site address. Tap to **call** or **WhatsApp**. Open a client to see all their promises, measurements, quotes, and money due. |
| **Promises** | "Deliver sofa to Mr. Shah — next Monday." Quick date buttons (*Today, Tomorrow, Next Mon, +1 week*). Add it to the phone's own calendar so the phone **rings an alarm**. |
| **Measure** | Site measurement sheet: room → items (wall, ceiling, floor, wardrobe…) in **feet + inches** or metres. Area and running length are worked out automatically. One tap turns a measurement into a quotation. |
| **Quotes & Bills** | Line items × rate = amount, plus discount, GST/tax, advance paid, and **balance due**. Turn a quote into a bill in one tap. Share it on **WhatsApp** or print/save it as **PDF**. |
| **Calculator** | A big-button calculator that is always one tap away, plus a feet-inch area calculator and a circle calculator (diameter → radius, circumference & area). |

### Design rules (keep it easy)
- **Big buttons, big text.** One main action per screen (the round **+** button).
- **No sign-up and no internet needed.** Data stays on the phone.
- **Backup** to a file with one tap (Settings → Backup), so a lost phone doesn't mean lost data.
- Your business name, phone and logo text go on every quote and bill.

---

## How to install on a phone

1. Put this project on GitHub (see below). GitHub Pages builds the site automatically.
2. On the phone, open `https://<your-github-username>.github.io/bizbook/`
3. **Android (Chrome):** menu ⋮ → **Install app** / **Add to Home screen**.
   **iPhone (Safari):** Share button → **Add to Home Screen**.
4. It now opens from the home screen like any app and works offline.

## Publish to GitHub

```bash
cd bizbook
git init
git add .
git commit -m "First version of BizBook"
git branch -M main
git remote add origin https://github.com/<your-username>/bizbook.git
git push -u origin main
```

Then on GitHub: **Settings → Pages → Source: GitHub Actions**. The workflow in
`.github/workflows/pages.yml` publishes the app every time you push.

## Run it on your computer

```bash
cd bizbook
python -m http.server 8080
```
Open http://localhost:8080

## Tech
Plain HTML/CSS/JavaScript with no build step. Data is stored in the browser's `localStorage`, and
a service worker makes the app work offline.

## Roadmap ideas
- Photo of the site attached to a measurement
- Payment reminders to clients over WhatsApp
- Material/stock list per project
- Android APK build in GitHub Releases (Capacitor)
- Hindi / Urdu language option
