import React, { useState } from 'react';
import { DollarSign, Plus, Check, Clock, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useGroupExpenses, useCreateExpense, useUpdateContribution, GroupExpense } from '@/hooks/useGroupChat';
import { useAuth } from '@/contexts/AuthContext';

interface GroupFundingProps {
  conversationId: string;
  participants: { user_id: string; display_name?: string; avatar_url?: string }[];
  isOwnerOrMod: boolean;
}

export const GroupFunding: React.FC<GroupFundingProps> = ({ 
  conversationId, 
  participants, 
  isOwnerOrMod 
}) => {
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [newExpense, setNewExpense] = useState({
    title: '',
    description: '',
    total_amount: 0,
  });

  const { data: expenses, isLoading } = useGroupExpenses(conversationId);
  const createExpense = useCreateExpense();
  const updateContribution = useUpdateContribution();

  const handleCreate = () => {
    createExpense.mutate({
      conversation_id: conversationId,
      title: newExpense.title,
      description: newExpense.description || undefined,
      total_amount: newExpense.total_amount,
      member_ids: participants.map(p => p.user_id),
    });
    setCreateOpen(false);
    setNewExpense({ title: '', description: '', total_amount: 0 });
  };

  const handleMarkPaid = (contributionId: string, amountOwed: number) => {
    updateContribution.mutate({
      id: contributionId,
      amount_paid: amountOwed,
      conversationId,
    });
  };

  const getTotalPaid = (expense: GroupExpense) => {
    return expense.contributions?.reduce((sum, c) => sum + Number(c.amount_paid), 0) || 0;
  };

  const getParticipantInfo = (userId: string) => {
    return participants.find(p => p.user_id === userId);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map(i => <Skeleton key={i} className="h-32" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Group Funding
        </h3>
        {isOwnerOrMod && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Add Expense
          </Button>
        )}
      </div>

      {/* Expenses List */}
      {expenses?.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <DollarSign className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No expenses yet</p>
            {isOwnerOrMod && (
              <Button variant="link" onClick={() => setCreateOpen(true)}>
                Add the first expense
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        expenses?.map(expense => {
          const totalPaid = getTotalPaid(expense);
          const progress = (totalPaid / expense.total_amount) * 100;

          return (
            <Card key={expense.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{expense.title}</CardTitle>
                    {expense.description && (
                      <p className="text-sm text-muted-foreground mt-1">{expense.description}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-lg">
                      ${expense.total_amount.toFixed(2)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      ${totalPaid.toFixed(2)} paid
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Progress value={progress} className="h-2 mb-4" />

                <div className="space-y-2">
                  {expense.contributions?.map(contrib => {
                    const participant = getParticipantInfo(contrib.user_id);
                    const isPaid = contrib.status === 'paid';
                    const isCurrentUser = contrib.user_id === user?.id;

                    return (
                      <div 
                        key={contrib.id} 
                        className="flex items-center justify-between py-2 border-b last:border-0"
                      >
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={participant?.avatar_url} />
                            <AvatarFallback>
                              {participant?.display_name?.[0] || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">
                            {participant?.display_name || 'Unknown'}
                            {isCurrentUser && ' (You)'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            ${Number(contrib.amount_owed).toFixed(2)}
                          </span>
                          {isPaid ? (
                            <Badge variant="default" className="gap-1">
                              <Check className="h-3 w-3" /> Paid
                            </Badge>
                          ) : isCurrentUser ? (
                            <Button 
                              size="sm" 
                              onClick={() => handleMarkPaid(contrib.id, Number(contrib.amount_owed))}
                            >
                              Mark Paid
                            </Button>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <Clock className="h-3 w-3" /> Pending
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Create Expense Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Group Expense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input
                value={newExpense.title}
                onChange={(e) => setNewExpense({ ...newExpense, title: e.target.value })}
                placeholder="e.g., Airbnb booking"
              />
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea
                value={newExpense.description}
                onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                placeholder="Additional details..."
              />
            </div>
            <div>
              <Label>Total Amount ($)</Label>
              <Input
                type="number"
                value={newExpense.total_amount || ''}
                onChange={(e) => setNewExpense({ ...newExpense, total_amount: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
              />
            </div>
            <div className="bg-muted p-3 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <Users className="h-4 w-4" />
                Split between {participants.length} members
              </div>
              {newExpense.total_amount > 0 && (
                <div className="text-sm">
                  <span className="font-medium">
                    ${(newExpense.total_amount / participants.length).toFixed(2)}
                  </span>
                  {' '}per person
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newExpense.title || newExpense.total_amount <= 0}>
              Add Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
