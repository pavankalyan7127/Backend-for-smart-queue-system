// backend/routes/api.js
import express from "express";
import Reading from "../models/Reading.js";
import DailySummary from "../models/DailySummary.js";
import { classifyCount, predictNextLinear } from "../utils/ml.js";
import { callOpenRouter } from "../services/openrouter.js";

const router = express.Router();
import dotenv from "dotenv";
dotenv.config();

// ✅ ESP32 Data Receiver — ESP will send count data here
router.post("/data", async (req, res) => {
  try {
    const { count } = req.body;

    if (typeof count !== "number") {
      return res.status(400).json({ ok: false, msg: "Invalid count value" });
    }

    const doc = await Reading.create({ count, timestamp: new Date() });
    const category = classifyCount(count);

    console.log("📡 Received ESP data:", count, "→ category:", category);

    res.json({ ok: true, savedId: doc._id, category });
  } catch (err) {
    console.error("❌ Error saving reading from ESP:", err.message);
    res.status(500).json({ ok: false, msg: "Server error" });
  }
});

// GET latest reading
router.get("/latest", async (req, res) => {
  const latest = await Reading.findOne().sort({ timestamp: -1 }).lean();
  if (!latest) return res.json({ ok: true, data: null });
  console.log(latest);
  return res.json({ ok: true, data: latest });
});

// GET /history?limit=100
router.get("/history", async (req, res) => {
  const limit = parseInt(req.query.limit || "100", 10);
  const docs = await Reading.find().sort({ timestamp: -1 }).limit(limit).lean();
  res.json({ ok: true, data: docs.reverse() });
});

// GET /predict?points=10
router.get("/predict", async (req, res) => {
  const points = parseInt(req.query.points || "10", 10);
  const rows = await Reading.find().sort({ timestamp: -1 }).limit(points).lean();
  const data = rows.reverse();
  const pred = predictNextLinear(data);
  res.json({ ok: true, predicted: pred, usedPoints: data.length });
});

// GET /classify?count=8  OR classify the latest if no count provided
router.get("/classify", async (req, res) => {
  const q = req.query;
  let count = q.count ? Number(q.count) : null;
  if (count == null) {
    const latest = await Reading.findOne().sort({ timestamp: -1 }).lean();
    if (!latest) return res.json({ ok: false, msg: "No readings yet" });
    count = latest.count;
  }
  const cat = classifyCount(count);
  res.json({ ok: true, count, category: cat });
});

// GET /daily-summary?date=YYYY-MM-DD
router.get("/daily-summary", async (req, res) => {
  let date = req.query.date;

  if (!date) {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    date = `${year}-${month}-${day}`;
  }

  console.log("Final date:", date);
  const summary = await DailySummary.findOne({ date }).lean();
  console.log(summary);
  res.json({ ok: true, date, summary });
});

// GET /best-times?days=7
router.get("/best-times", async (req, res) => {
  const days = parseInt(req.query.days || "7", 10);
  const now = new Date();
  const past = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
  const rows = await Reading.find({ timestamp: { $gte: past } }).lean();

  if (!rows || rows.length === 0) return res.json({ ok: true, slots: [] });

  const slotMap = {};
  rows.forEach((r) => {
    const dt = new Date(r.timestamp);
    const hour = dt.getHours();
    const minute = dt.getMinutes();
    const slotStartMin = minute < 30 ? 0 : 30;
    const key = `${hour.toString().padStart(2, "0")}:${slotStartMin.toString().padStart(2, "0")}`;
    if (!slotMap[key]) slotMap[key] = { total: 0, count: 0 };
    slotMap[key].total += r.count;
    slotMap[key].count += 1;
  });

  const slots = Object.keys(slotMap).map((k) => {
    const avg = slotMap[k].total / slotMap[k].count;
    const [h, m] = k.split(":").map(Number);
    const period = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    const formatted = `${hour12}:${m.toString().padStart(2, "0")} ${period}`;
    return { slot: formatted, avg: Number(avg.toFixed(2)) };
  });

  slots.sort((a, b) => a.avg - b.avg);
  res.json({ ok: true, slots: slots.slice(0, 5) });
});

// POST /ai/explain-classify
router.post("/ai/explain-classify", async (req, res) => {
  const { count, category } = req.body;
  if (count == null || !category)
    return res.status(400).json({ ok: false, msg: "count & category required" });

  try {
    const prompt = [
      { role: "system", content: "You are a helpful assistant that explains why a crowd count falls into a specific category (Low/Moderate/High) in simple terms for students." },
      { role: "user", content: `A mess queue has ${count} people and was categorized as "${category}". Explain to a student, in simple and short language, why this count falls under "${category}" and what it means for visiting the mess now.` }
    ];
    const ai = await callOpenRouter(process.env.OPENROUTER_API_KEY, process.env.OPENROUTER_MODEL, prompt, 500);
    const text = ai.choices?.[0]?.message?.content || JSON.stringify(ai);
    res.json({ ok: true, text });
  } catch (err) {
    console.error("AI error:", err);
    res.status(500).json({ ok: false, msg: err.message });
  }
});

// POST /ai/explain-predict
router.post("/ai/explain-predict", async (req, res) => {
  const { predicted, recent } = req.body;
  try {
    const prompt = [
      { role: "system", content: "You are an assistant that explains how a forecast is made in simple terms." },
      { role: "user", content: `Given recent counts ${JSON.stringify(recent.map(r => r.count))}, the model predicted next count: ${predicted}. Explain in short words how this prediction was made and what assumptions were used.` }
    ];
    const ai = await callOpenRouter(process.env.OPENROUTER_API_KEY, process.env.OPENROUTER_MODEL, prompt, 500);
    const text = ai.choices?.[0]?.message?.content || JSON.stringify(ai);
    res.json({ ok: true, text });
  } catch (err) {
    console.error("AI error:", err);
    res.status(500).json({ ok: false, msg: err.message });
  }
});

// POST /chat
router.post("/chat", async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ ok: false, msg: "message required" });

  try {
    const latest = await Reading.findOne().sort({ timestamp: -1 }).lean();
    const recent = await Reading.find().sort({ timestamp: -1 }).limit(10).lean();
    const context = latest ? `Latest count: ${latest.count} at ${latest.timestamp}` : "No readings yet";

    const prompt = [
      { role: "system", content: `You are QueueAssistant for a college mess. Use context and provide concise, action-oriented help.` },
      { role: "user", content: `Context: ${context}. Recent counts: ${JSON.stringify(recent.map(r => ({ t: r.timestamp, count: r.count })))}` },
      { role: "user", content: `User asks: ${message}` }
    ];

    const ai = await callOpenRouter(process.env.OPENROUTER_API_KEY, process.env.OPENROUTER_MODEL, prompt, 1000);
    const text = ai.choices?.[0]?.message?.content || JSON.stringify(ai);
    res.json({ ok: true, text });
  } catch (err) {
    console.error("Chat AI error:", err);
    res.status(500).json({ ok: false, msg: err.message });
  }
});

export default router;
