
import React, { ReactNode } from 'react';
import { Card } from "@/components/ui/card";
import SkeletonCard from '@/components/ui/skeleton-card';

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: ReactNode;
  trend?: {
    value: number;
    label: string;
    positive?: boolean;
  };
  iconBgColor?: string;
  iconColor?: string;
  isLoading?: boolean;
}

const StatCard = ({ 
  title, 
  value, 
  description, 
  icon, 
  trend,
  iconBgColor = "bg-primary/10",
  iconColor = "text-primary",
  isLoading = false
}: StatCardProps) => {
  if (isLoading) {
    return <SkeletonCard height="h-full" />;
  }
  
  return (
    <Card className="h-full border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex justify-between items-center mb-1">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <div className={`${iconBgColor} ${iconColor} rounded-md p-2.5`}>{icon}</div>
      </div>
      
      <div className="mb-2 text-3xl font-bold text-foreground">{value}</div>
      
      {description && (
        <div className="text-sm text-muted-foreground">{description}</div>
      )}
      
      {trend && (
        <div className={`mt-2 flex items-center text-sm ${trend.positive ? 'text-success' : 'text-destructive'}`}>
          <span className="font-medium mr-1">
            {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
          <span className="text-muted-foreground">{trend.label}</span>
        </div>
      )}
    </Card>
  );
};

export default StatCard;
