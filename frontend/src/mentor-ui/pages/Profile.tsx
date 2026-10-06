
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Calendar, Clock, User, Award, BookOpen, BarChart3, 
  FileText, MessageCircle, Share2, Download, Edit, Mail, 
  Phone, MapPin, Building
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import profileService from '@/services/profileService';
import ProfileHeader from '@/components/profile/ProfileHeader';
import AvailabilitySchedule from '@/components/profile/AvailabilitySchedule';
import MenteesList from '@/components/profile/MenteesList';
import ActivityTimeline from '@/components/profile/ActivityTimeline';
import PerformanceMetrics from '@/components/profile/PerformanceMetrics';
import PerformanceVisuals from '@/components/profile/PerformanceVisuals';
import PerformanceCharts from '@/components/profile/PerformanceCharts';
import EducationBackground from '@/components/profile/EducationBackground';
import MenteeSummary from '@/components/profile/MenteeSummary';
import PublicationsSection from '@/components/profile/PublicationsSection';
import MentorDocuments from '@/components/profile/MentorDocuments';
import { ProfileType } from '@/types/profile';

const Profile = () => {
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get('tab') ?? 'overview';
  const activeTab = ['overview', 'performance', 'activityLog', 'mentees', 'schedule', 'documents'].includes(requestedTab) ? requestedTab : 'overview';
  const setActiveTab = (tab: string) => setParams({ tab });
  
  const { data: profileData, isLoading } = useQuery<ProfileType>({
    queryKey: ['profileData'],
    queryFn: profileService.getProfileData,
    refetchInterval: 15000,
  });
  
  if (isLoading || !profileData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="loader">Loading...</div>
      </div>
    );
  }
  
  return (
    <div className="mx-auto max-w-[1600px] pb-12">
      <ProfileHeader profile={profileData} />
      
      <div className="mt-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="border-b w-full justify-start bg-card px-0 mb-6 overflow-x-auto h-auto flex-nowrap">
            <TabsTrigger 
              value="overview" 
              className={`px-3 sm:px-6 py-3 text-sm font-medium shrink-0 ${activeTab === 'overview' ? 'border-b-2 border-primary' : ''}`}
            >
              Overview
            </TabsTrigger>
            <TabsTrigger 
              value="performance" 
              className={`px-3 sm:px-6 py-3 text-sm font-medium shrink-0 ${activeTab === 'performance' ? 'border-b-2 border-primary' : ''}`}
            >
              Performance
            </TabsTrigger>
            <TabsTrigger 
              value="activityLog" 
              className={`px-3 sm:px-6 py-3 text-sm font-medium shrink-0 ${activeTab === 'activityLog' ? 'border-b-2 border-primary' : ''}`}
            >
              Activity Log
            </TabsTrigger>
            <TabsTrigger 
              value="mentees" 
              className={`px-3 sm:px-6 py-3 text-sm font-medium shrink-0 ${activeTab === 'mentees' ? 'border-b-2 border-primary' : ''}`}
            >
              Mentees
            </TabsTrigger>
            <TabsTrigger 
              value="schedule" 
              className={`px-3 sm:px-6 py-3 text-sm font-medium shrink-0 ${activeTab === 'schedule' ? 'border-b-2 border-primary' : ''}`}
            >
              Schedule
            </TabsTrigger>
            <TabsTrigger 
              value="documents" 
              className={`px-3 sm:px-6 py-3 text-sm font-medium shrink-0 ${activeTab === 'documents' ? 'border-b-2 border-primary' : ''}`}
            >
              Documents
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <EducationBackground education={profileData.education} />
                
                <div className="mt-6">
                  <PerformanceMetrics metrics={profileData.performanceMetrics} />
                </div>
              </div>
              
              <div>
                <Card className="mb-6">
                  <CardContent className="pt-6">
                    <h2 className="text-xl font-bold flex items-center gap-2 mb-2">
                      <Award size={22} className="text-primary" /> Areas of Expertise
                    </h2>
                    <div className="flex flex-wrap gap-2 mt-4">
                      {profileData.areasOfExpertise.map((area: string, index: number) => (
                        <div key={index} className="bg-muted rounded-full px-4 py-2 text-sm">
                          {area}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                
                <MenteeSummary summary={profileData.menteeSummary} />
                <PublicationsSection publications={profileData.publications} />
              </div>
            </div>
            
            {/* Monthly Performance Trends */}
            <Card className="mt-6">
              <CardContent className="pt-6">
                <h2 className="text-xl font-bold flex items-center gap-2 mb-1">
                  <BarChart3 size={22} className="text-primary" /> Monthly Performance Trends
                </h2>
                <p className="text-muted-foreground mb-4 text-sm">Sessions held and activity progress by month</p>
                <PerformanceCharts data={profileData.performanceData} />
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="performance">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <Card>
                <CardContent className="flex flex-col items-center justify-center pt-6">
                  <div className="relative w-40 h-40">
                    <div className="w-40 h-40 rounded-full border-8 border-success0 flex items-center justify-center">
                      <span className="text-4xl font-bold">{profileData.performanceMetrics.sessionKnown ? `${profileData.performanceMetrics.sessionCompletionRate}%` : '—'}</span>
                    </div>
                  </div>
                  <p className="text-muted-foreground mt-4">Sessions held</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="flex flex-col items-center justify-center pt-6">
                  <div className="relative w-40 h-40">
                    <div className="w-40 h-40 rounded-full border-8 border-primary0 flex items-center justify-center">
                      <span className="text-4xl font-bold">{profileData.performanceMetrics.progressKnown ? `${profileData.performanceMetrics.menteeProgressRate}%` : '—'}</span>
                    </div>
                  </div>
                  <p className="text-muted-foreground mt-4">Average mentee score</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="flex flex-col items-center justify-center pt-6">
                  <div className="relative w-40 h-40">
                    <div className="w-40 h-40 rounded-full border-8 border-info0 flex items-center justify-center">
                      <span className="text-4xl font-bold">{profileData.performanceMetrics.attendanceRate == null ? '—' : `${profileData.performanceMetrics.attendanceRate}%`}</span>
                    </div>
                  </div>
                  <p className="text-muted-foreground mt-4">Attendance, last 30 days</p>
                </CardContent>
              </Card>
            </div>
            
            <PerformanceVisuals profile={profileData} />
          </TabsContent>
          
          <TabsContent value="activityLog">
            <ActivityTimeline activities={profileData.activities} />
          </TabsContent>
          
          <TabsContent value="mentees">
            <MenteesList mentees={profileData.mentees} />
          </TabsContent>
          
          <TabsContent value="schedule">
            <AvailabilitySchedule availabilitySlots={profileData.availabilitySlots} />
          </TabsContent>
          <TabsContent value="documents">
            <MentorDocuments />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Profile;
