const https = require('https');
const fs = require("fs");
const path = require("path");

let cachedData = null;
let cacheTimestamp = null;
const CACHE_DURATION = 48 * 60 * 60 * 1000; // 48 hours in milliseconds

// Fetch data from mfdata.in API using https module
function fetchFromAPI() {
  return new Promise((resolve, reject) => {
    https.get('https://api.mfapi.in/mf', (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (err) {
          reject(new Error('Failed to parse JSON: ' + err.message));
        }
      });
    }).on('error', (err) => {
      reject(new Error('API request failed: ' + err.message));
    });
  });
}

// Load data with caching
async function loadData() {
  const now = Date.now();
  
  // Return cached data if still valid
  if (cachedData && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedData;
  }
  
  // Fetch fresh data from API
  const data = await fetchFromAPI();
  
  // Update cache
  cachedData = data;
  cacheTimestamp = now;
  
  return cachedData;
}

module.exports = (req, res) => {
  // CORS headers for local dev
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
        if (s) {
          const code = String(r.schemeCode || "").toLowerCase();
          const name = String(r.schemeName || "").toLowerCase();
          if (!code.includes(s) && !name.includes(s)) return false;
        }
        
        // Extract plan, option, amc from schemeName
        const schemeName = String(r.schemeName || "");
        
        // Plan filtering (Growth/Dividend/IDCW)
        if (plan !== "All") {
          const planLower = plan.toLowerCase();
          const nameLower = schemeName.toLowerCase();
          if (planLower === "growth" && !nameLower.includes("growth")) return false;
          if (planLower === "dividend" && !nameLower.includes("dividend") && !nameLower.includes("idcw")) return false;
          if (planLower === "idcw" && !nameLower.includes("idcw")) return false;
        }
        
        // Option filtering (Direct/Regular)
        if (option !== "All") {
          const optionLower = option.toLowerCase();
          const nameLower = schemeName.toLowerCase();
          if (optionLower === "direct" && !nameLower.includes("direct")) return false;
          if (optionLower === "regular" && nameLower.includes("direct")) return false;
        }
        
        // AMC filtering (extract from scheme name - first few words)
        if (amc !== "All") {
          const nameLower = schemeName.toLowerCase();
          const amcLower = amc.toLowerCase();
          if (!nameLower.includes(amcLower)) return false;
        }
        
        // Category filtering
        if (category !== "All") {
          const nameLower = schemeName.toLowerCase();
          const catLower = category.toLowerCase();
          // Common categories
          if (catLower.includes("equity") && !nameLower.includes("equity")) return false;
          if (catLower.includes("debt") && !nameLower.includes("debt") && !nameLower.includes("bond")) return false;
          if (catLower.includes("hybrid") && !nameLower.includes("hybrid")) return false;
          if (catLower.includes("liquid") && !nameLower.includes("liquid")) return false;
        }
        
        return true;
      });

      // Pagination
      const pg = Math.max(1, parseInt(page));
      const sz = Math.max(1, parseInt(pageSize));
      const start = (pg - 1) * sz;
      const end = start + sz;

      const total = rows.length;
      const paged = rows.slice(start, end);

      res.json({
        data: paged,
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
