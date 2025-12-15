import { FC } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface UsageData {
  month: string;
  confirmed: number;
}

interface WeeksUsageChartProps {
  data: UsageData[];
}

const WeeksUsageChart: FC<WeeksUsageChartProps> = ({ data }) => (
  <div className="w-full h-64 bg-white rounded-lg shadow p-4">
    <h3 className="text-md font-bold mb-2">Semanas confirmadas por mes</h3>
    <ResponsiveContainer width="100%" height="90%">
      <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="confirmed" fill="#2563eb" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  </div>
);

export default WeeksUsageChart;
