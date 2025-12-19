import React, { useState, KeyboardEvent, useEffect } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Shield, ArrowLeft, Search, User, RefreshCw, Save, X, Plus, Sparkles } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useIsAdmin, useAllUsers, useQuestionnaireResponses, useChangeAccessStatus } from '@/hooks/useAdmin';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';

const MAX_PASSIONS = 10;
const MIN_PASSION_LENGTH = 2;
const MAX_PASSION_LENGTH = 32;

interface UserProfile {
  id: string;
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  city: string | null;
  passions: string[] | null;
  mindset_level: number | null;
  access_status: string | null;
  onboarding_score: number | null;
  onboarding_completed: boolean | null;
}

const AdminOnboarding: React.FC = () => {
  const navigate = useNavigate();
  const { userId } = useParams<{ userId?: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isAdmin, isLoading: checkingAdmin } = useIsAdmin();
  const { data: allUsers, isLoading: loadingUsers } = useAllUsers();
  
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [editedPassions, setEditedPassions] = useState<string[]>([]);
  const [passionInput, setPassionInput] = useState('');
  const [passionError, setPassionError] = useState('');
  const [saving, setSaving] = useState(false);
  const [resetDialog, setResetDialog] = useState(false);
  const [resetting, setResetting] = useState(false);

  const { data: questionnaireData, isLoading: loadingQuestionnaire } = useQuestionnaireResponses(
    selectedUser?.user_id || ''
  );

  const changeAccessStatus = useChangeAccessStatus();

  // If userId is provided in URL, find and select that user
  useEffect(() => {
    if (userId && allUsers) {
      const foundUser = allUsers.find((u: any) => u.user_id === userId);
      if (foundUser) {
        const userProfile: UserProfile = {
          id: foundUser.id,
          user_id: foundUser.user_id,
          display_name: foundUser.display_name,
          avatar_url: foundUser.avatar_url,
          city: foundUser.city,
          passions: (foundUser as any).passions || null,
          mindset_level: (foundUser as any).mindset_level || null,
          access_status: (foundUser as any).access_status || null,
          onboarding_score: (foundUser as any).onboarding_score || null,
          onboarding_completed: foundUser.onboarding_completed,
        };
        setSelectedUser(userProfile);
        setEditedPassions(userProfile.passions || []);
      }
    }
  }, [userId, allUsers]);

  // Update editedPassions when selectedUser changes
  useEffect(() => {
    if (selectedUser) {
      setEditedPassions(selectedUser.passions || []);
    }
  }, [selectedUser]);

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

  const filteredUsers = allUsers?.filter((u: any) =>
    u.display_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.user_id?.toLowerCase().includes(search.toLowerCase())
  );

  const normalizePassion = (passion: string) => passion.trim().toLowerCase();

  const addPassion = (passionName: string) => {
    const trimmed = passionName.trim();
    setPassionError('');

    if (trimmed.length < MIN_PASSION_LENGTH) {
      setPassionError(`Passion must be at least ${MIN_PASSION_LENGTH} characters`);
      return false;
    }

    if (trimmed.length > MAX_PASSION_LENGTH) {
      setPassionError(`Passion must be ${MAX_PASSION_LENGTH} characters or less`);
      return false;
    }

    if (editedPassions.length >= MAX_PASSIONS) {
      setPassionError(`Maximum ${MAX_PASSIONS} passions allowed`);
      return false;
    }

    const isDuplicate = editedPassions.some(
      (p) => normalizePassion(p) === normalizePassion(trimmed)
    );

    if (isDuplicate) {
      setPassionError('This passion is already added');
      return false;
    }

    setEditedPassions([...editedPassions, trimmed]);
    setPassionInput('');
    return true;
  };

  const removePassion = (passionToRemove: string) => {
    setEditedPassions(editedPassions.filter((p) => p !== passionToRemove));
    setPassionError('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (passionInput.trim()) {
        addPassion(passionInput);
      }
    }
  };

  const handleSavePassions = async () => {
    if (!selectedUser) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ passions: editedPassions } as Record<string, unknown>)
        .eq('user_id', selectedUser.user_id);

      if (error) throw error;

      // Update local state
      setSelectedUser({ ...selectedUser, passions: editedPassions });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('Passions updated successfully');
    } catch (error) {
      console.error('Error saving passions:', error);
      toast.error('Failed to save passions');
    } finally {
      setSaving(false);
    }
  };

  const handleResetOnboarding = async () => {
    if (!selectedUser) return;

    setResetting(true);
    try {
      // Reset profile onboarding fields
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          access_status: 'pending',
          mindset_level: null,
          onboarding_score: null,
          onboarding_completed: false,
        } as Record<string, unknown>)
        .eq('user_id', selectedUser.user_id);

      if (profileError) throw profileError;

      // Delete questionnaire responses
      const { error: questionnaireError } = await supabase
        .from('questionnaire_responses')
        .delete()
        .eq('user_id', selectedUser.user_id);

      if (questionnaireError && questionnaireError.code !== 'PGRST116') {
        throw questionnaireError;
      }

      // Log admin action
      await supabase.from('admin_actions').insert({
        admin_id: user?.id,
        action_type: 'reset_onboarding',
        target_user_id: selectedUser.user_id,
        reason: 'Manual reset by admin',
      });

      // Update local state
      setSelectedUser({
        ...selectedUser,
        access_status: 'pending',
        mindset_level: null,
        onboarding_score: null,
        onboarding_completed: false,
      });

      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      queryClient.invalidateQueries({ queryKey: ['questionnaire-responses', selectedUser.user_id] });
      
      toast.success('Onboarding reset. User will be prompted to re-onboard on next login.');
      setResetDialog(false);
    } catch (error) {
      console.error('Error resetting onboarding:', error);
      toast.error('Failed to reset onboarding');
    } finally {
      setResetting(false);
    }
  };

  const handleStatusChange = (status: 'active' | 'denied' | 'banned') => {
    if (!selectedUser) return;
    changeAccessStatus.mutate(
      { userId: selectedUser.user_id, status },
      {
        onSuccess: () => {
          setSelectedUser({ ...selectedUser, access_status: status });
        },
      }
    );
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

  const hasPassionsChanged = JSON.stringify(editedPassions) !== JSON.stringify(selectedUser?.passions || []);

  return (
    <PageLayout>
      <div className="min-h-screen pb-20">
        {/* Header */}
        <div className="bg-gradient-to-b from-primary/10 to-background px-4 pt-6 pb-8">
          <div className="flex items-center gap-3 mb-2">
            <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Onboarding Review</h1>
          </div>
          <p className="text-muted-foreground ml-12">View and edit user onboarding data</p>
        </div>

        <div className="px-4 py-4">
          {/* User Search / Selection */}
          {!selectedUser ? (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users by name or ID..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>

              <ScrollArea className="h-[500px]">
                {loadingUsers ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredUsers?.map((u: any) => (
                      <Card
                        key={u.id}
                        className="cursor-pointer hover:bg-accent/50 transition-colors"
                        onClick={() => {
                          const userProfile: UserProfile = {
                            id: u.id,
                            user_id: u.user_id,
                            display_name: u.display_name,
                            avatar_url: u.avatar_url,
                            city: u.city,
                            passions: u.passions || null,
                            mindset_level: u.mindset_level || null,
                            access_status: u.access_status || null,
                            onboarding_score: u.onboarding_score || null,
                            onboarding_completed: u.onboarding_completed,
                          };
                          setSelectedUser(userProfile);
                          setEditedPassions(userProfile.passions || []);
                        }}
                      >
                        <CardContent className="p-3 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={u.avatar_url || undefined} />
                              <AvatarFallback>{u.display_name?.[0] || '?'}</AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium flex items-center gap-2 flex-wrap">
                                {u.display_name || 'Unnamed'}
                                {getStatusBadge(u.access_status)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {u.city || 'No location'}
                              </div>
                            </div>
                          </div>
                          <User className="h-4 w-4 text-muted-foreground" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Back to list */}
              <Button variant="ghost" onClick={() => setSelectedUser(null)} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to user list
              </Button>

              {/* User Header */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={selectedUser.avatar_url || undefined} />
                      <AvatarFallback className="text-xl">
                        {selectedUser.display_name?.[0] || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h2 className="text-xl font-bold">{selectedUser.display_name || 'Unnamed User'}</h2>
                      <p className="text-sm text-muted-foreground">{selectedUser.city || 'No location'}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        {getStatusBadge(selectedUser.access_status)}
                        {selectedUser.mindset_level && (
                          <Badge variant="outline">Level {selectedUser.mindset_level}</Badge>
                        )}
                        {selectedUser.onboarding_score !== null && (
                          <Badge variant="secondary">Score: {selectedUser.onboarding_score}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Status Control */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Access Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <Select
                      value={selectedUser.access_status || 'pending'}
                      onValueChange={(value) => handleStatusChange(value as 'active' | 'denied' | 'banned')}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="denied">Denied</SelectItem>
                        <SelectItem value="banned">Banned</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      className="gap-2 text-destructive hover:text-destructive"
                      onClick={() => setResetDialog(true)}
                    >
                      <RefreshCw className="h-4 w-4" />
                      Reset Onboarding
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Questionnaire Responses */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Questionnaire Responses</CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingQuestionnaire ? (
                    <Skeleton className="h-32" />
                  ) : questionnaireData ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-muted-foreground text-xs">Total Score</Label>
                          <p className="font-bold text-lg">{questionnaireData.total_score}</p>
                        </div>
                        <div>
                          <Label className="text-muted-foreground text-xs">Submitted</Label>
                          <p className="text-sm">
                            {new Date(questionnaireData.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <Separator />
                      <div>
                        <Label className="text-muted-foreground text-xs mb-2 block">Responses</Label>
                        <ScrollArea className="h-48">
                          <pre className="text-xs bg-secondary/50 p-3 rounded-lg overflow-auto">
                            {JSON.stringify(questionnaireData.responses, null, 2)}
                          </pre>
                        </ScrollArea>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">No questionnaire responses found</p>
                  )}
                </CardContent>
              </Card>

              {/* Passions Editor */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Passions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Add Passion Input */}
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder="Type a passion and press Enter..."
                      value={passionInput}
                      onChange={(e) => {
                        setPassionInput(e.target.value);
                        setPassionError('');
                      }}
                      onKeyDown={handleKeyDown}
                      className="h-12 pr-12"
                      maxLength={MAX_PASSION_LENGTH}
                    />
                    {passionInput.trim() && (
                      <button
                        type="button"
                        onClick={() => addPassion(passionInput)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-primary hover:bg-primary/10 rounded-full transition-colors"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    )}
                  </div>

                  {passionError && (
                    <p className="text-destructive text-xs">{passionError}</p>
                  )}

                  {/* Passions Tags */}
                  <div className="flex flex-wrap gap-2 min-h-[40px]">
                    <AnimatePresence>
                      {editedPassions.map((passion) => (
                        <motion.div
                          key={passion}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-full text-sm font-medium"
                        >
                          <span>{passion}</span>
                          <button
                            type="button"
                            onClick={() => removePassion(passion)}
                            className="ml-1 p-0.5 hover:bg-primary-foreground/20 rounded-full transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {editedPassions.length === 0 && (
                      <p className="text-muted-foreground text-sm">No passions set</p>
                    )}
                  </div>

                  {/* Save Button */}
                  {hasPassionsChanged && (
                    <Button onClick={handleSavePassions} disabled={saving} className="gap-2">
                      <Save className="h-4 w-4" />
                      {saving ? 'Saving...' : 'Save Passions'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Reset Onboarding Dialog */}
      <Dialog open={resetDialog} onOpenChange={setResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Onboarding</DialogTitle>
            <DialogDescription>
              This will reset {selectedUser?.display_name || 'this user'}'s onboarding status and force them to complete the questionnaire again on their next login.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 text-sm text-muted-foreground">
            <p>The following will be reset:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Access status → Pending</li>
              <li>Mindset level → Cleared</li>
              <li>Onboarding score → Cleared</li>
              <li>Questionnaire responses → Deleted</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleResetOnboarding}
              disabled={resetting}
            >
              {resetting ? 'Resetting...' : 'Reset Onboarding'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
};

export default AdminOnboarding;
