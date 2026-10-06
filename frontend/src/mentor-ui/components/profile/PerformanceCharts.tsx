
import React from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface PerformanceChartsProps {
  data: {
    monthlySessions: number[];
    monthlyProgress: number[];
    months: string[];
  };
}

const PerformanceCharts: React.FC<PerformanceChartsProps> = ({ data }) => {
  // Combine the data arrays into an array of objects for Recharts
  const chartData = data.months.map((month, index) => ({
    month,
    sessions: data.monthlySessions[index],
    progress: data.monthlyProgress[index],
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div>
        <h3 className="text-lg font-medium mb-3">Monthly Sessions</h3>
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="sessions" fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      <div>
        <h3 className="text-lg font-medium mb-3">Average Mentee Progress</h3>
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Line type="monotone" dataKey="progress" stroke="hsl(var(--success))" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default PerformanceCharts;
