
import React from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Mail, Phone, MapPin, Building, Edit, VerifiedIcon, Star } from 'lucide-react';
import { ProfileType } from '@/types/profile';

interface ProfileHeaderProps {
  profile: ProfileType;
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({ profile }) => {
  const initials = profile.name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <div className="bg-card rounded-lg shadow-md overflow-hidden">
      <div className="p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
          <Avatar className="h-24 w-24 border-4 border-white shadow">
            {profile.profileImage ? (
              <img src={profile.profileImage} alt={profile.name} className="object-cover" />
            ) : (
              <AvatarFallback className="text-xl">{initials}</AvatarFallback>
            )}
          </Avatar>
          
          <div className="flex-grow">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold">{profile.name}</h1>
              {profile.verified && (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary">
                  <VerifiedIcon size={14} className="mr-1" /> Verified Mentor
                </Badge>
              )}
            </div>
            
            <p className="text-lg text-muted-foreground">{profile.title}</p>
            
            {profile.rating > 0 && (
            <div className="flex items-center gap-1 mt-1">
              <Star size={18} className="text-warning0 fill-warning0" />
              <span className="font-medium">{profile.rating}</span>
              <span className="text-muted-foreground text-sm">/ 5.0</span>
            </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building size={16} className="text-muted-foreground" /> {profile.department}, {profile.institution}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin size={16} className="text-muted-foreground" /> {profile.location}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail size={16} className="text-muted-foreground" /> {profile.email}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone size={16} className="text-muted-foreground" /> {profile.phone}
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-5">
          <h3 className="font-medium text-foreground mb-1">Bio</h3>
          <p className="text-muted-foreground">{profile.bio}</p>
        </div>
      </div>
    </div>
  );
};

export default ProfileHeader;
