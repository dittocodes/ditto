
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { GraduationCap, Award } from 'lucide-react';
import { EducationType, AwardType } from '@/types/profile';

interface EducationBackgroundProps {
  education: EducationType[];
  awards?: AwardType[];
}

const EducationBackground: React.FC<EducationBackgroundProps> = ({ education, awards = [] }) => {
  return (
    <Card>
      <CardContent className="pt-6">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-4">
          <GraduationCap size={22} className="text-primary" /> Education & Achievements
        </h2>
        
        <div className="space-y-4">
          {education.map((item, index) => (
            <div key={index} className="flex gap-3 pb-3 border-b last:border-0 last:pb-0">
              <div className="bg-gray-100 rounded-full p-2 h-fit">
                <GraduationCap size={20} className="text-gray-600" />
              </div>
              <div>
                <h3 className="font-medium">{item.degree}</h3>
                <p className="text-sm text-gray-600">{item.institution}</p>
                {item.year ? <p className="text-sm text-gray-500">{item.year}</p> : null}
              </div>
            </div>
          ))}
        </div>
        
        {awards && awards.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-medium flex items-center gap-2 mb-3">
              <Award size={20} className="text-primary" /> Awards & Recognitions
            </h3>
            <div className="space-y-3">
              {awards.map((award, index) => (
                <div key={index} className="flex gap-3">
                  <div className="bg-gray-100 rounded-full p-2 h-fit">
                    <Award size={16} className="text-gray-600" />
                  </div>
                  <div>
                    <h4 className="font-medium">{award.name}</h4>
                    {award.year ? <p className="text-sm text-gray-500">{award.year}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EducationBackground;
