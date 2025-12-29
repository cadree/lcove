import React from 'react';
import { Settings, Bell } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { NotificationList } from '@/components/notifications/NotificationList';
import { NotificationPreferences } from '@/components/notifications/NotificationPreferences';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

const Notifications: React.FC = () => {
  return (
    <PageLayout showNotificationBell={false}>
      <div className="h-full flex flex-col px-4 pt-6">
        <PageHeader
          title="Notifications"
          icon={<Bell className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />}
          actions={
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
          }
        />
        <NotificationList />
      </div>
    </PageLayout>
  );
};

export default Notifications;
