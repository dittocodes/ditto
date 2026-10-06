
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { BookOpen, BookMarked, FlaskConical, Award } from 'lucide-react';
import { PublicationsType } from '@/types/profile';

interface PublicationsSectionProps {
  publications: PublicationsType;
}

const PublicationsSection: React.FC<PublicationsSectionProps> = ({ publications }) => {
  const publicationItems = [
    {
      icon: <BookOpen size={20} className="text-blue-500" />,
      label: "Total Publications",
      value: publications.totalPublications,
    },
    {
      icon: <BookMarked size={20} className="text-green-500" />,
      label: "Publications with Mentees",
      value: publications.publicationsWithMentees,
    },
    {
      icon: <FlaskConical size={20} className="text-purple-500" />,
      label: "Ongoing Research Projects",
      value: publications.ongoingResearchProjects,
    },
    {
      icon: <Award size={20} className="text-orange-500" />,
      label: "Research Grants",
      value: publications.researchGrants,
    }
  ];

  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
          <BookOpen size={22} className="text-primary" /> Research & Publications
        </h2>
        
        <div className="grid grid-cols-2 gap-4">
          {publicationItems.filter((item) => item.value != null).map((item, index) => (
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

export default PublicationsSection;
