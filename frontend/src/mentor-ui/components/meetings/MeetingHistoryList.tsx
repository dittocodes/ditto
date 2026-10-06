
import React from 'react';
import { MoreHorizontal, ExternalLink, FileText } from 'lucide-react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { MeetingData } from '@/services/meetingsService';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface MeetingHistoryListProps {
  meetings: MeetingData[];
  onViewDetails: (id: number) => void;
}

const MeetingHistoryList: React.FC<MeetingHistoryListProps> = ({ meetings, onViewDetails }) => {
  // Function to truncate long text with ellipsis
  const truncateText = (text: string = '', maxLength: number = 75) => {
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text;
  };
  
  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="bg-muted/50 px-6 py-4 border-b">
        <h2 className="text-xl font-semibold text-foreground">Meeting History</h2>
        <p className="text-muted-foreground text-sm">Past mentorship meetings with notes and outcomes</p>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[250px]">Title</TableHead>
              <TableHead className="w-[180px]">Date & Time</TableHead>
              <TableHead className="w-[180px]">Attendees</TableHead>
              <TableHead className="w-[100px]">Status</TableHead>
              <TableHead className="w-[300px]">Notes</TableHead>
              <TableHead className="w-[80px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {meetings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  No meeting history found
                </TableCell>
              </TableRow>
            ) : (
              meetings.map((meeting) => (
                <TableRow key={meeting.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">{meeting.title}</TableCell>
                  <TableCell>{meeting.date} - {meeting.time}</TableCell>
                  <TableCell>{meeting.attendees.join(', ')}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      meeting.status === 'completed' ? 'bg-success/10 text-success' : 
                      meeting.status === 'rescheduled' ? 'bg-warning/10 text-warning' : 
                      'bg-muted text-foreground'
                    }`}>
                      {meeting.status}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <p className="truncate">{truncateText(meeting.notes)}</p>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="bg-card">
                        <DropdownMenuItem onClick={() => onViewDetails(meeting.id)} className="cursor-pointer">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          <span>View Details</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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

export default MeetingHistoryList;
