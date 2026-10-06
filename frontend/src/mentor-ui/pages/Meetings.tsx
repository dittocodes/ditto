import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calendar, Clock, Users, MapPin, Search, FileText, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMeetingStats, useUpcomingMeetings, useMeetingHistory } from '@/services/meetingsService';
import UpcomingMeetingsList from '@/components/meetings/UpcomingMeetingsList';
import MeetingHistoryList from '@/components/meetings/MeetingHistoryList';
import MeetingStatsCard from '@/components/meetings/MeetingStatsCard';
import ScheduleMeetingDialog from '@/components/meetings/ScheduleMeetingDialog';
import { exportSpreadsheet } from '@/lib/exportSpreadsheet';
import MeetingDetailsDialog from '@/components/meetings/MeetingDetailsDialog';

const MeetingsPage = () => {
  // URL params to manage active tab
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'upcoming';
  
  // State for dialogs
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [search, setSearch] = useState('');
  useEffect(() => {
    if (searchParams.get('action') === 'new') setScheduleDialogOpen(true);
  }, [searchParams]);
  const changeScheduleDialog = (open: boolean) => {
    setScheduleDialogOpen(open);
    if (!open) { const next = new URLSearchParams(searchParams); next.delete('action'); setSearchParams(next, { replace: true }); }
  };
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState<number | null>(null);

  // Fetch meeting data
  const { data: stats, isLoading: statsLoading } = useMeetingStats();
  const { data: upcomingMeetings = [] } = useUpcomingMeetings();
  const { data: meetingHistory = [] } = useMeetingHistory();
  
  const matches = (meeting: typeof upcomingMeetings[number]) =>
    [meeting.title, meeting.location, ...meeting.attendees].join(' ').toLowerCase().includes(search.toLowerCase());
  const filteredUpcoming = upcomingMeetings.filter(matches);
  const filteredHistory = meetingHistory.filter(matches);
  // Handlers
  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };
  
  const handleScheduleOpen = () => {
    setScheduleDialogOpen(true);
  };
  
  const handleViewDetails = (id: number) => {
    setSelectedMeetingId(id);
    setDetailsDialogOpen(true);
  };
  
  // Find selected meeting for details dialog
  const selectedMeeting = selectedMeetingId 
    ? [...upcomingMeetings, ...meetingHistory].find(m => m.id === selectedMeetingId)
    : null;
  
  
  
  return (
    <div className="mx-auto max-w-[1600px] py-2">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Meetings Management</h1>
          <p className="text-muted-foreground mt-1">Live meetings · refreshes every 15 seconds</p>
        </div>
        
        <Button 
          onClick={handleScheduleOpen} 
          className="mt-4 md:mt-0 bg-warning/100 hover:bg-warning gap-2 px-4"
        >
          <Plus size={16} />
          Schedule New Meeting
        </Button>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <MeetingStatsCard
          title="Total Meetings"
          value={stats?.totalMeetings || 0}
          subtitle="Stored sessions"
          icon={<Calendar className="text-primary" />}
          iconBgColor="bg-primary/10"
          isLoading={statsLoading}
        />
        
        <MeetingStatsCard
          title="Upcoming"
          value={stats?.upcomingMeetings || 0}
          subtitle="Scheduled sessions"
          additionalInfo={stats?.nextMeeting ? `Next: ${stats.nextMeeting.day} at ${stats.nextMeeting.time}` : ""}
          additionalInfoColor="text-primary0"
          icon={<Clock className="text-warning" />}
          iconBgColor="bg-warning/10"
          isLoading={statsLoading}
        />
        
        <MeetingStatsCard
          title="Attendance Rate"
          value={stats?.attendanceRate == null ? '—' : `${stats.attendanceRate}%`}
          subtitle="Last 30 days"
          icon={<Users className="text-success" />}
          iconBgColor="bg-success/10"
          isLoading={statsLoading}
        />
        
        <MeetingStatsCard
          title="Avg. Duration"
          value={stats?.avgDuration == null ? '—' : `${stats.avgDuration} min`}
          subtitle="Meetings with a stored duration"
          additionalInfo={`Most common: ${stats?.mostCommonDuration || '—'}`}
          additionalInfoColor="text-primary0"
          icon={<Clock className="text-primary" />}
          iconBgColor="bg-primary/10"
          isLoading={statsLoading}
        />
      </div>
      
      {/* Tabs for Upcoming/History */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="border-b w-full justify-start bg-transparent p-0 mb-6">
          <TabsTrigger 
            value="upcoming" 
            className="data-[state=active]:border-b-2 data-[state=active]:border-warning0 data-[state=active]:text-foreground data-[state=active]:shadow-none rounded-none border-b-2 border-transparent px-4 py-2 text-muted-foreground"
          >
            Upcoming Meetings
          </TabsTrigger>
          <TabsTrigger 
            value="history" 
            className="data-[state=active]:border-b-2 data-[state=active]:border-warning0 data-[state=active]:text-foreground data-[state=active]:shadow-none rounded-none border-b-2 border-transparent px-4 py-2 text-muted-foreground"
          >
            Meeting History
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="upcoming" className="mt-0">
          <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between">
            <div className="max-w-sm mb-4 md:mb-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
                <Input 
                  placeholder="Search meetings..." value={search} onChange={e => setSearch(e.target.value)} 
                  className="pl-10 w-full py-2 border-input focus:border-primary0 focus:ring-primary0"
                />
              </div>
            </div>
          </div>
          
          <UpcomingMeetingsList 
            meetings={filteredUpcoming} 
            onViewDetails={handleViewDetails} 
          />
        </TabsContent>
        
        <TabsContent value="history" className="mt-0">
          <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between">
            <div className="max-w-sm mb-4 md:mb-0">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={18} />
                <Input 
                  placeholder="Search meetings..." value={search} onChange={e => setSearch(e.target.value)} 
                  className="pl-10 w-full py-2 border-input focus:border-primary0 focus:ring-primary0"
                />
              </div>
            </div>
            <Button variant="outline" className="flex items-center gap-1.5" onClick={() => exportSpreadsheet("BIOGRED-meeting-history", filteredHistory.map(m => ({ ...m, attendees: m.attendees.join(", ") })))}>
              <FileText size={16} />
              Export Report
            </Button>
          </div>
          
          <MeetingHistoryList 
            meetings={filteredHistory} 
            onViewDetails={handleViewDetails} 
          />
        </TabsContent>
      </Tabs>
      
      {/* Dialogs */}
      <ScheduleMeetingDialog 
        open={scheduleDialogOpen} 
        onOpenChange={changeScheduleDialog}
      />
      
      <MeetingDetailsDialog 
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
        meeting={selectedMeeting ?? null}
      />
    </div>
  );
};

export default MeetingsPage;
