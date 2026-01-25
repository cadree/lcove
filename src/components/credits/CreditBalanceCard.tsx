import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Coins, Flame, Sparkles, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface CreditBalanceCardProps {
  type: 'genesis' | 'earned';
  balance: number;
  subtitle?: string;
  className?: string;
}

export const CreditBalanceCard: React.FC<CreditBalanceCardProps> = ({
  type,
  balance,
  subtitle,
  className,
}) => {
  const isGenesis = type === 'genesis';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={cn(
        "relative overflow-hidden",
        isGenesis 
          ? "bg-gradient-to-br from-orange-500/10 via-orange-400/5 to-background border-orange-500/20" 
          : "bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20",
        className
      )}>
        {/* Decorative element */}
        <div className={cn(
          "absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl opacity-30",
          isGenesis ? "bg-orange-500" : "bg-primary"
        )} />
        
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isGenesis ? (
                <div className="p-2 rounded-full bg-orange-500/10">
                  <Flame className="h-4 w-4 text-orange-500" />
                </div>
              ) : (
                <div className="p-2 rounded-full bg-primary/10">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
              )}
              <CardTitle className="text-base font-medium">
                {isGenesis ? 'Genesis Credit' : 'Earned Credit'}
              </CardTitle>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="text-muted-foreground hover:text-foreground transition-colors">
                    <Info className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs">
                  {isGenesis ? (
                    <p className="text-sm">
                      <span className="font-medium">Starter Credit</span> – Given to new members to kickstart collaboration. 
                      Burned when spent; recipient receives Earned Credit. Cannot be withdrawn.
                    </p>
                  ) : (
                    <p className="text-sm">
                      <span className="font-medium">Contribution Credit</span> – Earned through verified contributions. 
                      Full utility inside the community. Counts toward reputation.
                    </p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>
        
        <CardContent>
          <div className="flex items-end gap-2">
            <span className={cn(
              "text-3xl font-bold tabular-nums",
              isGenesis ? "text-orange-600 dark:text-orange-400" : "text-primary"
            )}>
              {balance.toLocaleString()}
            </span>
            <span className={cn(
              "text-lg font-medium mb-1",
              isGenesis ? "text-orange-500/70" : "text-primary/70"
            )}>
              LC
            </span>
          </div>
          
          <div className="mt-2 flex items-center gap-2">
            <Badge 
              variant="outline" 
              className={cn(
                "text-xs",
                isGenesis 
                  ? "border-orange-500/30 text-orange-600 dark:text-orange-400" 
                  : "border-primary/30 text-primary"
              )}
            >
              {isGenesis ? 'Starter' : 'Contribution-Backed'}
            </Badge>
            {subtitle && (
              <span className="text-xs text-muted-foreground">{subtitle}</span>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

interface TotalBalanceCardProps {
  genesisBalance: number;
  earnedBalance: number;
  className?: string;
}

export const TotalBalanceCard: React.FC<TotalBalanceCardProps> = ({
  genesisBalance,
  earnedBalance,
  className,
}) => {
  const totalBalance = genesisBalance + earnedBalance;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      <Card className={cn(
        "relative overflow-hidden bg-gradient-to-br from-card via-card to-muted/30",
        className
      )}>
        {/* Decorative elements */}
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-orange-500/5 blur-2xl" />
        
        <CardHeader>
          <CardDescription className="flex items-center gap-2">
            <Coins className="h-4 w-4" />
            Total Balance
          </CardDescription>
          <CardTitle className="text-4xl font-bold tabular-nums">
            {totalBalance.toLocaleString()} <span className="text-2xl text-muted-foreground font-medium">LC</span>
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-orange-500" />
              <span className="text-muted-foreground">Genesis:</span>
              <span className="font-medium">{genesisBalance.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-primary" />
              <span className="text-muted-foreground">Earned:</span>
              <span className="font-medium">{earnedBalance.toLocaleString()}</span>
            </div>
          </div>
          
          {/* Balance bar */}
          {totalBalance > 0 && (
            <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden flex">
              {genesisBalance > 0 && (
                <div 
                  className="bg-orange-500 transition-all duration-500"
                  style={{ width: `${(genesisBalance / totalBalance) * 100}%` }}
                />
              )}
              {earnedBalance > 0 && (
                <div 
                  className="bg-primary transition-all duration-500"
                  style={{ width: `${(earnedBalance / totalBalance) * 100}%` }}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};
