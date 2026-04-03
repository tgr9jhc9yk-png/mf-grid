const CACHE_DURATION = 48 * 60 * 60 * 1000; // 48 hours in milliseconds

// Cache variables
let cachedData = null;
let cacheTimestamp = null;

// Fetch all schemes from mfdata.in
async function fetchFromAPI() {
  try {
    const url = 'https://mfdata.in/api/v1/schemes';
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API returned ${response.status}`);
    }
    const result = await response.json();
    // mfdata.in returns { data: [...] }
    return Array.isArray(result) ? result : (result.data || []);
  } catch (err) {
    console.error('API fetch error:', err);
    throw err;
  }
}

// Load data with server-side caching
async function loadData() {
  const now = Date.now();
  if (cachedData && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedData;
  }
  const data = await fetchFromAPI();
  cachedData = data;
  cacheTimestamp = now;
  return cachedData;
}

module.exports = (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  if (req.method === "OPTIONS") { res.status(200).end(); return; }

  (async () => {
    try {
      const data = await loadData();

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
        // Search by name or amfi_code
        if (s) {
          const code = String(r.amfi_code || "").toLowerCase();
          const name = String(r.name || "").toLowerCase();
          if (!code.includes(s) && !name.includes(s)) return false;
        }

        // Plan filter: plan_type is "regular" or "direct" (lowercase)
        if (plan !== "All") {
          const pt = String(r.plan_type || "").toLowerCase();
          if (pt !== plan.toLowerCase()) return false;
        }

        // Option filter: option_type is "growth" or "dividend" / "idcw" (lowercase)
        if (option !== "All") {
          const ot = String(r.option_type || "").toLowerCase();
          const optLower = option.toLowerCase();
          if (optLower === "dividend / idcw") {
            if (ot !== "dividend" && ot !== "idcw") return false;
          } else {
            if (ot !== optLower) return false;
          }
        }

        // AMC filter: amc_name field
        if (amc !== "All") {
          if (String(r.amc_name || "") !== amc) return false;
        }

        // Category filter: category field
        if (category !== "All") {
          if (String(r.category || "") !== category) return false;
        }

        // Risk filter: risk_label field
        if (risk !== "All") {
          if (String(r.risk_label || "") !== risk) return false;
        }

        // NAV range
        if (minNav !== undefined && minNav !== "") {
          const nav = parseFloat(r.nav);
          if (isNaN(nav) || nav < parseFloat(minNav)) return false;
        }
        if (maxNav !== undefined && maxNav !== "") {
          const nav = parseFloat(r.nav);
          if (isNaN(nav) || nav > parseFloat(maxNav)) return false;
        }

        // AUM filter
        if (minAum !== undefined && minAum !== "") {
          const aum = parseFloat(r.aum);
          if (isNaN(aum) || aum < parseFloat(minAum)) return false;
        }

        // Expense ratio filter
        if (maxExp !== undefined && maxExp !== "") {
          const exp = parseFloat(r.expense_ratio);
          if (isNaN(exp) || exp > parseFloat(maxExp)) return false;
        }

        return true;
      });

      // Pagination
      const pg = Math.max(1, parseInt(page));
      const sz = Math.max(1, parseInt(pageSize));
      const start = (pg - 1) * sz;
      const total = rows.length;
      const paged = rows.slice(start, start + sz);

      res.json({
        rows: paged,
        total,
        page: pg,
        pageSize: sz,
        totalPages: Math.ceil(total / sz)
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Failed to load schemes", message: err.message });
    }
  })();
};
