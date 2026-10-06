
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { mentorBase } from '@/paths';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { useActivities } from '@/services/dashboardService';
import SkeletonCard from '@/components/ui/skeleton-card';
import { useState } from 'react';

const ActivityList = () => {
  const navigate = useNavigate();
  const base = mentorBase();
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  const { data: activities = [], isLoading, error } = useActivities(activeTab);
  
  if (isLoading) {
    return <SkeletonCard height="h-full" />;
  }
  
  if (error) {
    return (
      <Card className="h-full bg-card  border-0 shadow-sm">
        <CardHeader className="border-b ">
          <h3 className="text-lg font-medium">Activities Tracker</h3>
        </CardHeader>
        <CardContent className="flex items-center justify-center p-6">
          <div className="text-center text-muted-foreground">
            <p>Failed to load activities data</p>
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
  
  // Helper function to render term badge with updated colors
  const renderTermBadge = (type: string) => {
    switch(type) {
      case 'short-term':
        return (
          <span className="px-4 py-1.5 text-xs font-medium rounded-full bg-term-short text-term-short-foreground">
            Short Term
          </span>
        );
      case 'medium-term':
        return (
          <span className="px-4 py-1.5 text-xs font-medium rounded-full bg-term-mid text-term-mid-foreground">
            Mid Term
          </span>
        );
      case 'long-term':
        return (
          <span className="px-4 py-1.5 text-xs font-medium rounded-full bg-term-long text-term-long-foreground">
            Long Term
          </span>
        );
      default:
        return null;
    }
  };
  
  return (
    <Card className="h-full overflow-hidden  bg-card border-0 shadow-sm">
      <CardHeader className="border-b  ">
        <h3 className="text-lg font-medium">Activities Tracker</h3>
      </CardHeader>
      
      <CardContent className="p-4">
        <div className="flex border-b mb-4">
          <div 
            className={`flex-1 cursor-pointer pb-2 text-center ${
              activeTab === 'pending' 
                ? 'border-b-2 border-primary font-medium' 
                : 'text-muted-foreground hover:text-foreground'
            } transition-colors duration-200`}
            onClick={() => setActiveTab('pending')}
          >
            Open
          </div>
          <div 
            className={`flex-1 cursor-pointer pb-2 text-center ${
              activeTab === 'completed' 
                ? 'border-b-2 border-primary font-medium' 
                : 'text-muted-foreground hover:text-foreground'
            } transition-colors duration-200`}
            onClick={() => setActiveTab('completed')}
          >
            Completed
          </div>
        </div>
        
        {activities.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <p>No {activeTab} activities found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div key={activity.id} className="py-4 border-b last:border-0">
                <div className="flex flex-wrap gap-2 justify-between mb-2">
                  <div className="flex items-start">
                    <div className={`${
                      activity.status === 'completed' ? 'bg-success/10' : 'bg-destructive/10'
                    } p-2 rounded-full mr-3`}>
                      <FileText className={`h-5 w-5 ${
                        activity.status === 'completed' ? 'text-success0' : 'text-destructive0'
                      }`} />
                    </div>
                    <div>
                      <h4 className="font-medium">{activity.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{activity.category}</p>
                      <div className="text-xs text-muted-foreground mt-1">Due: {activity.dueDate}</div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end">
                    {renderTermBadge(activity.type)}
                    <Button 
                      variant="ghost" 
                      onClick={() => navigate(`${base}/activities?search=${encodeURIComponent(activity.title)}`)}
                      size="sm" 
                      className="text-sm mt-2 hover:bg-primary/10 text-primary hover:text-primary"
                    >
                      View Details
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
        
      <CardFooter className="border-t bg-muted/50 flex justify-center p-3">
        <Button onClick={() => navigate(`${base}/activities`)} variant="outline" size="sm" className="text-sm w-full max-w-xs bg-card hover:bg-primary hover:text-primary-foreground transition-colors duration-200">
          View All Activities
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ActivityList;
