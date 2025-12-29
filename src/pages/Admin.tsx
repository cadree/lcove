import React, { useState, useMemo } from 'react';
import { 
  Shield, Users, AlertTriangle, CheckCircle, XCircle, Clock, History, Search, 
  ArrowLeft, Ban, UserCheck, ClipboardList, Trash2, Eye, Phone, Mail, MapPin, 
  Briefcase, Heart, Star, Send, Coins, Download, MessageSquare, ShieldCheck, ShieldOff,
  MessageCircle
} from 'lucide-react';
import { Navigate, useNavigate } from 'react-router-dom';
import PageLayout from '@/components/layout/PageLayout';
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
import { ScrollArea } from '@/components/ui/scroll-area';
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
  useDenyOnboarding,
  useLowReputationUsers,
  useChangeAccessStatus,
  useDeleteUser,
} from '@/hooks/useAdmin';
import {
  useAdminUserData,
  useAdminAnnouncements,
  useSendMassNotification,
  useAdjustUserCredits,
  useBulkAwardCredits,
  exportUsersToCSV,
  AdminUserData,
  useToggleAdminRole,
  useSendIndividualMessage,
  useSendMultiUserMessage,
} from '@/hooks/useAdminExtended';
import { formatDistanceToNow } from 'date-fns';
import { Checkbox } from '@/components/ui/checkbox';

const Admin: React.FC = () => {
  const navigate = useNavigate();
  const { isAdmin, isLoading: checkingAdmin } = useIsAdmin();
  
  // State
  const [search, setSearch] = useState('');
  const [mindsetFilter, setMindsetFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  
  // Dialog states
  const [suspendDialog, setSuspendDialog] = useState<{ userId: string; name: string } | null>(null);
  const [denyDialog, setDenyDialog] = useState<{ userId: string; name: string } | null>(null);
  const [statusDialog, setStatusDialog] = useState<{ userId: string; name: string; currentStatus: string } | null>(null);
  const [removeDialog, setRemoveDialog] = useState<{ userId: string; name: string } | null>(null);
  const [detailDialog, setDetailDialog] = useState<AdminUserData | null>(null);
  const [creditDialog, setCreditDialog] = useState<{ userId: string; name: string; balance: number } | null>(null);
  const [bulkCreditDialog, setBulkCreditDialog] = useState(false);
  const [massMessageDialog, setMassMessageDialog] = useState(false);
  const [multiUserMessageDialog, setMultiUserMessageDialog] = useState(false);
  const [individualMessageDialog, setIndividualMessageDialog] = useState<{ 
    userId: string; 
    name: string; 
    email: string | null;
    phone: string | null;
  } | null>(null);
  
  // Form states
  const [reason, setReason] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'active' | 'denied' | 'banned'>('active');
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
  const { data: adminUserData, isLoading: loadingAdminData } = useAdminUserData();
  const { data: pendingOnboarding, isLoading: loadingPending } = usePendingOnboarding();
  const { data: adminActions, isLoading: loadingActions } = useAdminActions();
  const { data: announcements, isLoading: loadingAnnouncements } = useAdminAnnouncements();
  const { data: lowRepUsers } = useLowReputationUsers();

  // Mutations
  const suspendUser = useSuspendUser();
  const unsuspendUser = useUnsuspendUser();
  const approveOnboarding = useApproveOnboarding();
  const denyOnboarding = useDenyOnboarding();
  const changeAccessStatus = useChangeAccessStatus();
  const deleteUser = useDeleteUser();
  const adjustCredits = useAdjustUserCredits();
  const bulkAwardCredits = useBulkAwardCredits();
  const sendMassNotification = useSendMassNotification();
  const toggleAdminRole = useToggleAdminRole();
  const sendIndividualMessage = useSendIndividualMessage();
  const sendMultiUserMessage = useSendMultiUserMessage();

  // Filtered users
  const filteredUsers = useMemo(() => {
    if (!adminUserData) return [];
    
    return adminUserData.filter(u => {
      const matchesSearch = 
        u.display_name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email?.toLowerCase().includes(search.toLowerCase()) ||
        u.city?.toLowerCase().includes(search.toLowerCase()) ||
        u.phone?.toLowerCase().includes(search.toLowerCase());
      
      const matchesMindset = mindsetFilter === 'all' || 
        u.mindset_level?.toString() === mindsetFilter;
      
      const matchesStatus = statusFilter === 'all' || 
        (u.access_status || 'pending') === statusFilter;
      
      return matchesSearch && matchesMindset && matchesStatus;
    });
  }, [adminUserData, search, mindsetFilter, statusFilter]);

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

  const handleRemoveUser = () => {
    if (removeDialog) {
      deleteUser.mutate({ userId: removeDialog.userId, reason: reason || undefined });
      setRemoveDialog(null);
      setReason('');
    }
  };

  const handleAdjustCredits = () => {
    if (creditDialog && creditAmount && creditReason) {
      adjustCredits.mutate({
        userId: creditDialog.userId,
        amount: parseInt(creditAmount),
        reason: creditReason,
      });
      setCreditDialog(null);
      setCreditAmount('');
      setCreditReason('');
    }
  };

  const handleBulkAward = () => {
    if (creditAmount && creditReason && adminUserData) {
      // Filter users based on target audience
      let targetUserIds: string[] = [];
      if (messageTarget === 'all') {
        targetUserIds = adminUserData.map(u => u.user_id);
      } else if (messageTarget === 'mindset_level') {
        targetUserIds = adminUserData.filter(u => u.mindset_level === parseInt(messageTargetValue)).map(u => u.user_id);
      } else if (messageTarget === 'city') {
        targetUserIds = adminUserData.filter(u => u.city?.toLowerCase() === messageTargetValue.toLowerCase()).map(u => u.user_id);
      }
      
      bulkAwardCredits.mutate({
        userIds: targetUserIds,
        amount: parseInt(creditAmount),
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

  const handleSendMultiUserMessage = () => {
    if (selectedUsers.size > 0 && messageTitle && messageBody) {
      sendMultiUserMessage.mutate({
        userIds: Array.from(selectedUsers),
        title: messageTitle,
        message: messageBody,
        sendDm: deliveryMethods.dm,
        sendEmail: deliveryMethods.email,
        sendSms: deliveryMethods.sms,
      });
      setMultiUserMessageDialog(false);
      setSelectedUsers(new Set());
      setMessageTitle('');
      setMessageBody('');
      setDeliveryMethods({ email: true, sms: false, dm: true });
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const selectAllFilteredUsers = () => {
    setSelectedUsers(new Set(filteredUsers.map(u => u.user_id)));
  };

  const clearSelection = () => {
    setSelectedUsers(new Set());
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
            <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
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

        {/* Stats */}
        <div className="px-4 py-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{adminUserData?.length || 0}</div>
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
              <div className="text-2xl font-bold text-primary">{announcements?.length || 0}</div>
              <div className="text-sm text-muted-foreground">Announcements</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-orange-500">{lowRepUsers?.length || 0}</div>
              <div className="text-sm text-muted-foreground">Low Reputation</div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="px-4 pb-4 flex gap-2 flex-wrap">
          <Button onClick={() => setMassMessageDialog(true)} className="gap-2">
            <Send className="h-4 w-4" />
            Mass Message
          </Button>
          {selectedUsers.size > 0 && (
            <Button 
              onClick={() => setMultiUserMessageDialog(true)} 
              className="gap-2 bg-primary"
            >
              <MessageCircle className="h-4 w-4" />
              Message Selected ({selectedUsers.size})
            </Button>
          )}
          <Button variant="outline" onClick={() => setBulkCreditDialog(true)} className="gap-2">
            <Coins className="h-4 w-4" />
            Bulk Award Credits
          </Button>
          <Button 
            variant="outline" 
            onClick={() => adminUserData && exportUsersToCSV(adminUserData)} 
            className="gap-2"
            disabled={!adminUserData}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="users" className="px-4">
          <TabsList className="w-full grid grid-cols-5">
            <TabsTrigger value="users"><Users className="h-4 w-4" /></TabsTrigger>
            <TabsTrigger value="pending"><Clock className="h-4 w-4" /></TabsTrigger>
            <TabsTrigger value="messages"><MessageSquare className="h-4 w-4" /></TabsTrigger>
            <TabsTrigger value="flagged"><AlertTriangle className="h-4 w-4" /></TabsTrigger>
            <TabsTrigger value="history"><History className="h-4 w-4" /></TabsTrigger>
          </TabsList>

          {/* All Users Tab */}
          <TabsContent value="users" className="mt-4">
            <div className="space-y-4">
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, email, city, or phone..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={mindsetFilter} onValueChange={setMindsetFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Mindset" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="1">Level 1</SelectItem>
                    <SelectItem value="2">Level 2</SelectItem>
                    <SelectItem value="3">Level 3</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="denied">Denied</SelectItem>
                    <SelectItem value="banned">Banned</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Selection Controls */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Showing {filteredUsers.length} of {adminUserData?.length || 0} users
                  {selectedUsers.size > 0 && (
                    <span className="ml-2 text-primary font-medium">
                      ({selectedUsers.size} selected)
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={selectAllFilteredUsers}
                    disabled={filteredUsers.length === 0}
                  >
                    Select All ({filteredUsers.length})
                  </Button>
                  {selectedUsers.size > 0 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={clearSelection}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
              
              <ScrollArea className="h-[500px]">
                {loadingAdminData ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-16" />)}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredUsers.map(user => (
                      <Card 
                        key={user.user_id} 
                        className={`overflow-hidden transition-colors ${selectedUsers.has(user.user_id) ? 'ring-2 ring-primary bg-primary/5' : ''}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className="flex flex-col items-center gap-2">
                                <Checkbox
                                  checked={selectedUsers.has(user.user_id)}
                                  onCheckedChange={() => toggleUserSelection(user.user_id)}
                                  className="mt-1"
                                />
                                <Avatar className="h-10 w-10">
                                  <AvatarFallback>{user.display_name?.[0] || '?'}</AvatarFallback>
                                </Avatar>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                  <span className="font-semibold">{user.display_name || 'Unnamed'}</span>
                                  {user.is_admin && (
                                    <Badge className="bg-amber-500 text-white gap-1">
                                      <ShieldCheck className="h-3 w-3" />
                                      Admin
                                    </Badge>
                                  )}
                                  {getStatusBadge(user.access_status)}
                                  {getMindsetBadge(user.mindset_level)}
                                  <Badge variant="outline" className="gap-1">
                                    <Coins className="h-3 w-3" />
                                    {user.credit_balance}
                                  </Badge>
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-muted-foreground mb-2">
                                  {user.email && (
                                    <div className="flex items-center gap-1">
                                      <Mail className="h-3 w-3" />
                                      <span className="truncate">{user.email}</span>
                                    </div>
                                  )}
                                  {user.phone && (
                                    <div className="flex items-center gap-1">
                                      <Phone className="h-3 w-3" />
                                      {user.phone}
                                    </div>
                                  )}
                                  {user.city && (
                                    <div className="flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      {user.city}
                                    </div>
                                  )}
                                </div>

                                {/* Creative Roles */}
                                {user.creative_roles.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mb-1">
                                    <Briefcase className="h-3 w-3 text-muted-foreground mt-0.5" />
                                    {user.creative_roles.map((role, i) => (
                                      <Badge key={i} className="text-xs bg-primary/20 text-primary">{role}</Badge>
                                    ))}
                                  </div>
                                )}

                                {/* Skills */}
                                {user.skills.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mb-1">
                                    <Star className="h-3 w-3 text-muted-foreground mt-0.5" />
                                    {user.skills.map((skill, i) => (
                                      <Badge key={i} variant="secondary" className="text-xs">{skill}</Badge>
                                    ))}
                                  </div>
                                )}

                                {/* Passions */}
                                {user.passions.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    <Heart className="h-3 w-3 text-muted-foreground mt-0.5" />
                                    {user.passions.map((passion, i) => (
                                      <Badge key={i} variant="outline" className="text-xs">{passion}</Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setDetailDialog(user)}
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                View
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setCreditDialog({ 
                                  userId: user.user_id, 
                                  name: user.display_name || 'User',
                                  balance: user.credit_balance
                                })}
                              >
                                <Coins className="h-3 w-3 mr-1" />
                                Credits
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setStatusDialog({ 
                                  userId: user.user_id, 
                                  name: user.display_name || 'User',
                                  currentStatus: user.access_status || 'pending'
                                })}
                              >
                                Status
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setIndividualMessageDialog({ 
                                  userId: user.user_id, 
                                  name: user.display_name || 'User',
                                  email: user.email,
                                  phone: user.phone,
                                })}
                              >
                                <MessageCircle className="h-3 w-3 mr-1" />
                                Message
                              </Button>
                              <Button
                                size="sm"
                                variant={user.is_admin ? "destructive" : "outline"}
                                onClick={() => toggleAdminRole.mutate({ 
                                  userId: user.user_id, 
                                  makeAdmin: !user.is_admin 
                                })}
                                disabled={toggleAdminRole.isPending}
                              >
                                {user.is_admin ? (
                                  <>
                                    <ShieldOff className="h-3 w-3 mr-1" />
                                    Remove Admin
                                  </>
                                ) : (
                                  <>
                                    <ShieldCheck className="h-3 w-3 mr-1" />
                                    Make Admin
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </TabsContent>

          {/* Pending Onboarding Tab */}
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

          {/* Mass Messages Tab */}
          <TabsContent value="messages" className="mt-4">
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="text-lg">Announcement History</CardTitle>
                <CardDescription>Previous mass notifications sent to users</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[350px]">
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
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Flagged Users Tab */}
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

          {/* Action History Tab */}
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
                type="number"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
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
              <Select value={messageTarget} onValueChange={(v: any) => setMessageTarget(v)}>
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
              <Select value={messageTarget} onValueChange={(v: any) => setMessageTarget(v)}>
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

      {/* User Detail Dialog */}
      <Dialog open={!!detailDialog} onOpenChange={() => setDetailDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
          </DialogHeader>
          {detailDialog && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="text-xl">{detailDialog.display_name?.[0] || '?'}</AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold text-lg">{detailDialog.display_name || 'Unnamed'}</h3>
                  <div className="flex gap-2 mt-1">
                    {getStatusBadge(detailDialog.access_status)}
                    {getMindsetBadge(detailDialog.mindset_level)}
                    <Badge variant="outline" className="gap-1">
                      <Coins className="h-3 w-3" />
                      {detailDialog.credit_balance} credits
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{detailDialog.email || 'No email'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{detailDialog.city || 'No location'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{detailDialog.phone || 'No phone'}</span>
                </div>
              </div>

              {detailDialog.creative_roles?.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Creative Roles</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {detailDialog.creative_roles.map((role: string, i: number) => (
                      <Badge key={i} variant="outline">{role}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {detailDialog.skills?.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Skills</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {detailDialog.skills.map((skill: string, i: number) => (
                      <Badge key={i} variant="secondary">{skill}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {detailDialog.passions?.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Passions</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {detailDialog.passions.map((passion: string, i: number) => (
                      <Badge key={i} variant="outline" className="border-destructive/30">{passion}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailDialog(null)}>Close</Button>
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

      {/* Multi-User Message Dialog */}
      <Dialog open={multiUserMessageDialog} onOpenChange={setMultiUserMessageDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Message to {selectedUsers.size} Users</DialogTitle>
            <DialogDescription>
              Choose how to deliver this message to selected users
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Selected Users Preview */}
            <div className="bg-muted/50 rounded-lg p-3">
              <Label className="text-xs text-muted-foreground mb-2 block">Selected Recipients</Label>
              <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                {Array.from(selectedUsers).slice(0, 10).map(userId => {
                  const user = adminUserData?.find(u => u.user_id === userId);
                  return (
                    <Badge key={userId} variant="secondary" className="text-xs">
                      {user?.display_name || 'User'}
                    </Badge>
                  );
                })}
                {selectedUsers.size > 10 && (
                  <Badge variant="outline" className="text-xs">
                    +{selectedUsers.size - 10} more
                  </Badge>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <Label>Delivery Methods</Label>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="multi-dm-check"
                    checked={deliveryMethods.dm}
                    onCheckedChange={(checked) => 
                      setDeliveryMethods(prev => ({ ...prev, dm: !!checked }))
                    }
                  />
                  <label htmlFor="multi-dm-check" className="text-sm font-medium flex items-center gap-1">
                    <MessageCircle className="h-4 w-4" />
                    In-App Notification
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="multi-email-check"
                    checked={deliveryMethods.email}
                    onCheckedChange={(checked) => 
                      setDeliveryMethods(prev => ({ ...prev, email: !!checked }))
                    }
                  />
                  <label htmlFor="multi-email-check" className="text-sm font-medium flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    Email
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="multi-sms-check"
                    checked={deliveryMethods.sms}
                    onCheckedChange={(checked) => 
                      setDeliveryMethods(prev => ({ ...prev, sms: !!checked }))
                    }
                  />
                  <label htmlFor="multi-sms-check" className="text-sm font-medium flex items-center gap-1">
                    <Phone className="h-4 w-4" />
                    SMS
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
            <Button variant="outline" onClick={() => setMultiUserMessageDialog(false)}>Cancel</Button>
            <Button 
              onClick={handleSendMultiUserMessage} 
              disabled={
                !messageTitle || 
                !messageBody || 
                selectedUsers.size === 0 ||
                (!deliveryMethods.email && !deliveryMethods.sms && !deliveryMethods.dm) ||
                sendMultiUserMessage.isPending
              }
            >
              {sendMultiUserMessage.isPending ? 'Sending...' : `Send to ${selectedUsers.size} Users`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
};

export default Admin;