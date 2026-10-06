
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { mentorBase } from '@/paths';
import { Calendar, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { useMeetings } from '@/services/dashboardService';
import SkeletonCard from '@/components/ui/skeleton-card';

const MeetingList = () => {
  const navigate = useNavigate();
  const base = mentorBase();
  const { data: meetings = [], isLoading, error } = useMeetings();
  
  if (isLoading) {
    return <SkeletonCard height="h-full" />;
  }
  
  if (error) {
    return (
      <Card className="h-full bg-card  border-0 shadow-sm">
        <CardHeader className="border-b ">
          <h3 className="text-lg font-medium">Upcoming Meetings</h3>
        </CardHeader>
        <CardContent className="flex items-center justify-center p-6">
          <div className="text-center text-muted-foreground">
            <p>Failed to load meetings data</p>
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
    <Card className="h-full overflow-hidden  bg-card border-0 shadow-sm">
      <CardHeader className="border-b  ">
        <h3 className="text-lg font-medium">Upcoming Meetings</h3>
        <p className="text-sm text-muted-foreground">Your scheduled mentorship sessions</p>
      </CardHeader>
      
      <CardContent className="p-0">
        {meetings.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <p>No upcoming meetings</p>
          </div>
        ) : (
          <div className="divide-y">
            {meetings.map((meeting) => (
              <div key={meeting.id} className="p-4 hover:bg-muted/50 transition-colors duration-200">
                <div className="flex items-start">
                  <div className="mr-4 bg-primary/10 p-2 rounded-full">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  
                  <div className="flex-1">
                    <h4 className="font-medium">{meeting.title}</h4>
                    <div className="flex items-center mt-1 text-sm text-muted-foreground">
                      <span>{meeting.day}, {meeting.date}, {meeting.time}</span>
                    </div>
                    
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center">
                        <Avatar className="h-6 w-6 mr-2 ring-2 ring-primary/20">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">{meeting.attendee.substring(0, 2)}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{meeting.attendee}</span>
                      </div>
                      
                      <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                        meeting.status === 'confirmed' 
                          ? 'bg-primary text-primary-foreground' 
                          : 'bg-muted text-foreground'
                      } shadow-sm`}>
                        {meeting.status === 'confirmed' ? 'Confirmed' : 'Awaiting'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
        
      <CardFooter className="border-t bg-muted/50 flex justify-center p-3">
        <Button onClick={() => navigate(`${base}/meetings`)} variant="outline" size="sm" className="text-sm w-full max-w-xs bg-card hover:bg-primary hover:text-primary-foreground transition-colors duration-200">
          View All Meetings
        </Button>
      </CardFooter>
    </Card>
  );
};

export default MeetingList;
