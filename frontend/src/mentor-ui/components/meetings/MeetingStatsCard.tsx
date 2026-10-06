
import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from "@/components/ui/skeleton";

interface TrendData {
  value: number;
  label: string;
  positive: boolean;
}

interface MeetingStatsCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon?: React.ReactNode;
  iconBgColor?: string;
  trend?: TrendData;
  additionalInfo?: string;
  additionalInfoColor?: string;
  isLoading?: boolean;
}

const MeetingStatsCard: React.FC<MeetingStatsCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  iconBgColor = "bg-blue-100",
  trend,
  additionalInfo,
  additionalInfoColor = "text-blue-500",
  isLoading = false
}) => {
  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-6 w-1/2 mb-3" />
        <Skeleton className="h-10 w-20 mb-2" />
        <Skeleton className="h-4 w-3/4" />
      </Card>
    );
  }
  
  return (
    <Card className="p-6 border border-gray-200 overflow-hidden relative">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-medium text-gray-500">{title}</h3>
          <p className="text-4xl font-bold text-gray-900 my-1">{value}</p>
          <p className="text-sm text-gray-500">{subtitle}</p>
          
          {trend && (
            <div className="flex items-center mt-3">
              {trend.positive ? (
                <TrendingUp className="text-green-500 h-4 w-4 mr-1" />
              ) : (
                <TrendingDown className="text-red-500 h-4 w-4 mr-1" />
              )}
              <span className={trend.positive ? "text-green-500 text-xs" : "text-red-500 text-xs"}>
                {trend.value}% {trend.label}
              </span>
            </div>
          )}
          
          {additionalInfo && (
            <div className="mt-2">
              <span className={`text-sm ${additionalInfoColor}`}>{additionalInfo}</span>
            </div>
          )}
        </div>
        
        {icon && (
          <div className={`${iconBgColor} p-3 rounded-full`}>
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
};

export default MeetingStatsCard;
