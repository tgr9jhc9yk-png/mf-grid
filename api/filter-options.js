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
    
    // Extract unique values
    const amcSet = new Set();
    const categorySet = new Set();
    
    data.forEach(row => {
      if (row.amc) amcSet.add(row.amc);
      if (row.category) categorySet.add(row.category);
    });
    
    const amcs = Array.from(amcSet).sort();
    const categories = Array.from(categorySet).sort();
    
    res.status(200).json({ amcs, categories });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
