# Metro Public School — Website + Enquiry Backend

This package contains the full school website (`/public`) plus a Node.js +
Express backend (`server.js`) that saves every enquiry form submission into a
real SQLite database (`data/enquiries.db`), and a password-protected admin
dashboard to view and export the leads.

## What's inside

```
metro-public-school-website/
├── server.js           <- Express server (serves the site + API + admin panel)
├── package.json
├── .env.example         <- copy to .env and set your admin password
├── public/               <- the website itself (all pages)
│   ├── index.html, about.html, facilities.html, campus.html,
│   │   admissions.html, contact.html
│   ├── robots.txt, sitemap.xml
└── data/                 <- created automatically; enquiries.db lives here
```

Every enquiry form on the site (the popup modal, the Admissions page form,
and the Contact page quick-message form) sends data to `/api/enquiry`, which
saves it to the database.

## 1. Run it on your own computer (to test)

You need [Node.js](https://nodejs.org) installed (version 18 or newer).

```bash
cd metro-public-school-website
npm install
npm start
```

Then open:
- **Website:** http://localhost:3000
- **Admin dashboard:** http://localhost:3000/admin
  - Username: `admin`
  - Password: `changeme123` (change this — see below)

## 2. Change the admin password (important)

Copy `.env.example` to `.env` and edit it:

```
ADMIN_USER=admin
ADMIN_PASS=your-own-strong-password
```

Never keep the default password when you go live.

## 3. Deploying online (so parents can actually use it)

Since you've used **Render.com** before (for Prashasti IAS Academy), the same
approach works here:

1. Push this whole folder to a GitHub repository.
2. On Render, create a **new Web Service** and connect that repo.
3. Build command: `npm install`
4. Start command: `npm start`
5. Add environment variables `ADMIN_USER` and `ADMIN_PASS` in Render's
   dashboard (Environment tab) instead of using `.env`.
6. Once deployed, your site is live at the Render URL, and the admin panel
   is at `https://your-app.onrender.com/admin`.
7. Point your custom domain (like you did with `prashastiias.com`) to this
   Render service the same way, and keep UptimeRobot pinging it to avoid
   cold starts.

### Important: free-tier disk storage

On Render's **free** web service plan, the disk is not guaranteed to persist
across every redeploy. That means your `data/enquiries.db` file could reset
when you push new code. For a live admissions form, it's strongly
recommended to either:
- Upgrade to a Render plan with a **persistent disk** (Render → your service
  → "Disks" → add a disk mounted at `/opt/render/project/src/data`), or
- Use a small always-on VPS (Hostinger, DigitalOcean, etc.) where the disk
  is always persistent, or
- Ask and I can add an optional feature to also email/WhatsApp you a copy of
  every enquiry the moment it's submitted (using Gmail SMTP or CallMeBot,
  like you did on the Divine Stack Technologies site) as a backup — so you
  never lose a lead even if the database resets.

## 4. Viewing and exporting leads

- Go to `/admin` (with your username/password) to see every enquiry in a
  table — name, phone, child's name, class, message, which page it came
  from, and submission time.
- Click **Download CSV** to export all leads into Excel.

## 6. ERP Integration (Admission Enquiries)

Every enquiry submitted on the website is now **also sent automatically to
the Metro Public School ERP**, so front-office staff see it under
**Admin Panel → Admission Enquiries** alongside enquiries submitted directly
on the ERP's own site. This happens in addition to (not instead of) the
local SQLite save above — so even if the ERP is temporarily unreachable, no
lead is lost; it just won't show up in the ERP until the next submission
once it's back online.

A **"Staff Login"** button has also been added to the header/mobile menu on
all 6 pages, linking to the ERP's login page.

### How it works
`server.js` forwards each enquiry as JSON to the URL set in the
`ERP_ENQUIRY_URL` environment variable, which hits the ERP's
`api/save_enquiry.php` endpoint.

### Local testing (XAMPP)
Already set as the default — no change needed:
```
ERP_ENQUIRY_URL=http://localhost/erp/api/save_enquiry.php
```
Make sure XAMPP (Apache + MySQL) is running and the ERP is imported/configured
before testing the enquiry form, otherwise you'll just see a harmless
"Could not forward enquiry to ERP" line in the console — the website itself
will keep working fine.

### When going live
Update two things once both are deployed:
1. In this website's environment variables (Render dashboard, or `.env` on a
   VPS), set `ERP_ENQUIRY_URL` to the ERP's real deployed URL, e.g.
   `https://metropublicschool.in/erp/api/save_enquiry.php`.
2. In this website's `public/*.html` pages, update the **"Staff Login"**
   links (currently `http://localhost/erp/login.php`) to the ERP's real
   login URL.


