
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BarChart2, Calendar, UserCircle, Menu, Activity, MessageSquare, QrCode, Bot, MapPin, CalendarPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { mentorBase } from '@/paths';

export const CustomSidebar = () => {
  const { open, toggleSidebar, isMobile, openMobile, setOpenMobile } = useSidebar();
  const location = useLocation();
  
  const base = mentorBase();
  const navigationItems = [
    { name: 'Dashboard', icon: BarChart2, path: `${base}/dashboard` },
    { name: 'Activities', icon: Activity, path: `${base}/activities` },
    { name: 'Meetings', icon: Calendar, path: `${base}/meetings` },
    { name: 'Mentee Chat', icon: MessageSquare, path: `${base}/chat` },
    { name: 'Ditto', icon: Bot, path: `${base}/assistant` },
    { name: 'Attendance', icon: QrCode, path: `${base}/attendance` },
    { name: 'Campus', icon: MapPin, path: `${base}/campus` },
    { name: 'Create event', icon: CalendarPlus, path: `${base}/create-event` },
    { name: 'Profile', icon: UserCircle, path: `${base}/profile` },
  ];

  const visible = !isMobile || openMobile;

  if (!visible) return (
    <Button onClick={() => setOpenMobile(true)} size="icon" className="fixed left-4 top-4 z-40 shadow-md" aria-label="Open navigation">
      <Menu className="h-5 w-5" />
    </Button>
  );

  return (
    <aside className={cn(
      "fixed inset-y-0 left-0 z-40 flex flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
      isMobile ? "w-64 shadow-xl" : open ? "w-64" : "w-16"
    )}>
      <div className="flex h-16 shrink-0 items-center border-b border-sidebar-border px-3">
        <div className={cn("flex items-center gap-2", !open && "justify-center w-full")}>
          <Button variant="ghost" size="icon" onClick={isMobile ? () => setOpenMobile(false) : toggleSidebar} className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" aria-label="Toggle navigation">
            <Menu className="h-5 w-5" />
          </Button>
          {(open || isMobile) && (
            <div className="font-semibold text-lg">BIOGRED</div>
          )}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col py-4">
        <TooltipProvider delayDuration={200}>
          <nav className="space-y-1 px-2">
            {navigationItems.map((item) => (
              <Tooltip key={item.path}>
                <TooltipTrigger asChild>
                  <Link
                    to={item.path}
                    onClick={() => { if (isMobile) setOpenMobile(false); }}
                    aria-label={item.name}
                    className={cn(
                      "flex h-10 items-center rounded-md px-3 text-sm font-medium transition-colors",
                      (location.pathname === item.path || location.pathname.startsWith(`${item.path}/`) || (item.path.endsWith('/dashboard') && location.pathname === base))
                        ? "bg-sidebar-primary text-sidebar-primary-foreground"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                      !open && !isMobile && "justify-center px-0"
                    )}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                    {(open || isMobile) && <span className="ml-3">{item.name}</span>}
                  </Link>
                </TooltipTrigger>
                {!open && !isMobile && (
                  <TooltipContent side="right">
                    {item.name}
                  </TooltipContent>
                )}
              </Tooltip>
            ))}
          </nav>
        </TooltipProvider>
      </div>
    </aside>
  );
};
