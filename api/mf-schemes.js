const fs = require("fs");
const path = require("path");

let cachedData = null;

function loadData() {
  if (cachedData) return cachedData;
  const filePath = path.join(process.cwd(), "public", "schemes.json");
  const raw = fs.readFileSync(filePath, "utf8");
  cachedData = JSON.parse(raw);
  return cachedData;
}

module.exports = (req, res) => {
  // CORS headers for local dev
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  try {
    const data = loadData();

    const {
      search = "",
      plan = "All",
      option = "All",
      amc = "All",
      category = "All",
      risk = "All",
      minNav,
      maxNav,
      minAum,
      maxExp,
      page = 1,
      pageSize = 50
    } = req.query;

    const s = String(search).trim().toLowerCase();

    let rows = data.filter(r => {
      if (s) {
        const hay = ((r.scheme_name || "") + " " + (r.amfi_code || "")).toLowerCase();
        if (!hay.includes(s)) return false;
      }
      if (plan !== "All" && r.plan !== plan) return false;
      if (option !== "All" && r.option !== option) return false;
      if (amc !== "All" && r.amc !== amc) return false;
      if (category !== "All" && r.category !== category) return false;
      if (risk !== "All" && r.risk !== risk) return false;
      if (minNav && !(Number(r.nav) >= Number(minNav))) return false;
      if (maxNav && !(Number(r.nav) <= Number(maxNav))) return false;
      if (minAum && !(Number(r.aum_cr) >= Number(minAum))) return false;
      if (maxExp && !(Number(r.exp_ratio) <= Number(maxExp))) return false;
      return true;
    });

    const total = rows.length;
    const p = Number(page) || 1;
    const ps = Math.min(Number(pageSize) || 50, 200);
    const start = (p - 1) * ps;
    const pageRows = rows.slice(start, start + ps);

    res.status(200).json({ rows: pageRows, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error", detail: err.message });
  }
};
