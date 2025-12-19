import React, { useState } from 'react';
import { Shield, Users, AlertTriangle, CheckCircle, XCircle, Clock, History, Search, ArrowLeft, Ban, UserCheck } from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import PageLayout from '@/components/layout/PageLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  useIsAdmin,
  useAllUsers,
  usePendingOnboarding,
  useAdminActions,
  useSuspendUser,
  useUnsuspendUser,
  useApproveOnboarding,
  useDenyOnboarding,
  useLowReputationUsers,
  useChangeAccessStatus,
} from '@/hooks/useAdmin';
import { formatDistanceToNow } from 'date-fns';

const Admin: React.FC = () => {
  const navigate = useNavigate();
  const { isAdmin, isLoading: checkingAdmin } = useIsAdmin();
  const [search, setSearch] = useState('');
  const [suspendDialog, setSuspendDialog] = useState<{ userId: string; name: string } | null>(null);
  const [denyDialog, setDenyDialog] = useState<{ userId: string; name: string } | null>(null);
  const [statusDialog, setStatusDialog] = useState<{ userId: string; name: string; currentStatus: string } | null>(null);
  const [reason, setReason] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'active' | 'denied' | 'banned'>('active');

  const { data: users, isLoading: loadingUsers } = useAllUsers();
  const { data: pendingOnboarding, isLoading: loadingPending } = usePendingOnboarding();
  const { data: adminActions, isLoading: loadingActions } = useAdminActions();
  const { data: lowRepUsers } = useLowReputationUsers();

  const suspendUser = useSuspendUser();
  const unsuspendUser = useUnsuspendUser();
  const approveOnboarding = useApproveOnboarding();
  const denyOnboarding = useDenyOnboarding();
  const changeAccessStatus = useChangeAccessStatus();

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

  const filteredUsers = users?.filter(u =>
    u.display_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.user_id?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSuspend = () => {
    if (suspendDialog && reason) {
      suspendUser.mutate({ userId: suspendDialog.userId, reason });
      setSuspendDialog(null);
      setReason('');
    }
  };

  const handleDeny = () => {
    if (denyDialog && reason) {
      denyOnboarding.mutate({ userId: denyDialog.userId, reason });
      setDenyDialog(null);
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

  return (
    <PageLayout>
      <div className="min-h-screen pb-20">
        {/* Header */}
        <div className="bg-gradient-to-b from-primary/10 to-background px-4 pt-6 pb-8">
          <div className="flex items-center gap-3 mb-2">
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          </div>
          <p className="text-muted-foreground ml-12">Manage users, review onboarding, and maintain community integrity</p>
        </div>

        {/* Stats */}
        <div className="px-4 py-4 grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{users?.length || 0}</div>
              <div className="text-sm text-muted-foreground">Total Users</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-yellow-500">{pendingOnboarding?.length || 0}</div>
              <div className="text-sm text-muted-foreground">Pending Review</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-500">{users?.filter(u => u.is_suspended).length || 0}</div>
              <div className="text-sm text-muted-foreground">Suspended</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-orange-500">{lowRepUsers?.length || 0}</div>
              <div className="text-sm text-muted-foreground">Low Reputation</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="users" className="px-4">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="users"><Users className="h-4 w-4" /></TabsTrigger>
            <TabsTrigger value="pending"><Clock className="h-4 w-4" /></TabsTrigger>
            <TabsTrigger value="flagged"><AlertTriangle className="h-4 w-4" /></TabsTrigger>
            <TabsTrigger value="history"><History className="h-4 w-4" /></TabsTrigger>
          </TabsList>

          {/* All Users */}
          <TabsContent value="users" className="mt-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <ScrollArea className="h-[400px]">
              {loadingUsers ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredUsers?.map(user => (
                    <Card key={user.id}>
                      <CardContent className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={user.avatar_url || undefined} />
                            <AvatarFallback>{user.display_name?.[0] || '?'}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium flex items-center gap-2 flex-wrap">
                              {user.display_name || 'Unnamed'}
                              {getStatusBadge((user as any).access_status)}
                              {(user as any).mindset_level && (
                                <Badge variant="outline">L{(user as any).mindset_level}</Badge>
                              )}
                              {(user as any).onboarding_score && (
                                <Badge variant="secondary">Score: {(user as any).onboarding_score}</Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {user.city || 'No location'}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setStatusDialog({ 
                              userId: user.user_id, 
                              name: user.display_name || 'User',
                              currentStatus: (user as any).access_status || 'pending'
                            })}
                          >
                            Status
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Pending Onboarding */}
          <TabsContent value="pending" className="mt-4">
            <ScrollArea className="h-[400px]">
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
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => setDenyDialog({ userId: user.user_id, name: user.display_name || 'User' })}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Flagged Users */}
          <TabsContent value="flagged" className="mt-4">
            <ScrollArea className="h-[400px]">
              {lowRepUsers?.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <p className="text-muted-foreground">No flagged users</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {lowRepUsers?.map((item: any) => (
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
            </ScrollArea>
          </TabsContent>

          {/* Action History */}
          <TabsContent value="history" className="mt-4">
            <ScrollArea className="h-[400px]">
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
                              action.action_type === 'suspend' ? 'destructive' :
                              action.action_type === 'approve_onboarding' ? 'default' : 'secondary'
                            }>
                              {action.action_type}
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
            </ScrollArea>
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
            <Button variant="destructive" onClick={handleSuspend} disabled={!reason}>
              Suspend User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deny Dialog */}
      <Dialog open={!!denyDialog} onOpenChange={() => setDenyDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deny {denyDialog?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Reason (will be shown to user)</Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Provide a gentle reason for denial..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDenyDialog(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeny} disabled={!reason}>
              Deny Onboarding
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
              <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active (Full Access)</SelectItem>
                  <SelectItem value="denied">Denied (No Access)</SelectItem>
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
    </PageLayout>
  );
};

export default Admin;
