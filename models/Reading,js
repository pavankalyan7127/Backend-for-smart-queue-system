// backend/models/Reading.js
import mongoose from "mongoose";

const ReadingSchema = new mongoose.Schema({
  count: { type: Number, required: true },
  timestamp: { type: Date, required: true, default: () => new Date() }
});

export default mongoose.model("Reading", ReadingSchema);
