import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { BellIcon, UserCircle, Calendar, MessageSquare, FileText, ChevronRight, LogOut } from 'lucide-react';
import { mentorBase } from '@/paths';

interface HeaderProps {
  userName: string;
  showWelcome?: boolean;
}

const Header: React.FC<HeaderProps> = ({ userName, showWelcome = false }) => {
  const location = useLocation();
  const base = mentorBase();
  const pathSegments = location.pathname.replace(base, '').split('/').filter(Boolean);
  
  return (
    <header className="border-b bg-card sticky top-0 z-20 shadow-sm w-full">
      <div className="flex h-16 items-center pl-20 pr-4 md:px-6">
        {showWelcome ? (
          <div className="flex-1">
            <h1 className="text-lg sm:text-2xl font-semibold">Welcome, {userName}</h1>
          </div>
        ) : (
          <div className="flex-1">
             <nav className="flex items-center text-sm text-muted-foreground" aria-label="Breadcrumb">
              <Link to={`${base}/dashboard`} className="hover:text-primary transition-colors">Home</Link>
              {pathSegments.map((segment, index) => (
                <React.Fragment key={segment}>
                  <ChevronRight className="h-4 w-4 mx-1" />
                  <span className={index === pathSegments.length - 1 ? "font-medium text-foreground capitalize" : "capitalize"}>
                    {segment.replace(/-/g, ' ')}
                  </span>
                </React.Fragment>
              ))}
            </nav>
          </div>
        )}
        
        <div className="flex items-center gap-2 ml-auto">
          <Link to={`${base}/profile`}>
            <Button variant="ghost" size="sm" className="flex items-center gap-2">
              <UserCircle className="h-5 w-5" />
              <span className="hidden sm:inline">My Profile</span>
            </Button>
          </Link>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full" aria-label="User menu">
                <Avatar className="h-9 w-9">
                  <AvatarFallback>
                    {userName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to={`${base}/profile`}>Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to={`${base}/consolidated-internal-marks`}>Internal marks</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to={`${base}/counseling`}>Counseling</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to={`${base}/campus`}>Campus</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to={`${base}/create-event`}>Create event</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/logout"><LogOut className="mr-2 h-4 w-4" />Sign out</Link>
              </DropdownMenuItem>

            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

interface NotificationItemProps {
  title: string;
  description: string;
  time: string;
  icon: React.ReactNode;
}

const NotificationItem: React.FC<NotificationItemProps> = ({ title, description, time, icon }) => {
  return (
    <div className="px-2 py-2 hover:bg-muted/50 cursor-pointer">
      <div className="flex gap-3">
        <div className="bg-muted p-2 rounded-full">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground truncate">{description}</p>
          <p className="text-xs text-muted-foreground mt-1">{time}</p>
        </div>
      </div>
    </div>
  );
};

export default Header;
