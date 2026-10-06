
import React from 'react';
import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import Header from './Header';
import { CustomSidebar } from './CustomSidebar';
import { useLocation } from 'react-router-dom';
import { mentorBase } from '@/paths';
import { useHome } from '@/services/dashboardService';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <SidebarProvider defaultOpen={true}>
      <LayoutFrame>{children}</LayoutFrame>
    </SidebarProvider>
  );
};

const LayoutFrame: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const base = mentorBase();
  const home = useHome();
  const isDashboard = location.pathname === base || location.pathname === `${base}/dashboard`;
  const { open, isMobile } = useSidebar();
  
  return (
    <div className="min-h-screen w-full min-w-0 bg-background">
      <CustomSidebar />
      <div className={`flex min-h-screen min-w-0 flex-col transition-[margin] duration-200 ${isMobile ? 'ml-0' : open ? 'ml-64' : 'ml-16'}`}>
        {isDashboard && <Header userName={home.data?.mentor_name || 'Mentor'} showWelcome />}
        <main className={`flex-1 min-w-0 bg-muted/40 px-4 py-6 sm:px-6 lg:px-8 ${isMobile && !isDashboard ? 'pt-20' : ''}`}>
          {children}
        </main>
        <footer className="px-6 py-4 text-center text-xs text-muted-foreground">
          Powered by BIOGRED
        </footer>
      </div>
    </div>
  );
};

export default Layout;
