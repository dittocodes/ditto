
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { mentorBase } from '@/paths';
import { Button } from '@/components/ui/button';
import { Calendar, Video, Users } from 'lucide-react';
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { useWeeklySchedule } from '@/services/dashboardService';
import SkeletonCard from '@/components/ui/skeleton-card';

const WeeklySchedule = () => {
  const navigate = useNavigate();
  const base = mentorBase();
  const [selectedDay, setSelectedDay] = useState('Thu');
  const { data: scheduledMeetings = [], isLoading, error } = useWeeklySchedule();
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  
  if (isLoading) {
    return <SkeletonCard height="h-full" />;
  }
  
  if (error) {
    return (
      <Card className="h-full bg-card  border-0 shadow-sm">
        <CardHeader className="border-b">
          <h3 className="text-lg font-medium">Weekly Schedule</h3>
        </CardHeader>
        <CardContent className="flex items-center justify-center p-6">
          <div className="text-center text-muted-foreground">
            <p>Failed to load schedule data</p>
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
    <Card className="bg-card rounded-lg border-0 shadow-sm overflow-hidden h-full">
      <CardHeader className="border-b p-4">
        <h3 className="text-lg font-medium">Weekly Schedule</h3>
      </CardHeader>
      
      <div className="flex border-b">
        {weekDays.map(day => (
          <Button variant="ghost" size="sm" onClick={() => setSelectedDay(day)}
            key={day}
            className={`flex-1 py-2 text-center font-medium cursor-pointer ${
              day === selectedDay 
                ? 'bg-primary text-primary-foreground' 
                : 'hover:bg-muted/50'
            }`}
          >
            {day}
          </Button>
        ))}
      </div>
      
      <CardContent className="p-0 divide-y">
        {!scheduledMeetings.some(m => m.day === selectedDay) && <p className="p-6 text-sm text-muted-foreground">No meetings on {selectedDay}.</p>}
        {scheduledMeetings.filter(m => m.day === selectedDay).map(meeting => (
          <div key={meeting.id} className="p-4">
            <div className="flex justify-between items-start">
              <div className="flex">
                <div className="mr-3 text-muted-foreground mt-1">
                  <div className="text-xs font-medium">{meeting.day}</div>
                  <div className="text-sm">{meeting.time}</div>
                </div>
                
                <div>
                  <h4 className="font-medium">{meeting.title}</h4>
                  <div className="flex items-center mt-1 text-xs text-muted-foreground">
                    {meeting.type === 'Video Call' ? (
                      <Video className="h-3 w-3 mr-1" />
                    ) : (
                      <Users className="h-3 w-3 mr-1" />
                    )}
                    <span>{meeting.type} • {meeting.attendees} attendees</span>
                  </div>
                </div>
              </div>
              
              <Button size="sm" variant="outline" onClick={() => navigate(`${base}/meetings`)}>Details</Button>
            </div>
          </div>
        ))}
      </CardContent>
      
      <CardFooter className="p-4 text-center border-t">
        <Button variant="outline" className="text-sm" onClick={() => navigate(`${base}/meetings`)}>View Full Calendar</Button>
      </CardFooter>
    </Card>
  );
};

export default WeeklySchedule;
