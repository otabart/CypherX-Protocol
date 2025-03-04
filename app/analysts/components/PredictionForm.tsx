"use client";

import { useState } from "react";

export default function PredictionForm() {
  const [formData, setFormData] = useState({
    coin: "",
    coinAddress: "",
    prediction: "Bullish",
    targetPrice: "",
    timeframe: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const response = await fetch("/api/predictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    if (response.ok) {
      alert("Prediction submitted!");
      setFormData({ coin: "", coinAddress: "", prediction: "Bullish", targetPrice: "", timeframe: "" });
    } else {
      alert("Error submitting prediction.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-bold">Submit a Prediction</h2>
      
      <input
        type="text"
        name="coin"
        placeholder="Coin Name (e.g., PEPE)"
        value={formData.coin}
        onChange={handleChange}
        required
        className="w-full p-2 border rounded"
      />

      <input
        type="text"
        name="coinAddress"
        placeholder="Coin Address"
        value={formData.coinAddress}
        onChange={handleChange}
        required
        className="w-full p-2 border rounded"
      />

      <select name="prediction" value={formData.prediction} onChange={handleChange} className="w-full p-2 border rounded">
        <option value="Bullish">Bullish</option>
        <option value="Bearish">Bearish</option>
        <option value="Neutral">Neutral</option>
      </select>

      <input
        type="text"
        name="targetPrice"
        placeholder="Target Price (e.g., 0.01)"
        value={formData.targetPrice}
        onChange={handleChange}
        className="w-full p-2 border rounded"
      />

      <input
        type="text"
        name="timeframe"
        placeholder="Timeframe (e.g., 1 week)"
        value={formData.timeframe}
        onChange={handleChange}
        className="w-full p-2 border rounded"
      />

      <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
        Submit Prediction
      </button>
    </form>
  );
}
