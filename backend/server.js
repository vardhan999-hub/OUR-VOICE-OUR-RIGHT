// server.js (full file) - copy/replace your current server.js with this
import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 6001;
const API_KEY = "579b464db66ec23bdd000001d10b1b3eb59d41e046d0c2f3e0b50518";
const BASE_URL = "https://api.data.gov.in/resource/ee03643a-ee4c-48c2-ac30-9f2ff26ab722";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache

// simple in-memory cache
let summaryCache = {
  ts: 0,
  summary: null
};

// helper: fetch raw records (with limit)
async function fetchAllRecords() {
  const url = `${BASE_URL}?api-key=${API_KEY}&format=json&limit=1000`;
  const res = await axios.get(url);
  return res.data.records || [];
}

// create summary per district
async function buildDistrictSummary() {
  const now = Date.now();
  if (summaryCache.summary && (now - summaryCache.ts) < CACHE_TTL_MS) {
    return summaryCache.summary;
  }

  const records = await fetchAllRecords();

  // aggregate per district
  const map = new Map();
  for (const r of records) {
    const d = (r.district_name || "").toUpperCase();
    if (!d) continue;
    if (!map.has(d)) {
      map.set(d, {
        district: d,
        count: 0,
        sum_avg_wage: 0,   // we'll average later
        total_exp: 0,
        total_emp_days: 0,
        total_women_persondays: 0
      });
    }
    const entry = map.get(d);
    entry.count += 1;
    entry.sum_avg_wage += parseFloat(r.Average_Wage_rate_per_day_per_person || 0);
    entry.total_exp += parseFloat(r.Total_Exp || 0);
    entry.total_emp_days += Number(r.Average_days_of_employment_provided_per_Household || 0);
    entry.total_women_persondays += Number(r.Women_Persondays || 0);
  }

  const summary = Array.from(map.values()).map((e) => {
    const avg_wage = e.count ? (e.sum_avg_wage / e.count) : 0;
    const women_percent = e.total_emp_days ? (e.total_women_persondays / e.total_emp_days) * 100 : 0;
    return {
      district: e.district,
      avg_wage: Number(avg_wage.toFixed(2)),
      total_exp: Number(e.total_exp.toFixed(2)), // units as in dataset
      total_emp_days: Number(e.total_emp_days),
      women_persondays: Number(e.total_women_persondays),
      women_percent: Number(women_percent.toFixed(1)),
      samples: e.count
    };
  });

  // cache it
  summaryCache = { ts: now, summary };
  return summary;
}

// existing endpoint to list districts (keeps working)
app.get("/api/districts", async (req, res) => {
  try {
    const recs = await fetchAllRecords();
    const names = [...new Set(recs.map(r => r.district_name).filter(Boolean))].sort();
    res.json({ districts: names });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load districts" });
  }
});

// existing endpoint for single district
app.get("/api/district/:name", async (req, res) => {
  try {
    const name = req.params.name;
    const recs = await fetchAllRecords();
    const filtered = recs.filter(r => (r.district_name || "").toLowerCase() === name.toLowerCase());
    if (filtered.length === 0) return res.status(404).json({ message: "No data found for this district." });
    res.json(filtered);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching data" });
  }
});

// NEW: comparison endpoint
app.get("/api/compare", async (req, res) => {
  try {
    const summary = await buildDistrictSummary();
    // optional: support query param ?top=10 to return top N by avg_wage
    const { top, sortby } = req.query;
    let out = summary;

    // allow sortby=avg_wage|total_exp|women_percent|total_emp_days
    if (sortby) {
      out = out.sort((a,b) => b[sortby] - a[sortby]);
    }
    if (top) {
      const n = Math.min(100, parseInt(top, 10) || 10);
      out = out.slice(0, n);
    }
    res.json(out);
  } catch (err) {
    console.error("compare error:", err);
    res.status(500).json({ message: "Failed to compute comparison" });
  }
});

app.listen(PORT, () => console.log(`✅ Backend running on http://localhost:${PORT}`));
