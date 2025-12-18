import React from 'react';
import { Settings } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import { NotificationList } from '@/components/notifications/NotificationList';
import { NotificationPreferences } from '@/components/notifications/NotificationPreferences';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

const Notifications: React.FC = () => {
  return (
    <PageLayout>
      <div className="h-full flex flex-col">
        {/* Settings button */}
        <div className="absolute top-4 right-4 z-10">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Settings className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-md p-0 overflow-y-auto">
              <NotificationPreferences />
            </SheetContent>
          </Sheet>
        </div>

        <NotificationList />
      </div>
    </PageLayout>
  );
};

export default Notifications;
