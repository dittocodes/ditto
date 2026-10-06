
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Search, Filter, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { MenteeType } from '@/types/profile';

interface MenteesListProps {
  mentees: MenteeType[];
}

const MenteesList: React.FC<MenteesListProps> = ({ mentees }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  
  const filteredMentees = mentees.filter(mentee => 
    mentee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    mentee.project.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Mentees</h2>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-grow">
          <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
          <Input 
            className="pl-10" 
            placeholder="Search mentees by name or project" 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      
      {filteredMentees.length === 0 && <p className="text-muted-foreground">No mentees found.</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredMentees.map(mentee => (
          <Card key={mentee.id}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-3">
                <Avatar>
                  {mentee.avatar ? (
                    <img src={mentee.avatar} alt={mentee.name} />
                  ) : (
                    <AvatarFallback>{mentee.name.charAt(0).toUpperCase()}</AvatarFallback>
                  )}
                </Avatar>
                <div>
                  <h3 className="font-medium">{mentee.name}</h3>
                  <p className="text-sm text-muted-foreground">{mentee.id}</p>
                </div>
              </div>
              
              <div className="mb-3">
                <h4 className="text-sm font-medium text-muted-foreground">Project</h4>
                <p>{mentee.project}</p>
              </div>
              
              <div>
                <div className="flex justify-between items-center text-sm mb-1">
                  <span className="font-medium">Progress</span>
                  <span className="text-muted-foreground">{mentee.progress}%</span>
                </div>
                <Progress value={mentee.progress} className="h-2" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default MenteesList;
