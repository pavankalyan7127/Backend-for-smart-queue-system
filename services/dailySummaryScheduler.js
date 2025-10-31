// backend/services/dailySummaryScheduler.js
import DailySummary from "../models/DailySummary.js";
import Reading from "../models/Reading.js";

export function startDailySummaryScheduler() {
  console.log("⏰ Daily summary scheduler started — runs every hour");

  // Run every 1 hour
  setInterval(async () => {
    try {
      await computeDailySummaryForYesterday();
    } catch (err) {
      console.error("❌ Error computing daily summary:", err.message);
    }
  }, 1000 * 60 * 60); // 1 hour

  // Optional: run once immediately on startup (for testing)
  // computeDailySummaryForYesterday();
}

async function computeDailySummaryForYesterday() {
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const start = new Date(yesterday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(yesterday);
  end.setHours(23, 59, 59, 999);

  const year = start.getFullYear();
  const month = String(start.getMonth() + 1).padStart(2, "0");
  const day = String(start.getDate()).padStart(2, "0");
  const dateStr = `${year}-${month}-${day}`;

  console.log("🕐 Running daily summary computation (for)", dateStr);

  const exists = await DailySummary.findOne({ date: dateStr });
  if (exists) {
    console.log("✅ Summary already exists for", dateStr, "→ skipping.");
    return;
  }

  const rows = await Reading.find({ timestamp: { $gte: start, $lte: end } }).lean();
  console.log("Total readings fetched:", rows.length);

  if (!rows.length) {
    console.log("⚠️ No readings found for", dateStr, "— skipping summary.");
    return;
  }

  const avg = rows.reduce((s, r) => s + r.count, 0) / rows.length;
  const peak = Math.max(...rows.map((r) => r.count));
  const offPeak = Math.min(...rows.map((r) => r.count));

  await DailySummary.create({ date: dateStr, average: avg, peak, offPeak });
  console.log("✅ Daily summary created for", dateStr, { avg, peak, offPeak });
}
