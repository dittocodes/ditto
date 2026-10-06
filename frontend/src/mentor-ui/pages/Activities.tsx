import React, { useState, useEffect } from 'react';
import { Download, Plus, Filter, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Table, 
  TableHeader, 
  TableRow, 
  TableHead, 
  TableBody, 
  TableCell 
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { 
  Select, 
  SelectTrigger, 
  SelectValue, 
  SelectContent, 
  SelectItem 
} from '@/components/ui/select';
import { 
  Pagination, 
  PaginationContent, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from '@/components/ui/pagination';
import { useActivitiesData, useActivityRequests, useDecideRequest } from '@/services/activitiesService';
import { useSearchParams } from 'react-router-dom';
import ActivityDialog from '@/components/activities/ActivityDialog';
import type { Activity } from '@/services/activitiesService';
import { exportSpreadsheet } from '@/lib/exportSpreadsheet';

const Activities = () => {
  const [params, setParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selected, setSelected] = useState<Activity>();
  const [page, setPage] = useState(1);
  useEffect(() => {
    if (params.get('action') === 'new') { setSelected(undefined); setDialogOpen(true); }
  }, [params]);
  const changeDialog = (open: boolean) => {
    setDialogOpen(open);
    if (!open) { const next = new URLSearchParams(params); next.delete('action'); setParams(next, { replace: true }); }
  };
  const [searchQuery, setSearchQuery] = useState(params.get('search') ?? '');
  const [termFilter, setTermFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const { data: activities = [], isLoading } = useActivitiesData();
  const requests = useActivityRequests();
  const decide = useDecideRequest();
  const pendingRequests = requests.data || [];
  
  const filteredActivities = activities.filter(activity => {
    if (termFilter !== 'all' && activity.termType.toLowerCase() !== termFilter.toLowerCase()) return false;
    
    if (statusFilter !== 'all' && activity.status.toLowerCase() !== statusFilter.toLowerCase()) return false;
    
    if (searchQuery) {
      const searchFields = [
        activity.id,
        activity.usn,
        activity.studentName,
        activity.title
      ].map(field => field.toLowerCase());
      
      return searchFields.some(field => field.includes(searchQuery.toLowerCase()));
    }
    
    return true;
  });

  useEffect(() => { setPage(1); }, [searchQuery, termFilter, statusFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredActivities.length / 10));
  const currentPage = Math.min(page, pageCount);
  const visibleActivities = filteredActivities.slice((currentPage - 1) * 10, currentPage * 10);
  const renderTermBadge = (termType: string) => {
    switch(termType) {
      case 'Short Term':
        return (
          <span className="inline-flex items-center rounded-full px-4 py-1.5 text-xs font-medium bg-term-short text-term-short-foreground">
            Short Term
          </span>
        );
      case 'Mid Term':
        return (
          <span className="inline-flex items-center rounded-full px-4 py-1.5 text-xs font-medium bg-term-mid text-term-mid-foreground">
            Mid Term
          </span>
        );
      case 'Long Term':
        return (
          <span className="inline-flex items-center rounded-full px-4 py-1.5 text-xs font-medium bg-term-long text-term-long-foreground">
            Long Term
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="max-w-full">
      <div className="flex flex-wrap gap-4 items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-foreground">Activity Tracking</h1><p className="text-xs text-muted-foreground mt-1">Live activities · refreshes every 15 seconds</p></div>
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            className="flex items-center gap-2 border-input bg-card text-foreground"
            onClick={() => exportSpreadsheet("BIOGRED-activities", filteredActivities.map(a => ({ ...a })))}
          >
            <Download size={18} />
            Export Excel
          </Button>
          <Button 
            className="flex items-center gap-2 bg-primary hover:bg-primary/90"
            onClick={() => { setSelected(undefined); setDialogOpen(true); }}
          >
            <Plus size={18} />
            New Activity
          </Button>
        </div>
      </div>

      <section className="mb-6 rounded-lg border bg-card p-4 shadow-sm">
        <h2 className="text-base font-semibold">Student requests</h2>
        <p className="mb-3 text-sm text-muted-foreground">Approve a request to add it to that student's activities.</p>
        {!pendingRequests.length && <p className="text-sm text-muted-foreground">No requests waiting.</p>}
        <ul className="space-y-3">
          {pendingRequests.map((request) => (
            <li key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2">
              <div>
                <div className="font-medium">{request.title}</div>
                <div className="text-xs text-muted-foreground">{request.student_name} · {request.usn}{request.description ? ` · ${request.description}` : ''}</div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="bg-primary" disabled={decide.isPending} onClick={() => decide.mutate({ id: request.id, decision: 'approve', term: request.term || 'short-term' })}>Approve</Button>
                <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => decide.mutate({ id: request.id, decision: 'reject' })}>Decline</Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap items-center space-y-3 md:space-y-0 md:space-x-4 mb-6">
        <div className="relative w-full md:w-auto md:flex-1">
          <Input
            placeholder="Search by ID, USN, name or activity..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 border-input"
          />
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            <Search size={16} />
          </div>
        </div>
        
        <div className="w-full md:w-auto flex items-center">
          <Filter size={16} className="mr-2 text-muted-foreground" />
          <Select value={termFilter} onValueChange={setTermFilter}>
            <SelectTrigger className="w-[160px] border-input bg-card">
              <SelectValue placeholder="All Terms" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Terms</SelectItem>
              <SelectItem value="Short Term">Short Term</SelectItem>
              <SelectItem value="Mid Term">Mid Term</SelectItem>
              <SelectItem value="Long Term">Long Term</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="w-full md:w-auto">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] border-input bg-card">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem><SelectItem value="overdue">Overdue</SelectItem><SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-hidden border border-border rounded-lg bg-card shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-primary">
              <TableRow className="hover:bg-primary">
                <TableHead className="font-medium text-primary-foreground">Activity ID</TableHead>
                <TableHead className="font-medium text-primary-foreground">USN</TableHead>
                <TableHead className="font-medium text-primary-foreground">Name</TableHead>
                <TableHead className="font-medium text-primary-foreground">Activity</TableHead>
                <TableHead className="font-medium text-primary-foreground">
                  <div className="whitespace-nowrap">Term Type</div>
                </TableHead>
                <TableHead className="font-medium text-primary-foreground">Deadline</TableHead>
                <TableHead className="font-medium text-primary-foreground">Remarks</TableHead>
                <TableHead className="font-medium text-primary-foreground text-center">CmpDays</TableHead>
                <TableHead className="font-medium text-primary-foreground text-center">Benefitted</TableHead>
                <TableHead className="font-medium text-primary-foreground">Proof</TableHead>
                <TableHead className="font-medium text-primary-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={11} className="h-24 text-center">
                    Loading activities...
                  </TableCell>
                </TableRow>
              ) : filteredActivities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="h-24 text-center">
                    No activities found
                  </TableCell>
                </TableRow>
              ) : (
                visibleActivities.map((activity) => (
                  <TableRow key={activity.id} className="border-b hover:bg-muted/50">
                    <TableCell className="font-medium">{activity.id}</TableCell>
                    <TableCell>{activity.usn}</TableCell>
                    <TableCell>{activity.studentName}</TableCell>
                    <TableCell className="max-w-[250px] truncate" title={activity.title}>
                      {activity.title}
                    </TableCell>
                    <TableCell>
                      {renderTermBadge(activity.termType)}
                    </TableCell>
                    <TableCell>{activity.deadline}</TableCell>
                    <TableCell className="max-w-[150px] truncate" title={activity.remarks ?? undefined}>
                      {activity.remarks || 'N/A'}
                    </TableCell>
                    <TableCell className="text-center">{activity.completionDays ?? 'N/A'}</TableCell>
                    <TableCell className="text-center">
                      {activity.benefitted ? 
                        <span className="text-success">Yes</span> : 
                        <span className="text-muted-foreground">No</span>}
                    </TableCell>
                    <TableCell>
                      {activity.proof === 'Submitted' ? 
                        <span className="text-success">Submitted</span> : 
                        activity.proof === 'Partial' ?
                        <span className="text-warning0">Partial</span> :
                        <span className="text-muted-foreground">N/A</span>}
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="default" 
                        size="sm" 
                        onClick={() => { setSelected(activity); setDialogOpen(true); }} className="bg-primary text-primary-foreground"
                      >
                        Update
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        <div className="flex items-center justify-between px-4 py-4 border-t">
          <div className="text-sm text-muted-foreground">
            Showing {visibleActivities.length} of {filteredActivities.length} matching activities
          </div>
          <div className="flex gap-2 items-center">
            <Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</Button>
            <span className="text-sm">{currentPage} / {pageCount}</span>
            <Button size="sm" variant="outline" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next</Button>
          </div>
        </div>
      </div>
      <ActivityDialog key={selected?.id ?? `new-${dialogOpen}`} activity={selected} open={dialogOpen} onOpenChange={changeDialog} />
    </div>
  );
};

export default Activities;
