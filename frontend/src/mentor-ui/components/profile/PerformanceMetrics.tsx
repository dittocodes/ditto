
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { PerformanceMetricsType } from '@/types/profile';

interface PerformanceMetricsProps {
  metrics: PerformanceMetricsType;
}

const PerformanceMetrics: React.FC<PerformanceMetricsProps> = ({ metrics }) => {
  const performanceData = [
    metrics.responseKnown ? { label: "Response Rate", value: metrics.responseRate, color: "bg-blue-500" } : null,
    metrics.sessionKnown ? { label: "Sessions Held", value: metrics.sessionCompletionRate, color: "bg-green-500" } : null,
    metrics.progressKnown ? { label: "Mentee Progress Rate", value: metrics.menteeProgressRate, color: "bg-purple-500" } : null,
    metrics.attendanceRate != null ? { label: "Attendance, last 30 days", value: metrics.attendanceRate, color: "bg-yellow-500" } : null,
  ].filter((item): item is { label: string; value: number; color: string } => item !== null);
  
  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="text-xl font-bold mb-4">Performance Metrics</h2>
        <div className="space-y-4">
          {performanceData.length === 0 && <p className="text-sm text-muted-foreground">No measured metrics yet.</p>}
          {performanceData.map((item, index) => (
            <div key={index}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium">{item.label}</span>
                <span className="text-sm">{`${item.value}%`}</span>
              </div>
              <Progress value={item.value} indicatorClassName={item.color} className="h-2" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default PerformanceMetrics;
