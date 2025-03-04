// app/components/CandlestickChart.tsx
"use client";

type CandlestickChartProps = {
  data?: any[]; // Fake data is not used for now.
  width?: number;
  height?: number;
};

export function CandlestickChart({
  data,
  width = 150,
  height = 100,
}: CandlestickChartProps) {
  return (
    <div style={{ width, height }} className="relative bg-black">
      {/* Blurred fake chart background */}
      <div
        className="absolute inset-0"
        style={{ filter: "blur(8px)" }}
      >
        <svg width={width} height={height} className="w-full h-full">
          {/* Fake candlestick elements using Coinbase blue (#0A84FF) */}
          <rect x="10" y="20" width="10" height="40" fill="#0A84FF" opacity="0.7" />
          <rect x="30" y="10" width="10" height="60" fill="#0A84FF" opacity="0.7" />
          <rect x="50" y="30" width="10" height="30" fill="#0A84FF" opacity="0.7" />
          <rect x="70" y="5" width="10" height="70" fill="#0A84FF" opacity="0.7" />
          <rect x="90" y="25" width="10" height="40" fill="#0A84FF" opacity="0.7" />
        </svg>
      </div>
      {/* Overlay pop-up message */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="p-4 bg-blue-600 bg-opacity-90 rounded text-white text-center">
          <h2 className="text-xl font-bold mb-2">Coming Soon!</h2>
          <p className="text-sm">Token Chart support will be added in v2.</p>
        </div>
      </div>
    </div>
  );
}

