import { Button } from '@/components/ui/button';

import React from 'react';
import { TrendingUp, Award, Clock, Users } from 'lucide-react';
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { useInsightsData } from '@/services/dashboardService';
import SkeletonCard from '@/components/ui/skeleton-card';

const InsightsGrid = () => {
  const { data, isLoading, error } = useInsightsData();
  
  if (isLoading) {
    return <SkeletonCard height="h-[400px]" />;
  }
  
  if (error || !data) {
    return (
      <Card className="h-full w-full bg-card  border-0 shadow-sm">
        <CardHeader className="border-b ">
          <h3 className="text-lg font-medium">Mentorship Insights</h3>
        </CardHeader>
        <CardContent className="pt-6 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <p>Failed to load insights data</p>
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
    <Card className="bg-card  border-0 shadow-sm">
      <CardHeader className="border-b ">
        <h3 className="text-lg font-medium">Mentorship Insights</h3>
      </CardHeader>
      
      <CardContent className="p-4">
        <div className="grid grid-cols-2 gap-4">
          <InsightCard 
            title="Mentee Progress" 
            value={data.skillGrowth}
            description="Average across the cohort"
            icon={<TrendingUp className="h-5 w-5" />}
          />
          
          <InsightCard 
            title="Best Performance" 
            value={data.bestPerformance}
            description="Largest activity category"
            icon={<Award className="h-5 w-5" />}
          />
          
          <InsightCard 
            title="Avg. Duration" 
            value={data.avgDuration}
            description="Per mentorship session"
            icon={<Clock className="h-5 w-5" />}
          />
          
          <InsightCard 
            title="Active Mentees" 
            value={data.mentorRelationships}
            description="Current cohort"
            icon={<Users className="h-5 w-5" />}
          />
        </div>
      </CardContent>
    </Card>
  );
};

interface InsightCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ReactNode;
}

const InsightCard = ({ title, value, description, icon }: InsightCardProps) => {
  return (
    <div className="py-3 min-w-0">
      <div className="flex items-center space-x-2 mb-2">
        <div className="text-primary bg-primary/10 p-1.5 rounded-full">{icon}</div>
        <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
      </div>
      
      <div className="text-xl font-bold text-foreground break-words">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{description}</div>
    </div>
  );
};

export default InsightsGrid;
