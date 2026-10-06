
import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';

// Sample data - in a real application, this would come from an API
const data = [
  { name: 'Jan', shortTerm: 4, midTerm: 3, longTerm: 1 },
  { name: 'Feb', shortTerm: 3, midTerm: 2, longTerm: 2 },
  { name: 'Mar', shortTerm: 5, midTerm: 3, longTerm: 1 },
  { name: 'Apr', shortTerm: 2, midTerm: 4, longTerm: 2 },
  { name: 'May', shortTerm: 6, midTerm: 2, longTerm: 1 },
  { name: 'Jun', shortTerm: 4, midTerm: 3, longTerm: 3 },
];

const PerformanceChart = () => {
  return (
    <div className="h-full w-full p-4 bg-white rounded-lg border shadow-sm">
      <h3 className="text-lg font-medium mb-6">Performance Analysis</h3>
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="shortTerm" name="Short Term" fill="#FF5722" />
            <Bar dataKey="midTerm" name="Medium Term" fill="#FFEB3B" />
            <Bar dataKey="longTerm" name="Long Term" fill="#2196F3" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default PerformanceChart;
