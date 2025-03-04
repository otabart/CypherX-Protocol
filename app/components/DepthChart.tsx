// components/DepthChart.tsx
import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function DepthChart({ orderBookData }: { orderBookData: any[] }) {
  // orderBookData: an array with order book snapshots or live data
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={orderBookData}>
        <XAxis dataKey="price" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="cumulativeVolume" stroke="#0060FF" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}
