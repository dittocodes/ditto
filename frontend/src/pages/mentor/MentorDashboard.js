import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import Layout from '@/components/layout/Layout';
import SupportAssistantWidget from '../student/components/SupportAssistantWidget';
import {
  MENTOR_DITTO_GREETING,
  MENTOR_DITTO_KEYS,
  MENTOR_DITTO_PROMPTS,
  fetchMentorOpening,
  sendMentorChat,
} from '@/services/dittoChat';
import '@/design.css';

const MentorDashboard = () => {
  const [client] = useState(() => new QueryClient());
  const location = useLocation();
  const hideDitto = location.pathname.endsWith('/assistant');
  useEffect(() => {
    document.body.classList.add('mentor-design');
    return () => document.body.classList.remove('mentor-design');
  }, []);
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider>
        <div className="mentor-design">
          <Layout>
            <Outlet />
          </Layout>
          {hideDitto ? null : (
            <SupportAssistantWidget
              allowSamples={false}
              sendMessage={sendMentorChat}
              greeting={MENTOR_DITTO_GREETING}
              prompts={MENTOR_DITTO_PROMPTS}
              storageKeys={MENTOR_DITTO_KEYS}
              subtitle="Caseload assistant"
              hint="Type a message, or tap the microphone to ask about your mentees."
              loadOpening={fetchMentorOpening}
            />
          )}
          <Toaster />
          <Sonner />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default MentorDashboard;
