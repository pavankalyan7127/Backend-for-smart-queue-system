// backend/models/DailySummary.js
import mongoose from "mongoose";

const DailySummarySchema = new mongoose.Schema({
  date: { type: String, required: true }, // YYYY-MM-DD
  average: Number,
  peak: Number,
  offPeak: Number,
  createdAt: { type: Date, default: () => new Date() }
});

export default mongoose.model("DailySummary", DailySummarySchema);
    
