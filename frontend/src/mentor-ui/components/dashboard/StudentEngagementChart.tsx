import { Button } from '@/components/ui/button';

import React from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { useEngagementData } from '@/services/dashboardService';
import SkeletonCard from '@/components/ui/skeleton-card';

const StudentEngagementChart = () => {
  const { data, isLoading, error } = useEngagementData();
  
  if (isLoading) {
    return <SkeletonCard height="h-[350px]" />;
  }
  
  if (error) {
    return (
      <Card className="h-full w-full bg-card  border-0 shadow-sm">
        <CardHeader className="border-b ">
          <h3 className="text-lg font-medium">Student Engagement</h3>
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
  
  return (
    <Card className="h-full w-full bg-card  border-0 shadow-sm">
      <CardHeader className="border-b ">
        <h3 className="text-lg font-medium text-foreground">Student Engagement</h3>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 10, right: 5, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorEngagement" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--warning))" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="hsl(var(--warning))" stopOpacity={0.1}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'hsl(var(--muted-foreground))' }} 
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'hsl(var(--muted-foreground))' }} 
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--popover))', 
                  borderRadius: '8px', 
                  boxShadow: 'none', 
                  border: 'none' 
                }}
              />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke="hsl(var(--warning))" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorEngagement)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default StudentEngagementChart;
