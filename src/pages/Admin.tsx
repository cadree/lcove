import React, { useState, useMemo } from 'react';
import { 
  Shield, Users, AlertTriangle, CheckCircle, Clock, History, Search, 
  Ban, UserCheck, ClipboardList, Trash2, Eye, Phone, Mail, MapPin, 
  Briefcase, Heart, Star, Send, Coins, Download, MessageSquare, ShieldCheck, ShieldOff,
  MessageCircle, Building2, Flag, Shirt, Film
} from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import { WaitlistAdminDialog } from '@/components/admin/WaitlistAdminDialog';
import { WaitlistExportButton } from '@/components/admin/WaitlistExportButton';
import { citiesShareGroup } from '@/lib/cityNormalization';
import PageLayout from '@/components/layout/PageLayout';
import { BackButton } from '@/components/navigation/BackButton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  useIsAdmin,
  useAllUsers,
  usePendingOnboarding,
  useAdminActions,
  useSuspendUser,
  useUnsuspendUser,
  useApproveOnboarding,
  useLowReputationUsers,
  useChangeAccessStatus,
  useDeleteUser,
  useRestoreUser,
  useHardDeleteUser,
} from '@/hooks/useAdmin';
import {
  useAdminUserData,
  useAdminAnnouncements,
  useSendMassNotification,
  useAdjustUserCredits,
  useBulkAwardCredits,
  exportUsersToCSV,
  useToggleAdminRole,
  useSendIndividualMessage,
} from '@/hooks/useAdminExtended';
import { formatDistanceToNow } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';
import { PartnerApplicationsTab } from '@/components/admin/PartnerApplicationsTab';
import { AdminMembersTab, type MemberRowActions } from '@/components/admin/members/AdminMembersTab';
import { useHideMembersLocally } from '@/hooks/useAdminMembers';
import { memberLabel } from '@/lib/adminMembers';
import { ContentReportsTab } from '@/components/admin/ContentReportsTab';
import { ContentModerationTab } from '@/components/admin/ContentModerationTab';
import { AdminStats } from '@/components/admin/AdminStats';
import { NuanceInterestTab } from '@/components/admin/NuanceInterestTab';
import { CinemaReviewTab } from '@/components/admin/CinemaReviewTab';
import { readNumber } from '@/lib/numberField';
import { toast } from 'sonner';

type UserAccessStatus = 'active' | 'banned';
type MessageAudience = 'all' | 'mindset_level' | 'city';

function isUserAccessStatus(value: string): value is UserAccessStatus {
  return value === 'active' || value === 'banned';
}

function isMessageAudience(value: string): value is MessageAudience {
  return value === 'all' || value === 'mindset_level' || value === 'city';
}

const Admin: React.FC = () => {
  const navigate = useNavigate();
  const { isAdmin, isLoading: checkingAdmin } = useIsAdmin();
  
  // State
  
  // Dialog states
  const [suspendDialog, setSuspendDialog] = useState<{ userId: string; name: string } | null>(null);
  const [statusDialog, setStatusDialog] = useState<{ userId: string; name: string; currentStatus: string } | null>(null);
  const [removeDialog, setRemoveDialog] = useState<{ userId: string; name: string } | null>(null);
  const [hardDeleteDialog, setHardDeleteDialog] = useState<{ userId: string; name: string } | null>(null);
  const [hardConfirm, setHardConfirm] = useState('');
  const [creditDialog, setCreditDialog] = useState<{ userId: string; name: string; balance: number } | null>(null);
  const [bulkCreditDialog, setBulkCreditDialog] = useState(false);
  const [massMessageDialog, setMassMessageDialog] = useState(false);
  const [individualMessageDialog, setIndividualMessageDialog] = useState<{ 
    userId: string; 
    name: string; 
    email: string | null;
    phone: string | null;
  } | null>(null);
  
  // Form states
  const [reason, setReason] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'active' | 'banned'>('active');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');
  const [messageTitle, setMessageTitle] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [messageTarget, setMessageTarget] = useState<'all' | 'mindset_level' | 'city'>('all');
  const [messageTargetValue, setMessageTargetValue] = useState('');
  const [deliveryMethods, setDeliveryMethods] = useState({
    email: true,
    sms: false,
    dm: true,
  });

  // Queries
  const { data: users, isLoading: loadingUsers } = useAllUsers();
  // The full member dump is only for CSV export and audience-wide credit awards.
  const { data: adminUserData, refetch: loadAdminUserData, isFetching: loadingAdminData } = useAdminUserData({ enabled: bulkCreditDialog });
  const hideMembersLocally = useHideMembersLocally();
  const { data: pendingOnboarding, isLoading: loadingPending } = usePendingOnboarding();
  const { data: adminActions, isLoading: loadingActions } = useAdminActions();
  const { data: announcements, isLoading: loadingAnnouncements } = useAdminAnnouncements();
  const { data: lowRepUsers } = useLowReputationUsers();

  // Mutations
  const suspendUser = useSuspendUser();
  const unsuspendUser = useUnsuspendUser();
  const approveOnboarding = useApproveOnboarding();
  const changeAccessStatus = useChangeAccessStatus();
  const deleteUser = useDeleteUser();
  const restoreUser = useRestoreUser();
  const hardDeleteUser = useHardDeleteUser();
  const adjustCredits = useAdjustUserCredits();
  const bulkAwardCredits = useBulkAwardCredits();
  const sendMassNotification = useSendMassNotification();
  const toggleAdminRole = useToggleAdminRole();
  const sendIndividualMessage = useSendIndividualMessage();


  if (checkingAdmin) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-primary" />
        </div>
      </PageLayout>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  // Handlers
  const handleSuspend = () => {
    if (suspendDialog && reason) {
      suspendUser.mutate({ userId: suspendDialog.userId, reason });
      setSuspendDialog(null);
      setReason('');
    }
  };

  const handleStatusChange = () => {
    if (statusDialog && selectedStatus) {
      changeAccessStatus.mutate({ 
        userId: statusDialog.userId, 
        status: selectedStatus,
        reason: reason || undefined 
      });
      setStatusDialog(null);
      setReason('');
    }
  };

  const handleRemoveUser = () => {
    if (removeDialog) {
      const { userId, name } = removeDialog;
      deleteUser.mutate(
        { userId, reason: reason || undefined },
        {
          onSuccess: () => {
            // The list hides removed people by default, so drop the row now.
            hideMembersLocally([userId]);
            toast.success(`Removed ${name}`, {
              description: 'Hidden from Explore and the member list. Find them under Removed.',
              duration: 10_000,
              action: { label: 'Undo', onClick: () => restoreUser.mutate({ userId }) },
            });
          },
        },
      );
      setRemoveDialog(null);
      setReason('');
    }
  };

  const memberActions: MemberRowActions = {
    credits: (m) => setCreditDialog({ userId: m.user_id, name: memberLabel(m), balance: m.credit_balance }),
    status: (m) => setStatusDialog({ userId: m.user_id, name: memberLabel(m), currentStatus: m.access_status || 'pending' }),
    message: (m) => setIndividualMessageDialog({ userId: m.user_id, name: memberLabel(m), email: m.email, phone: m.phone }),
    suspend: (m) => {
      setReason('');
      setSuspendDialog({ userId: m.user_id, name: memberLabel(m) });
    },
    unsuspend: (m) => unsuspendUser.mutate(m.user_id),
    remove: (m) => {
      setReason('');
      setRemoveDialog({ userId: m.user_id, name: memberLabel(m) });
    },
    restore: (m) => restoreUser.mutate({ userId: m.user_id }),
    toggleAdmin: (m) => {
      const question = m.is_admin ? `Remove admin access from ${memberLabel(m)}?` : `Make ${memberLabel(m)} an admin?`;
      if (window.confirm(question)) toggleAdminRole.mutate({ userId: m.user_id, makeAdmin: !m.is_admin });
    },
  };

  const handleAdjustCredits = () => {
    const credits = readNumber(creditAmount, { label: 'Amount', integer: true });
    if (creditDialog && !credits.error && credits.value && creditReason) {
      adjustCredits.mutate({
        userId: creditDialog.userId,
        amount: credits.value,
        reason: creditReason,
      });
      setCreditDialog(null);
      setCreditAmount('');
      setCreditReason('');
    }
  };

  const handleBulkAward = () => {
    const award = readNumber(creditAmount, { label: 'Amount', min: 1, integer: true });
    if (award.error || award.value === null) {
      toast.error(award.error ?? 'Enter amount');
      return;
    }
    if (creditReason && adminUserData) {
      // Filter users based on target audience. Removed and suspended people are skipped.
      const eligible = adminUserData.filter(u => !u.deleted_at && !u.is_suspended);
      let targetUserIds: string[] = [];
      if (messageTarget === 'all') {
        targetUserIds = eligible.map(u => u.user_id);
      } else if (messageTarget === 'mindset_level') {
        targetUserIds = eligible.filter(u => u.mindset_level === parseInt(messageTargetValue)).map(u => u.user_id);
      } else if (messageTarget === 'city') {
        targetUserIds = eligible.filter(u => citiesShareGroup(u.city, messageTargetValue)).map(u => u.user_id);
      }
      
      bulkAwardCredits.mutate({
        userIds: targetUserIds,
        amount: award.value,
        reason: creditReason,
      });
      setBulkCreditDialog(false);
      setCreditAmount('');
      setCreditReason('');
      setMessageTarget('all');
      setMessageTargetValue('');
    }
  };

  const handleSendMessage = () => {
    if (messageTitle && messageBody) {
      const targetAudience = messageTarget === 'all' 
        ? { type: 'all' as const }
        : { type: messageTarget, value: messageTarget === 'mindset_level' ? parseInt(messageTargetValue) : messageTargetValue };
      
      sendMassNotification.mutate({
        title: messageTitle,
        message: messageBody,
        targetAudience,
      });
      setMassMessageDialog(false);
      setMessageTitle('');
      setMessageBody('');
      setMessageTarget('all');
      setMessageTargetValue('');
    }
  };

  const handleSendIndividualMessage = () => {
    if (individualMessageDialog && messageTitle && messageBody) {
      sendIndividualMessage.mutate({
        userId: individualMessageDialog.userId,
        title: messageTitle,
        message: messageBody,
        sendDm: deliveryMethods.dm,
        sendEmail: deliveryMethods.email,
        sendSms: deliveryMethods.sms,
      });
      setIndividualMessageDialog(null);
      setMessageTitle('');
      setMessageBody('');
      setDeliveryMethods({ email: true, sms: false, dm: true });
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/20 text-green-500">Active</Badge>;
      case 'denied':
        return <Badge variant="destructive">Denied</Badge>;
      case 'banned':
        return <Badge className="bg-red-900 text-red-100">Banned</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const getMindsetBadge = (level: number | null) => {
    if (!level) return null;
    const colors: Record<number, string> = {
      1: 'bg-gray-500/20 text-gray-500',
      2: 'bg-blue-500/20 text-blue-500',
      3: 'bg-purple-500/20 text-purple-500',
    };
    return <Badge className={colors[level] || ''}>Level {level}</Badge>;
  };

  return (
    <PageLayout>
      <div className="min-h-screen pb-20">
        {/* Header */}
        <div className="bg-gradient-to-b from-primary/10 to-background px-4 pt-6 pb-8">
          <div className="flex items-center gap-3 mb-2">
            <BackButton />
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          </div>
          <div className="flex items-center justify-between ml-12 flex-wrap gap-2">
            <p className="text-muted-foreground">Manage users, credits, and communications</p>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={() => navigate('/admin/onboarding')}
              >
                <ClipboardList className="h-4 w-4" />
                Onboarding
              </Button>
            </div>
          </div>
        </div>

        <AdminStats />

        {/* Quick Actions */}
        <div className="px-4 pb-4 flex gap-2 flex-wrap">
          <Button onClick={() => setMassMessageDialog(true)} className="gap-2">
            <Send className="h-4 w-4" />
            Mass Message
          </Button>
          <Button variant="outline" onClick={() => setBulkCreditDialog(true)} className="gap-2">
            <Coins className="h-4 w-4" />
            Bulk Award Credits
          </Button>
          <Button 
            variant="outline" 
            onClick={async () => {
              const { data } = await loadAdminUserData();
              if (data) exportUsersToCSV(data);
            }}
            className="gap-2"
            disabled={loadingAdminData}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          <WaitlistExportButton />
          <WaitlistAdminDialog />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="users" className="px-4">
          <TabsList className="w-full h-auto grid grid-cols-5 sm:grid-cols-9">
            <TabsTrigger value="users"><Users className="h-4 w-4" /></TabsTrigger>
            <TabsTrigger value="pending"><Clock className="h-4 w-4" /></TabsTrigger>
            <TabsTrigger value="partners"><Building2 className="h-4 w-4" /></TabsTrigger>
            <TabsTrigger value="messages"><MessageSquare className="h-4 w-4" /></TabsTrigger>
            <TabsTrigger value="flagged"><AlertTriangle className="h-4 w-4" /></TabsTrigger>
            <TabsTrigger value="reports" title="Reports"><Flag className="h-4 w-4" /></TabsTrigger>
            <TabsTrigger value="content" title="Content">
              <ClipboardList className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="history"><History className="h-4 w-4" /></TabsTrigger>
            <TabsTrigger value="cinema" title="Cinema review">
              <Film className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="nuance" aria-label="Nuance interest list">
              <Shirt className="h-4 w-4" />
              <span className="sr-only">Nuance</span>
            </TabsTrigger>
          </TabsList>

          {/* All Users Tab */}
          <TabsContent value="users" className="mt-4">
            <AdminMembersTab actions={memberActions} />
          </TabsContent>

          {/* Pending Onboarding Tab */}
          <TabsContent value="pending" className="mt-4">
            <div className="w-full">
              {loadingPending ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
                </div>
              ) : pendingOnboarding?.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <p className="text-muted-foreground">No pending reviews</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingOnboarding?.map(user => (
                    <Card key={user.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={user.avatar_url || undefined} />
                              <AvatarFallback>{user.display_name?.[0] || '?'}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{user.display_name || 'Unnamed'}</div>
                              <div className="text-xs text-muted-foreground">
                                Score: {user.onboarding_score || 'N/A'}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => approveOnboarding.mutate({ userId: user.user_id, level: 1 })}
                          >
                            L1
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => approveOnboarding.mutate({ userId: user.user_id, level: 2 })}
                          >
                            L2
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => approveOnboarding.mutate({ userId: user.user_id, level: 3 })}
                          >
                            L3
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* Partner Applications Tab */}
          <TabsContent value="partners" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Partner Applications
                </CardTitle>
                <CardDescription>Review and manage brand partner applications</CardDescription>
              </CardHeader>
              <CardContent>
                <PartnerApplicationsTab />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Mass Messages Tab */}
          <TabsContent value="messages" className="mt-4">
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="text-lg">Announcement History</CardTitle>
                <CardDescription>Previous mass notifications sent to users</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="w-full">
                  {loadingAnnouncements ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
                    </div>
                  ) : announcements?.length === 0 ? (
                    <div className="text-center py-12">
                      <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">No announcements sent yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {announcements?.map(announcement => (
                        <Card key={announcement.id}>
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-semibold">{announcement.title}</h4>
                              <Badge variant="secondary">
                                {announcement.recipient_count} recipients
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                              {announcement.message}
                            </p>
                            <div className="flex justify-between items-center text-xs text-muted-foreground">
                              <span>
                                Target: {announcement.target_audience.type === 'all' ? 'All Users' : 
                                  `${announcement.target_audience.type}: ${announcement.target_audience.value}`}
                              </span>
                              <span>{formatDistanceToNow(new Date(announcement.sent_at), { addSuffix: true })}</span>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Flagged Users Tab */}
          <TabsContent value="flagged" className="mt-4">
            <div className="w-full">
              {lowRepUsers?.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <p className="text-muted-foreground">No flagged users</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {lowRepUsers?.map((item) => (
                    <Card key={item.id}>
                      <CardContent className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={item.profile?.avatar_url} />
                            <AvatarFallback>{item.profile?.display_name?.[0] || '?'}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{item.profile?.display_name || 'Unnamed'}</div>
                            <div className="text-xs text-muted-foreground">
                              Score: {item.overall_score?.toFixed(1)} | Reviews: {item.review_count}
                            </div>
                          </div>
                        </div>
                        <Badge variant="destructive">Low Rep</Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="reports" className="mt-4">
            <ContentReportsTab />
          </TabsContent>

          <TabsContent value="content" className="mt-4">
            <ContentModerationTab />
          </TabsContent>

          {/* Action History Tab */}
          <TabsContent value="history" className="mt-4">
            <div className="w-full">
              {loadingActions ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
                </div>
              ) : adminActions?.length === 0 ? (
                <div className="text-center py-12">
                  <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No actions yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {adminActions?.map(action => (
                    <Card key={action.id}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <Badge variant={
                              action.action_type.includes('suspend') || action.action_type.includes('deny') || action.action_type.includes('remove') ? 'destructive' :
                              action.action_type.includes('approve') || action.action_type.includes('award') ? 'default' : 'secondary'
                            }>
                              {action.action_type.replace(/_/g, ' ')}
                            </Badge>
                            {action.reason && (
                              <p className="text-sm text-muted-foreground mt-1">{action.reason}</p>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(action.created_at), { addSuffix: true })}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="nuance" className="mt-4">
            <NuanceInterestTab />
          </TabsContent>

          <TabsContent value="cinema" className="mt-4">
            <CinemaReviewTab />
          </TabsContent>
        </Tabs>
      </div>

      {/* Suspend Dialog */}
      <Dialog open={!!suspendDialog} onOpenChange={() => setSuspendDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend {suspendDialog?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Reason</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Provide a reason for suspension..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleSuspend} disabled={!reason || suspendUser.isPending}>
              Suspend User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!removeDialog} onOpenChange={() => setRemoveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {removeDialog?.name}</DialogTitle>
            <DialogDescription>
              This hides the account and signs them out. The row stays so it can be restored.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Reason</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is this account being removed?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveDialog(null)}>Cancel</Button>
            <Button
              variant="outline"
              onClick={() => {
                if (!removeDialog) return;
                setHardConfirm('');
                setHardDeleteDialog(removeDialog);
                setRemoveDialog(null);
              }}
            >
              Delete permanently…
            </Button>
            <Button variant="destructive" onClick={handleRemoveUser} disabled={deleteUser.isPending}>
              Remove account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!hardDeleteDialog} onOpenChange={() => setHardDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permanently delete {hardDeleteDialog?.name}?</DialogTitle>
            <DialogDescription>
              This deletes the login and personal data. It cannot be undone. Paste the user id to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>User id</Label>
            <Input
              value={hardConfirm}
              onChange={(e) => setHardConfirm(e.target.value.trim())}
              placeholder={hardDeleteDialog?.userId}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHardDeleteDialog(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!hardDeleteDialog || hardConfirm !== hardDeleteDialog.userId || hardDeleteUser.isPending}
              onClick={() => {
                if (!hardDeleteDialog) return;
                hardDeleteUser.mutate({
                  userId: hardDeleteDialog.userId,
                  confirm: hardConfirm,
                  reason: reason || undefined,
                });
                setHardDeleteDialog(null);
                setHardConfirm('');
                setReason('');
              }}
            >
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Change Dialog */}
      <Dialog open={!!statusDialog} onOpenChange={() => setStatusDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Status for {statusDialog?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>New Status</Label>
              <Select value={selectedStatus} onValueChange={(v) => { if (isUserAccessStatus(v)) setSelectedStatus(v); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active (Full Access)</SelectItem>
                  <SelectItem value="banned">Banned (Permanently Blocked)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reason (optional)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason for status change..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusDialog(null)}>Cancel</Button>
            <Button onClick={handleStatusChange}>
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Credit Adjustment Dialog */}
      <Dialog open={!!creditDialog} onOpenChange={() => setCreditDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Credits for {creditDialog?.name}</DialogTitle>
            <DialogDescription>
              Current balance: {creditDialog?.balance || 0} credits
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Amount (positive to add, negative to deduct)</Label>
              <Input
                type="text"
                inputMode="text"
                pattern="-?[0-9]*"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value.replace(/[^0-9-]/g, '').replace(/(?!^)-/g, ''))}
                placeholder="e.g., 100 or -50"
              />
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                placeholder="Why are you adjusting credits?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreditDialog(null)}>Cancel</Button>
            <Button 
              onClick={handleAdjustCredits} 
              disabled={!creditAmount || !creditReason || adjustCredits.isPending}
            >
              {adjustCredits.isPending ? 'Adjusting...' : 'Adjust Credits'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Credit Dialog */}
      <Dialog open={bulkCreditDialog} onOpenChange={setBulkCreditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Award Credits</DialogTitle>
            <DialogDescription>
              Award credits to multiple users at once
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Target Audience</Label>
              <Select value={messageTarget} onValueChange={(v) => { if (isMessageAudience(v)) setMessageTarget(v); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="mindset_level">By Mindset Level</SelectItem>
                  <SelectItem value="city">By City</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {messageTarget !== 'all' && (
              <div>
                <Label>{messageTarget === 'mindset_level' ? 'Level' : 'City'}</Label>
                {messageTarget === 'mindset_level' ? (
                  <Select value={messageTargetValue} onValueChange={setMessageTargetValue}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Level 1</SelectItem>
                      <SelectItem value="2">Level 2</SelectItem>
                      <SelectItem value="3">Level 3</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={messageTargetValue}
                    onChange={(e) => setMessageTargetValue(e.target.value)}
                    placeholder="Enter city name"
                  />
                )}
              </div>
            )}
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                placeholder="Credits to award"
                min="1"
                step="1"
              />
            </div>
            <div>
              <Label>Reason</Label>
              <Textarea
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value)}
                placeholder="Why are you awarding credits?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkCreditDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleBulkAward} 
              disabled={!creditAmount || !creditReason || bulkAwardCredits.isPending}
            >
              {bulkAwardCredits.isPending ? 'Awarding...' : 'Award Credits'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mass Message Dialog */}
      <Dialog open={massMessageDialog} onOpenChange={setMassMessageDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Mass Notification</DialogTitle>
            <DialogDescription>
              Send an announcement to all users or a specific group
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Target Audience</Label>
              <Select value={messageTarget} onValueChange={(v) => { if (isMessageAudience(v)) setMessageTarget(v); }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="mindset_level">By Mindset Level</SelectItem>
                  <SelectItem value="city">By City</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {messageTarget !== 'all' && (
              <div>
                <Label>{messageTarget === 'mindset_level' ? 'Level' : 'City'}</Label>
                {messageTarget === 'mindset_level' ? (
                  <Select value={messageTargetValue} onValueChange={setMessageTargetValue}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Level 1</SelectItem>
                      <SelectItem value="2">Level 2</SelectItem>
                      <SelectItem value="3">Level 3</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={messageTargetValue}
                    onChange={(e) => setMessageTargetValue(e.target.value)}
                    placeholder="Enter city name"
                  />
                )}
              </div>
            )}
            <div>
              <Label>Title</Label>
              <Input
                value={messageTitle}
                onChange={(e) => setMessageTitle(e.target.value)}
                placeholder="Notification title"
              />
            </div>
            <div>
              <Label>Message</Label>
              <Textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder="Write your message..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMassMessageDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleSendMessage} 
              disabled={!messageTitle || !messageBody || sendMassNotification.isPending}
            >
              {sendMassNotification.isPending ? 'Sending...' : 'Send Notification'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Individual Message Dialog */}
      <Dialog open={!!individualMessageDialog} onOpenChange={() => setIndividualMessageDialog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Message to {individualMessageDialog?.name}</DialogTitle>
            <DialogDescription>
              Choose how to deliver this message
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              <Label>Delivery Methods</Label>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="dm-check"
                    checked={deliveryMethods.dm}
                    onCheckedChange={(checked) => 
                      setDeliveryMethods(prev => ({ ...prev, dm: !!checked }))
                    }
                  />
                  <label htmlFor="dm-check" className="text-sm font-medium flex items-center gap-1">
                    <MessageCircle className="h-4 w-4" />
                    In-App DM
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="email-check"
                    checked={deliveryMethods.email}
                    disabled={!individualMessageDialog?.email}
                    onCheckedChange={(checked) => 
                      setDeliveryMethods(prev => ({ ...prev, email: !!checked }))
                    }
                  />
                  <label htmlFor="email-check" className="text-sm font-medium flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    Email {!individualMessageDialog?.email && '(No email)'}
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="sms-check"
                    checked={deliveryMethods.sms}
                    disabled={!individualMessageDialog?.phone}
                    onCheckedChange={(checked) => 
                      setDeliveryMethods(prev => ({ ...prev, sms: !!checked }))
                    }
                  />
                  <label htmlFor="sms-check" className="text-sm font-medium flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    SMS {!individualMessageDialog?.phone && '(No phone)'}
                  </label>
                </div>
              </div>
            </div>
            <div>
              <Label>Title</Label>
              <Input
                value={messageTitle}
                onChange={(e) => setMessageTitle(e.target.value)}
                placeholder="Message title"
              />
            </div>
            <div>
              <Label>Message</Label>
              <Textarea
                value={messageBody}
                onChange={(e) => setMessageBody(e.target.value)}
                placeholder="Write your message..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIndividualMessageDialog(null)}>Cancel</Button>
            <Button 
              onClick={handleSendIndividualMessage} 
              disabled={
                !messageTitle || 
                !messageBody || 
                (!deliveryMethods.email && !deliveryMethods.sms && !deliveryMethods.dm) ||
                sendIndividualMessage.isPending
              }
            >
              {sendIndividualMessage.isPending ? 'Sending...' : 'Send Message'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </PageLayout>
  );
};

export default Admin;