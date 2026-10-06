
import React from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { MeetingData } from '@/services/meetingsService';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface UpcomingMeetingsListProps {
  meetings: MeetingData[];
  onViewDetails: (id: number) => void;
}

const UpcomingMeetingsList: React.FC<UpcomingMeetingsListProps> = ({ meetings, onViewDetails }) => {
  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="bg-muted/50 px-6 py-4 border-b">
        <h2 className="text-xl font-semibold text-foreground">Upcoming Meetings</h2>
        <p className="text-muted-foreground text-sm">All scheduled upcoming mentorship meetings</p>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[250px]">Title</TableHead>
              <TableHead className="w-[180px]">Date & Time</TableHead>
              <TableHead className="w-[120px]">Duration</TableHead>
              <TableHead className="w-[120px]">Attendees</TableHead>
              <TableHead className="w-[180px]">Location</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[80px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {meetings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  No upcoming meetings found
                </TableCell>
              </TableRow>
            ) : (
              meetings.map((meeting) => (
                <TableRow key={meeting.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{meeting.title}</TableCell>
                  <TableCell>{meeting.date} - {meeting.time}</TableCell>
                  <TableCell>{meeting.duration}</TableCell>
                  <TableCell>{meeting.attendeeCount || meeting.attendees.length} student(s)</TableCell>
                  <TableCell>
                    <div className="flex items-center">
                      {meeting.isVirtual ? '🖥️ Virtual' : meeting.location}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      meeting.status === 'confirmed' ? 'bg-success/10 text-success' : 
                      meeting.status === 'pending' ? 'bg-warning/10 text-warning' : 
                      meeting.status === 'rescheduled' ? 'bg-warning/10 text-warning' :
                      'bg-muted text-foreground'
                    }`}>
                      {meeting.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" className="h-8 w-8 p-0" aria-label="View Details" title="View Details" onClick={() => onViewDetails(meeting.id)}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default UpcomingMeetingsList;
