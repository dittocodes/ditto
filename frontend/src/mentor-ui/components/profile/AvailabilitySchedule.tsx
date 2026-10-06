
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Plus } from 'lucide-react';
import { AvailabilitySlotType } from '@/types/profile';

interface AvailabilityScheduleProps {
  availabilitySlots: AvailabilitySlotType[];
}

const AvailabilitySchedule: React.FC<AvailabilityScheduleProps> = ({ availabilitySlots }) => {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Availability Schedule</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {availabilitySlots.map((daySlot, index) => (
          <Card key={index} className="overflow-hidden">
            <div className="bg-primary text-primary-foreground p-4">
              <h3 className="font-semibold text-lg">{daySlot.day}</h3>
            </div>
            <CardContent className="pt-4">
              {daySlot.slots.map((timeSlot, timeIndex) => (
                <div key={timeIndex} className="flex items-center gap-2 p-2 border-b last:border-0">
                  <Clock size={18} className="text-muted-foreground" />
                  <span>
                    {timeSlot.startTime} – {timeSlot.endTime}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
      

    </div>
  );
};

export default AvailabilitySchedule;
