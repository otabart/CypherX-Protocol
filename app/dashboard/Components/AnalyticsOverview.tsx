'use client';

import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function AnalyticsOverview() {
  const chartData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Transaction Volume',
        data: [500, 1000, 1500, 2000, 2500, 3000],
        borderColor: '#0052FF',
        backgroundColor: 'rgba(0, 82, 255, 0.3)',
        fill: true,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
    },
  };

  return (
    <div className="p-6 border rounded-lg shadow-md bg-gray-50">
      <h2 className="text-2xl font-bold text-primaryBlue mb-4">Analytics Overview</h2>
      <Line data={chartData} options={chartOptions} />
    </div>
  );
}
