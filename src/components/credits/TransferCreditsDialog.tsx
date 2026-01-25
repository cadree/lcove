import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTransferCredits, useCredits } from '@/hooks/useCredits';
import { useUserSearch } from '@/hooks/useUserSearch';
import { Search, Send, Flame, Coins, AlertCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface TransferCreditsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TransferCreditsDialog: React.FC<TransferCreditsDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string; avatar?: string } | null>(null);
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');

  const { genesisBalance, earnedBalance, balance } = useCredits();
  const { data: users = [], isLoading: isSearching } = useUserSearch(searchQuery);
  const { mutate: transfer, isPending } = useTransferCredits();

  const numAmount = parseInt(amount) || 0;
  const genesisToSpend = Math.min(numAmount, genesisBalance);
  const earnedToSpend = Math.max(0, numAmount - genesisBalance);
  const isValidAmount = numAmount > 0 && numAmount <= balance;

  const handleTransfer = () => {
    if (!selectedUser || !isValidAmount || isPending) return;

    transfer({
      recipient_id: selectedUser.id,
      amount: numAmount,
      message: message || undefined,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        setSelectedUser(null);
        setAmount('');
        setMessage('');
        setSearchQuery('');
      },
      onError: (error) => {
        // Error is already handled by the hook's toast, but we keep the dialog open
        console.error('Transfer failed:', error);
      }
    });
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelectedUser(null);
    setAmount('');
    setMessage('');
    setSearchQuery('');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Send LC Credit
          </DialogTitle>
          <DialogDescription>
            Transfer credits to another community member
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Recipient Selection */}
          {!selectedUser ? (
            <div className="space-y-2">
              <Label>Find Recipient</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              {searchQuery.length >= 2 && (
                <ScrollArea className="h-48 rounded-md border">
                  {isSearching ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Searching...
                    </div>
                  ) : users.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No users found
                    </div>
                  ) : (
                    <div className="p-2 space-y-1">
                      {users.map((user) => (
                        <button
                          key={user.user_id}
                          onClick={() => setSelectedUser({
                            id: user.user_id,
                            name: user.display_name || 'Unknown',
                            avatar: user.avatar_url || undefined,
                          })}
                          className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors text-left"
                        >
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={user.avatar_url || undefined} />
                            <AvatarFallback>
                              {(user.display_name || 'U')[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{user.display_name}</p>
                            {user.city && (
                              <p className="text-xs text-muted-foreground">{user.city}</p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
              <Avatar className="h-10 w-10">
                <AvatarImage src={selectedUser.avatar} />
                <AvatarFallback>{selectedUser.name[0].toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium">{selectedUser.name}</p>
                <p className="text-xs text-muted-foreground">Recipient</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedUser(null)}
              >
                Change
              </Button>
            </div>
          )}

          {/* Amount Input */}
          <div className="space-y-2">
            <Label>Amount</Label>
            <div className="relative">
              <Coins className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="number"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-9"
                min={1}
                max={balance}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                LC
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Available: {balance.toLocaleString()} LC ({genesisBalance} Genesis + {earnedBalance} Earned)
            </p>
          </div>

          {/* Credit Type Preview */}
          {numAmount > 0 && (
            <div className={cn(
              "p-3 rounded-lg border",
              genesisToSpend > 0 ? "bg-orange-500/10 border-orange-500/30" : "bg-primary/10 border-primary/30"
            )}>
              <div className="flex items-start gap-2">
                {genesisToSpend > 0 ? (
                  <Flame className="h-4 w-4 text-orange-500 mt-0.5" />
                ) : (
                  <Coins className="h-4 w-4 text-primary mt-0.5" />
                )}
                <div className="text-sm">
                  {genesisToSpend > 0 && (
                    <p>
                      <span className="font-medium text-orange-600">{genesisToSpend} Genesis Credit</span>
                      <span className="text-muted-foreground"> will be burned</span>
                    </p>
                  )}
                  {earnedToSpend > 0 && (
                    <p>
                      <span className="font-medium text-primary">{earnedToSpend} Earned Credit</span>
                      <span className="text-muted-foreground"> will be transferred</span>
                    </p>
                  )}
                  <p className="text-muted-foreground mt-1">
                    Recipient receives {numAmount} Earned Credit
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Genesis Burn Warning */}
          {genesisToSpend > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-orange-700 dark:text-orange-300">
                Genesis Credit is burned when spent. The recipient will receive Earned Credit instead.
              </p>
            </div>
          )}

          {/* Message */}
          <div className="space-y-2">
            <Label>Message (optional)</Label>
            <Textarea
              placeholder="Thanks for your help on the project!"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={!selectedUser || !isValidAmount || isPending}
          >
            {isPending ? 'Sending...' : `Send ${numAmount || 0} LC`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
