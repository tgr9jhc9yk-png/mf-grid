const CACHE_DURATION = 48 * 60 * 60 * 1000; // 48 hours

let cachedData = null;
let cacheTimestamp = null;

async function loadData() {
  const now = Date.now();
  if (cachedData && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedData;
  }
  const url = 'https://mfdata.in/api/v1/schemes';
  const response = await fetch(url);
  if (!response.ok) throw new Error(`API returned ${response.status}`);
  const result = await response.json();
  // mfdata.in returns { data: [...] }
  cachedData = Array.isArray(result) ? result : (result.data || []);
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

      const amcSet = new Set();
      const categorySet = new Set();

      data.forEach(row => {
        // amc_name is the correct field from mfdata.in
        if (row.amc_name) amcSet.add(row.amc_name);
        if (row.category) categorySet.add(row.category);
      });

      const amcs = Array.from(amcSet).sort();
      const categories = Array.from(categorySet).sort();

      res.status(200).json({ amcs, categories });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  })();
};
