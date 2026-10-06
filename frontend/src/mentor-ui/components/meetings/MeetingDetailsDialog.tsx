
import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, MapPin, User, Video, FileText, Check, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { MeetingData, useUpdateMeetingStatus } from '@/services/meetingsService';

interface Meeting {
  id: number;
  meetingId: string;
  title: string;
  date: string;
  time: string;
  duration: string;
  mentee: {
    name: string;
    avatar?: string;
  };
  location: string;
  locationType: 'virtual' | 'in-person';
  status: 'scheduled' | 'completed' | 'cancelled';
  agenda?: string;
  notes?: string;
  attendance?: boolean;
}

// Create a utility function to convert from MeetingData to Meeting type
const convertToMeetingType = (data: MeetingData | null): Meeting | null => {
  if (!data) return null;
  
  return {
    id: data.id,
    meetingId: data.meetingId,
    title: data.title,
    date: data.date,
    time: data.time,
    duration: typeof data.duration === 'number' ? `${data.duration} minutes` : data.duration,
    mentee: {
      name: data.attendees.join(", ")
    },
    location: data.location,
    locationType: data.isVirtual ? 'virtual' : 'in-person',
    status: data.status === 'completed' ? 'completed' : 
            data.status === 'cancelled' ? 'cancelled' : 'scheduled',
    agenda: data.agenda,
    notes: data.notes,
    attendance: data.attended
  };
};

interface MeetingDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meeting: MeetingData | null;
}

const MeetingDetailsDialog: React.FC<MeetingDetailsDialogProps> = ({
  open,
  onOpenChange,
  meeting: meetingData
}) => {
  const update = useUpdateMeetingStatus();
  const [rescheduling, setRescheduling] = useState(false);
  const [newDateTime, setNewDateTime] = useState('');
  // Convert MeetingData to Meeting
  const meeting = convertToMeetingType(meetingData);
  
  if (!meeting) return null;
  
  const isUpcoming = meeting.status === 'scheduled';
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">{meeting.title}</DialogTitle>
          <div className="flex items-center gap-2 mt-2">
            {meeting.status === 'scheduled' && (
              <Badge className="bg-primary/100 hover:bg-primary">Upcoming</Badge>
            )}
            {meeting.status === 'completed' && (
              <Badge className="bg-success/100 hover:bg-success">Completed</Badge>
            )}
            {meeting.status === 'cancelled' && (
              <Badge className="bg-destructive/100 hover:bg-destructive">Cancelled</Badge>
            )}
          </div>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="flex items-center gap-3">
            <Calendar className="text-muted-foreground" size={20} />
            <div>
              <p className="text-sm font-medium">Date & Time</p>
              <p className="text-sm text-muted-foreground">{meeting.date} at {meeting.time} ({meeting.duration})</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <User className="text-muted-foreground" size={20} />
            <div>
              <p className="text-sm font-medium">Mentee</p>
              <p className="text-sm text-muted-foreground">{meeting.mentee.name}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {meeting.locationType === 'virtual' ? (
              <Video className="text-muted-foreground" size={20} />
            ) : (
              <MapPin className="text-muted-foreground" size={20} />
            )}
            <div>
              <p className="text-sm font-medium">Location</p>
              <p className="text-sm text-muted-foreground">{meeting.location}</p>
            </div>
          </div>
          
          {meeting.agenda && (
            <div className="flex items-start gap-3 mt-2">
              <FileText className="text-muted-foreground" size={20} />
              <div>
                <p className="text-sm font-medium">Agenda</p>
                <p className="text-sm text-muted-foreground">{meeting.agenda}</p>
              </div>
            </div>
          )}
          
          {!isUpcoming && meeting.attendance !== undefined && (
            <div className="flex items-center gap-3 mt-2">
              {meeting.attendance ? (
                <Check className="text-success0" size={20} />
              ) : (
                <X className="text-destructive0" size={20} />
              )}
              <div>
                <p className="text-sm font-medium">Attendance</p>
                <p className="text-sm text-muted-foreground">
                  {meeting.attendance ? "Attended" : "Did not attend"}
                </p>
              </div>
            </div>
          )}
          
          {!isUpcoming && meeting.notes && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-medium mb-2">Meeting Notes</p>
                <p className="text-sm text-muted-foreground">{meeting.notes}</p>
              </div>
            </>
          )}
        </div>
        
        {rescheduling && isUpcoming && <div className="grid gap-3 mb-4">
          <label className="grid gap-2 text-sm">New Date & Time<Input type="datetime-local" value={newDateTime} onChange={e => setNewDateTime(e.target.value)} /></label>
          <Button disabled={!newDateTime || update.isPending} onClick={() => update.mutate({ meetingId: meeting.meetingId, status: 'rescheduled', dateTime: newDateTime }, { onSuccess: () => { setRescheduling(false); onOpenChange(false); } })}>Save New Time</Button>
        </div>}
        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          {isUpcoming && (
            <>
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => setRescheduling(true)}>
                Reschedule
              </Button>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full sm:w-auto">
                    Cancel Meeting
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancel Meeting?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This cancels the meeting for the mentee.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Go Back</AlertDialogCancel>
                    <AlertDialogAction onClick={() => update.mutate({ meetingId: meeting.meetingId, status: 'cancelled' }, { onSuccess: () => onOpenChange(false) })}>
                      Yes, Cancel Meeting
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
          
          {!isUpcoming && (
            <Button className="bg-primary/100 hover:bg-primary w-full sm:w-auto" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MeetingDetailsDialog;
