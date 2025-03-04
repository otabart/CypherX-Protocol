import mongoose, { Schema, Document, models } from "mongoose";

export interface IPrediction extends Document {
  coin: string;
  coinAddress: string;
  prediction: "Bullish" | "Bearish" | "Neutral";
  targetPrice: string;
  timeframe: string;
  analyst: Schema.Types.ObjectId;
  entryPrice: number;
  createdAt: Date;
}

const PredictionSchema = new Schema<IPrediction>(
  {
    coin: { type: String, required: true },
    coinAddress: { type: String, required: true },
    prediction: { type: String, enum: ["Bullish", "Bearish", "Neutral"], required: true },
    targetPrice: { type: String },
    timeframe: { type: String },
    analyst: { type: Schema.Types.ObjectId, ref: "Analyst", required: true },
    entryPrice: { type: Number, required: true },
  },
  { timestamps: true }
);

export default models.Prediction || mongoose.model<IPrediction>("Prediction", PredictionSchema);

