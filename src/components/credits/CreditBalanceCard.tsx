import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Flame, Sparkles, Info } from 'lucide-react';
import { SquircleIcon } from '@/components/world/SquircleIcon';
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
      <Card className={cn("relative overflow-hidden", className)}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SquircleIcon icon={isGenesis ? Flame : Sparkles} fill={isGenesis ? "gold" : "pink"} size={32} glyph={16} />
              <CardTitle className="ether-title text-[15px]">
                {isGenesis ? 'Genesis Credit' : 'Earned Credit'}
              </CardTitle>
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="inline-flex h-11 w-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground">
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
            <span className="font-body text-3xl font-extrabold tabular-nums text-foreground">
              {balance.toLocaleString()}
            </span>
            <span className="mono-label mb-1 text-[11px] text-muted-foreground">
              LC
            </span>
          </div>
          
          <div className="mt-2 flex items-center gap-2">
            <Badge 
              variant="outline" 
              className="mono-label text-[9px]"
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
      <Card className={cn("relative overflow-hidden", className)}>
        <CardHeader>
          <CardDescription className="kicker">
            // Balance
          </CardDescription>
          <CardTitle className="font-body text-4xl font-extrabold tabular-nums">
            {totalBalance.toLocaleString()} <span className="text-2xl text-muted-foreground font-medium">LC</span>
          </CardTitle>
        </CardHeader>
        
        <CardContent>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full bg-[#CAA07E]" />
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
                  className="bg-[#CAA07E] transition-all duration-500"
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
