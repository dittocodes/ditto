
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, FileText, Calendar, MessageCircle, Filter, BookOpen, ChevronRight } from 'lucide-react';
import { ActivityType } from '@/types/profile';

interface ActivityTimelineProps {
  activities: ActivityType[];
}

const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ activities }) => {
  // Function to get the right icon based on activity type
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'group':
        return <Users size={20} className="text-blue-500" />;
      case 'document':
        return <FileText size={20} className="text-green-500" />;
      case 'one-on-one':
        return <MessageCircle size={20} className="text-purple-500" />;
      case 'publication':
        return <BookOpen size={20} className="text-orange-500" />;
      default:
        return <Calendar size={20} className="text-gray-500" />;
    }
  };

  // Function to get the badge variant based on activity type
  const getBadgeVariant = (type: string) => {
    switch (type) {
      case 'group':
        return "bg-blue-50 text-blue-700 border-blue-200";
      case 'document':
        return "bg-green-50 text-green-700 border-green-200";
      case 'one-on-one':
        return "bg-purple-50 text-purple-700 border-purple-200";
      case 'publication':
        return "bg-orange-50 text-orange-700 border-orange-200";
      default:
        return "bg-gray-50 text-gray-700 border-gray-200";
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Activity Timeline</h2>
        <Button variant="outline" className="gap-1">
          <Filter size={16} /> Filter
        </Button>
      </div>
      
      <div className="space-y-4">
        {activities.map((activity) => (
          <Card key={activity.id} className="overflow-hidden">
            <CardContent className="p-0">
              <div className="flex flex-col md:flex-row">
                <div className="flex items-center justify-center p-6 bg-gray-50 md:w-48">
                  <div className="text-center">
                    {getActivityIcon(activity.type)}
                    <p className="font-medium mt-2">{activity.date}</p>
                    <Badge variant="outline" className={`mt-2 ${getBadgeVariant(activity.type)}`}>
                      {activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}
                    </Badge>
                  </div>
                </div>
                
                <div className="flex-grow p-6">
                  <h3 className="font-medium text-lg">{activity.title}</h3>
                  <p className="text-gray-600 mt-1">{activity.description}</p>
                  
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-2">
                    {Object.entries(activity.details).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="text-gray-500 capitalize">{key}:</span>
                        <span className="font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="p-6 flex items-center">
                  <Button variant="ghost" size="sm" className="rounded-full h-8 w-8 p-0">
                    <ChevronRight size={20} />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ActivityTimeline;
