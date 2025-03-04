import mongoose, { Schema, Document, models } from "mongoose";

export interface IAnalyst extends Document {
  name: string;
  bio?: string;
  avatar?: string;
  verified: boolean;
  totalPicks: number;
  successfulPicks: number;
  winRate: number;
}

const AnalystSchema = new Schema<IAnalyst>(
  {
    name: { type: String, required: true },
    bio: { type: String },
    avatar: { type: String, default: "/default-avatar.png" },
    verified: { type: Boolean, default: false },
    totalPicks: { type: Number, default: 0 },
    successfulPicks: { type: Number, default: 0 },
    winRate: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default models.Analyst || mongoose.model<IAnalyst>("Analyst", AnalystSchema);

