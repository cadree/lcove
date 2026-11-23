import PageLayout from "@/components/layout/PageLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProfileMyTickets } from "@/components/profile/ProfileMyTickets";

const Tickets = () => (
  <PageLayout>
    <PageHeader title="My tickets" className="px-4 pt-6" />
    <div className="mx-auto max-w-2xl px-4 pb-16">
      <ProfileMyTickets showEmpty />
    </div>
  </PageLayout>
);

export default Tickets;
