import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, GripVertical, Sparkles, DollarSign, Share2, Heart, Target } from "lucide-react";
import type { ExclusiveAccessRule } from "@/hooks/useExclusiveMusic";

const RULE_TYPE_CONFIG = {
  purchase: { icon: DollarSign, label: "One-Time Purchase", color: "text-green-500" },
  subscription: { icon: Heart, label: "Page Subscription", color: "text-pink-500" },
  challenge: { icon: Target, label: "Fan Challenge", color: "text-amber-500" },
  tip_goal: { icon: Sparkles, label: "Tip Goal", color: "text-purple-500" },
  share_unlock: { icon: Share2, label: "Share to Unlock", color: "text-blue-500" },
};

interface AccessRuleEditorProps {
  rules: ExclusiveAccessRule[];
  onCreateRule: (rule: Partial<ExclusiveAccessRule>) => void;
  onUpdateRule: (rule: Partial<ExclusiveAccessRule> & { id: string }) => void;
  onDeleteRule: (ruleId: string) => void;
  trackId?: string | null;
}

export const AccessRuleEditor = ({
  rules,
  onCreateRule,
  onUpdateRule,
  onDeleteRule,
  trackId,
}: AccessRuleEditorProps) => {
  const [showAdd, setShowAdd] = useState(false);
  const [newType, setNewType] = useState("purchase");
  const [newLabel, setNewLabel] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newInterval, setNewInterval] = useState("monthly");
  const [newPlatform, setNewPlatform] = useState("instagram");
  const [newRequiresProof, setNewRequiresProof] = useState(false);

  const filteredRules = rules.filter((r) =>
    trackId ? r.track_id === trackId || r.track_id === null : true
  );

  const handleAdd = () => {
    const isChallenge = newType === "challenge";
    onCreateRule({
      track_id: trackId,
      rule_type: newType,
      label: newLabel || RULE_TYPE_CONFIG[newType as keyof typeof RULE_TYPE_CONFIG]?.label || newType,
      description: newDescription || undefined,
      amount_cents: isChallenge ? 0 : Math.round(parseFloat(newAmount || "0") * 100),
      interval: newType === "subscription" ? newInterval : undefined,
      metadata: isChallenge
        ? { platform: newPlatform, instructions: newDescription, requires_proof: newRequiresProof }
        : {},
      sort_order: filteredRules.length,
    });
    setShowAdd(false);
    setNewLabel("");
    setNewDescription("");
    setNewAmount("");
    setNewRequiresProof(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground">
          Access Rules
        </h4>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAdd(!showAdd)}
          className="text-xs"
        >
          <Plus className="w-3 h-3 mr-1" /> Add Rule
        </Button>
      </div>

      {/* Existing rules */}
      {filteredRules.map((rule) => {
        const config = RULE_TYPE_CONFIG[rule.rule_type as keyof typeof RULE_TYPE_CONFIG];
        const Icon = config?.icon || DollarSign;
        return (
          <div
            key={rule.id}
            className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 border border-border/30"
          >
            <GripVertical className="w-4 h-4 text-muted-foreground mt-0.5 cursor-grab" />
            <Icon className={`w-4 h-4 mt-0.5 ${config?.color || "text-foreground"}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{rule.label || rule.rule_type}</p>
              {rule.description && (
                <p className="text-xs text-muted-foreground">{rule.description}</p>
              )}
              {rule.amount_cents > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  ${(rule.amount_cents / 100).toFixed(2)}
                  {rule.interval ? `/${rule.interval}` : ""}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Switch
                checked={rule.is_active}
                onCheckedChange={(checked) =>
                  onUpdateRule({ id: rule.id, is_active: checked })
                }
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                onClick={() => onDeleteRule(rule.id)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        );
      })}

      {/* Add new rule form */}
      {showAdd && (
        <div className="p-4 rounded-lg bg-muted/20 border border-border/40 space-y-3">
          <div className="space-y-2">
            <Label className="text-xs">Type</Label>
            <Select value={newType} onValueChange={setNewType}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(RULE_TYPE_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>
                    <span className="flex items-center gap-2">
                      <cfg.icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                      {cfg.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Label (visible to fans)</Label>
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder={
                RULE_TYPE_CONFIG[newType as keyof typeof RULE_TYPE_CONFIG]?.label || "Label"
              }
              className="h-9"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Description (make it fun! 🎉)</Label>
            <Textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="e.g. Share this track on 3 platforms and unlock it for free!"
              className="min-h-[60px]"
            />
          </div>

          {(newType === "purchase" || newType === "subscription" || newType === "tip_goal") && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Price ($)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    placeholder="0.00"
                    className="h-9"
                  />
                </div>
                {newType === "subscription" && (
                  <div className="space-y-2">
                    <Label className="text-xs">Billing</Label>
                    <Select value={newInterval} onValueChange={setNewInterval}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              {newType === "purchase" && (parseFloat(newAmount || "0") <= 0) && (
                <p className="text-[11px] text-amber-500">
                  ⚠️ Set a price above $0 — or skip this rule and rely on the Fan Challenge to unlock for free.
                </p>
              )}
            </div>
          )}

          {newType === "challenge" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-xs">Platform</Label>
                <Select value={newPlatform} onValueChange={setNewPlatform}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                    <SelectItem value="x">X (Twitter)</SelectItem>
                    <SelectItem value="other">Other / Anywhere</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2">
                <div>
                  <Label className="text-xs">Require proof</Label>
                  <p className="text-[11px] text-muted-foreground">
                    Fans must upload a screenshot or paste a link.
                  </p>
                </div>
                <Switch checked={newRequiresProof} onCheckedChange={setNewRequiresProof} />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAdd}>
              Add
            </Button>
          </div>
        </div>
      )}

      {filteredRules.length === 0 && !showAdd && (
        <p className="text-xs text-muted-foreground text-center py-3">
          No access rules yet. Add one to monetize your music!
        </p>
      )}
    </div>
  );
};
