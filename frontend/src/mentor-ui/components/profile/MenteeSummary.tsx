
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, CheckCircle, Calendar } from 'lucide-react';
import { MenteeSummaryType } from '@/types/profile';

interface MenteeSummaryProps {
  summary: MenteeSummaryType;
}

const MenteeSummary: React.FC<MenteeSummaryProps> = ({ summary }) => {
  const summaryItems = [
    {
      icon: <Users size={20} className="text-blue-500" />,
      label: "Total Mentees Guided",
      value: summary.totalMenteesGuided,
    },
    {
      icon: <Users size={20} className="text-green-500" />,
      label: "Currently Active Mentees",
      value: summary.currentlyActiveMentees,
    },
    {
      icon: <CheckCircle size={20} className="text-purple-500" />,
      label: "Sessions Completed",
      value: summary.sessionsCompleted,
    },
    {
      icon: <Calendar size={20} className="text-orange-500" />,
      label: "Upcoming Sessions",
      value: summary.upcomingSessions,
    }
  ];

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
          <Users size={22} className="text-primary" /> Mentee Summary
        </h2>
        
        <div className="grid grid-cols-2 gap-4">
          {summaryItems.map((item, index) => (
            <div key={index} className="flex flex-col items-center p-3 border rounded-lg">
              <div className="mb-2">
                {item.icon}
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{item.value}</p>
                <p className="text-sm text-gray-500">{item.label}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default MenteeSummary;
