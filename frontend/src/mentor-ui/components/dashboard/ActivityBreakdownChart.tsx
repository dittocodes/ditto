import { Button } from '@/components/ui/button';

import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Sector } from 'recharts';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { useActivityBreakdown } from '@/services/dashboardService';
import SkeletonCard from '@/components/ui/skeleton-card';

const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  
  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 6}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    </g>
  );
};

const ActivityBreakdownChart = () => {
  const { data, isLoading, error } = useActivityBreakdown();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  
  if (isLoading) {
    return <SkeletonCard height="h-[400px]" />;
  }
  
  if (error || !data) {
    return (
      <Card className="h-full w-full bg-card  border-0 shadow-sm">
        <CardHeader className="border-b ">
          <h3 className="text-lg font-medium">Activity Breakdown</h3>
        </CardHeader>
        <CardContent className="pt-6 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <p>Failed to load chart data</p>
            <Button variant="ghost" 
              onClick={() => window.location.reload()}
              className="mt-2 text-sm text-primary hover:text-primary"
            >
              Try again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };
  
  const onPieLeave = () => {
    setActiveIndex(null);
  };

  // Calculate total for percentage
  const total = data.reduce((sum, entry) => sum + entry.value, 0);
  
  // Format the data to include percentage
  const formattedData = data.map(item => ({
    ...item,
    percentage: ((item.value / total) * 100).toFixed(1)
  }));
  
  return (
    <Card className="h-full w-full bg-card  border-0 shadow-sm hover:shadow-sm transition-all duration-300">
      <CardHeader className="border-b ">
        <h3 className="text-lg font-medium">Activity Breakdown</h3>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={formattedData}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={2}
                dataKey="value"
                isAnimationActive={false}
                onMouseEnter={onPieEnter}
                onMouseLeave={onPieLeave}
                activeIndex={activeIndex !== null ? activeIndex : undefined}
                activeShape={renderActiveShape}
              >
                {formattedData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.color} 
                    stroke="hsl(var(--card))" 
                    strokeWidth={2}
                    opacity={activeIndex === null || activeIndex === index ? 1 : 0.6}
                  />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--popover))', 
                  borderRadius: '8px', 
                  boxShadow: 'none', 
                  border: 'none' 
                }}
                formatter={(value: number, name: string, props: any) => {
                  return [`${value} (${props.payload.percentage}%)`];
                }}
                labelFormatter={(label) => `${label}`}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* Activity breakdown legend with color squares */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-3 px-2 justify-center">
          {formattedData.map((item, index) => (
            <div key={index} className="flex items-center text-sm">
              <div 
                className="w-3 h-3 mr-1.5 rounded-sm" 
                style={{ backgroundColor: item.color }}
              />
              <span className="text-foreground">{item.name}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ActivityBreakdownChart;
