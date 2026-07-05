// ============================================================
// Metro Public School — Backend Server
// Express + SQLite (sql.js) — saves enquiry form submissions
// and provides a password-protected admin dashboard to view them.
// ============================================================

const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { URL } = require('url');
const basicAuth = require('express-basic-auth');
const initSqlJs = require('sql.js');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'enquiries.db');

// URL of the ERP's public enquiry API endpoint (admin/... module: Admission Enquiries).
// Update this once the ERP is deployed to its final URL (subdomain or subfolder).
const ERP_ENQUIRY_URL = process.env.ERP_ENQUIRY_URL || 'http://metroschoolerp.infinityfreeapp.com/erp/api/save_enquiry.php';

// Forwards a submitted enquiry to the ERP so it shows up under
// Admin Panel -> Admission Enquiries. Best-effort: if the ERP is
// unreachable, the enquiry is still saved locally (see below) so
// no lead is ever lost.
function forwardToERP(payload) {
    return new Promise((resolve) => {
        try {
            const url = new URL(ERP_ENQUIRY_URL);
            const body = JSON.stringify(payload);
            const req = http.request({
                hostname: url.hostname,
                port: url.port || 80,
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body),
                },
                timeout: 5000,
            }, (res) => {
                res.on('data', () => {});
                res.on('end', () => resolve(true));
            });
            req.on('error', (err) => {
                console.error('Could not forward enquiry to ERP:', err.message);
                resolve(false);
            });
            req.on('timeout', () => { req.destroy(); resolve(false); });
            req.write(body);
            req.end();
        } catch (err) {
            console.error('ERP forward error:', err.message);
            resolve(false);
        }
    });
}

// Change these before deploying, or set them as environment variables
// on your hosting provider (recommended, so the password isn't in the code).
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'changeme123';

let db; // sql.js database instance (kept in memory, persisted to DB_FILE on every write)

function persist() {
  const data = db.export();
  fs.writeFileSync(DB_FILE, Buffer.from(data));
}

async function initDb() {
  const SQL = await initSqlJs();
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  if (fs.existsSync(DB_FILE)) {
    const fileBuffer = fs.readFileSync(DB_FILE);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
    db.run(`
      CREATE TABLE enquiries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        parent_name TEXT,
        phone TEXT,
        email TEXT,
        child_name TEXT,
        class_applied TEXT,
        message TEXT,
        source_page TEXT,
        created_at TEXT
      );
    `);
    persist();
  }
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

const app = express();
app.use(express.json());

// Serve the website (all the .html/.css/.js files) from /public
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Public API: receive enquiry form submissions ----------
app.post('/api/enquiry', async (req, res) => {
  try {
    const { parentName, phone, email, childName, className, message, sourcePage } = req.body || {};

    if (!parentName || !phone) {
      return res.status(400).json({ success: false, error: 'Name and phone are required.' });
    }

    const createdAt = new Date().toISOString();
    db.run(
      `INSERT INTO enquiries (parent_name, phone, email, child_name, class_applied, message, source_page, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [parentName, phone, email || '', childName || '', className || '', message || '', sourcePage || '', createdAt]
    );
    persist();

    // Also send this enquiry into the school ERP (Admin Panel -> Admission Enquiries),
    // so front-office staff see everything in one place. This is fire-and-forget:
    // it never blocks or fails the website's response to the parent.
    forwardToERP({ parentName, phone, email, childName, className, message, sourcePage });

    res.json({ success: true });
  } catch (err) {
    console.error('Error saving enquiry:', err);
    res.status(500).json({ success: false, error: 'Server error. Please try again.' });
  }
});

// ---------- Protected admin routes ----------
const adminAuth = basicAuth({
  users: { [ADMIN_USER]: ADMIN_PASS },
  challenge: true,
  realm: 'Metro Public School Admin',
});

function getAllEnquiries() {
  const result = db.exec('SELECT * FROM enquiries ORDER BY id DESC');
  if (!result.length) return [];
  const { columns, values } = result[0];
  return values.map((row) => Object.fromEntries(columns.map((col, i) => [col, row[i]])));
}

// Admin dashboard (view leads)
app.get('/admin', adminAuth, (req, res) => {
  const rows = getAllEnquiries();

  const tableRows = rows.map((r) => `
    <tr>
      <td>${r.id}</td>
      <td>${escapeHtml(r.parent_name)}</td>
      <td>${escapeHtml(r.phone)}</td>
      <td>${escapeHtml(r.email)}</td>
      <td>${escapeHtml(r.child_name)}</td>
      <td>${escapeHtml(r.class_applied)}</td>
      <td>${escapeHtml(r.message)}</td>
      <td>${escapeHtml(r.source_page)}</td>
      <td>${new Date(r.created_at).toLocaleString('en-IN')}</td>
    </tr>
  `).join('');

  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Admissions Enquiries — Admin | Metro Public School</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body{font-family:Arial,Helvetica,sans-serif;background:#FAF6EC;color:#2B2620;margin:0;padding:30px;}
  h1{color:#16213E;font-size:1.5rem;margin-bottom:4px;}
  p.sub{color:#6B6354;margin-top:0;margin-bottom:24px;}
  .toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;}
  .count{font-weight:bold;color:#7A1B2C;}
  a.export-btn{background:#B8863B;color:#fff;padding:10px 18px;border-radius:4px;text-decoration:none;font-size:.9rem;}
  table{width:100%;border-collapse:collapse;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,0.06);}
  th,td{padding:10px 12px;border-bottom:1px solid #eee;text-align:left;font-size:.85rem;vertical-align:top;}
  th{background:#16213E;color:#fff;position:sticky;top:0;}
  tr:hover{background:#F8F3E6;}
  .empty{padding:40px;text-align:center;color:#6B6354;background:#fff;}
</style>
</head>
<body>
  <h1>Admissions Enquiries</h1>
  <p class="sub">Metro Public School, Meerut — Admin Dashboard</p>
  <div class="toolbar">
    <div class="count">${rows.length} total enquiries</div>
    <a class="export-btn" href="/admin/export.csv">Download CSV</a>
  </div>
  ${rows.length ? `
  <div style="overflow-x:auto;">
  <table>
    <tr>
      <th>ID</th><th>Parent Name</th><th>Phone</th><th>Email</th><th>Child Name</th>
      <th>Class</th><th>Message</th><th>Source Page</th><th>Submitted At</th>
    </tr>
    ${tableRows}
  </table>
  </div>` : `<div class="empty">No enquiries yet. They will appear here as parents submit the form on the website.</div>`}
</body>
</html>`);
});

// CSV export of all enquiries
app.get('/admin/export.csv', adminAuth, (req, res) => {
  const rows = getAllEnquiries();
  const header = ['ID', 'Parent Name', 'Phone', 'Email', 'Child Name', 'Class', 'Message', 'Source Page', 'Submitted At'];
  const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [header.join(',')];
  rows.forEach((r) => {
    lines.push([
      r.id, r.parent_name, r.phone, r.email, r.child_name, r.class_applied, r.message, r.source_page, r.created_at
    ].map(csvEscape).join(','));
  });
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="enquiries.csv"');
  res.send(lines.join('\n'));
});

// ---------- Start server ----------
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Metro Public School server running on http://localhost:${PORT}`);
    console.log(`Admin dashboard: http://localhost:${PORT}/admin  (user: ${ADMIN_USER})`);
  });
}).catch((err) => {
  console.error('Failed to initialise database:', err);
  process.exit(1);
});
