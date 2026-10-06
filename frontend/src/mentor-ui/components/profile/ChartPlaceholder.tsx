import React from 'react';
import { BarChart3 } from 'lucide-react';

interface ChartPlaceholderProps {
  title: string;
  type?: 'bar' | 'pie' | 'line';
  height?: string;
}

const ChartPlaceholder: React.FC<ChartPlaceholderProps> = ({ title, type = 'bar', height = 'h-64' }) => {
  return (
    <div className={`${height} w-full bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center p-6 text-gray-400`}>
      <BarChart3 size={48} className="mb-4 opacity-20" />
      <p className="text-sm font-medium text-center">{title} Visualization</p>
      <p className="text-xs text-center mt-1">Real-time data processing...</p>
      
      <div className="mt-6 flex gap-1 items-end h-20 w-full justify-center">
        {[40, 70, 45, 90, 65, 80, 55].map((h, i) => (
          <div 
            key={i} 
            className="w-4 bg-primary/20 rounded-t-sm animate-pulse" 
            style={{ height: `${h}%`, animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>
    </div>
  );
};

export default ChartPlaceholder;
