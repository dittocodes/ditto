
import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Activities from "./pages/Activities";
import Meetings from "./pages/Meetings";
import Profile from "./pages/Profile";
import Chat from "./pages/Chat";
import Attendance from "./pages/Attendance";
import NotFound from "./pages/NotFound";
import Layout from "./components/layout/Layout";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1 },
  },
});

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Routes>
            <Route path="/" element={
              <Layout>
                <Index />
              </Layout>
            } />
            <Route path="/activities" element={
              <Layout>
                <Activities />
              </Layout>
            } />
            <Route path="/meetings" element={
              <Layout>
                <Meetings />
              </Layout>
            } />
            <Route path="/profile" element={
              <Layout>
                <Profile />
              </Layout>
            } />
            <Route path="/chat" element={<Layout><Chat /></Layout>} />
            <Route path="/chat/:menteeId" element={<Layout><Chat /></Layout>} />
            <Route path="/attendance" element={<Layout><Attendance /></Layout>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </TooltipProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
