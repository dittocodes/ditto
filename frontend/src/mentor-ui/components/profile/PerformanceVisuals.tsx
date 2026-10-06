import React from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ProfileType } from '@/types/profile';

const mixColors = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--term-short))'];

const PerformanceVisuals = ({ profile }: { profile: ProfileType }) => {
  const sessionTypes = (profile.sessionMix || []).map((item, index) => ({
    ...item,
    color: mixColors[index % mixColors.length],
  }));
  const quarterly = ['Q1', 'Q2', 'Q3', 'Q4'].map((quarter, index) => {
    const sessions = profile.performanceData.monthlySessions.slice(index * 3, index * 3 + 3);
    const progress = profile.performanceData.monthlyProgress.slice(index * 3, index * 3 + 3);
    return {
      quarter,
      sessions: sessions.reduce((sum, value) => sum + value, 0),
      progress: progress.length ? Math.round(progress.reduce((sum, value) => sum + value, 0) / progress.length) : 0,
    };
  });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="text-base">Quarterly performance</CardTitle>
          <p className="text-sm text-muted-foreground">Completed sessions and average mentee progress</p>
        </CardHeader>
        <CardContent className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={quarterly} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="quarter" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="sessions" name="Sessions" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="progress" name="Progress %" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Session distribution</CardTitle>
          <p className="text-sm text-muted-foreground">Share of this year’s mentoring sessions</p>
        </CardHeader>
        <CardContent>
          {sessionTypes.length === 0 ? <p className="text-sm text-muted-foreground">No sessions recorded yet.</p> : <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sessionTypes} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={2}>
                  {sessionTypes.map((entry) => <Cell key={entry.name} fill={entry.color} stroke="hsl(var(--card))" />)}
                </Pie>
                <Tooltip formatter={(value: number) => `${value}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>}
          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            {sessionTypes.map((item) => (
              <div key={item.name} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                <span>{item.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PerformanceVisuals;