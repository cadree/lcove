import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Settings2, GripVertical, RotateCcw, Check } from "lucide-react";
import { useNavCustomization, allNavItems } from "@/hooks/useNavCustomization";
import { cn } from "@/lib/utils";
import { motion, Reorder } from "framer-motion";

interface NavCustomizationSheetProps {
  children?: React.ReactNode;
}

export function NavCustomizationSheet({ children }: NavCustomizationSheetProps) {
  const { 
    enabledIds, 
    toggleNavItem, 
    reorderNavItems, 
    resetToDefault,
  } = useNavCustomization();
  
  const [open, setOpen] = useState(false);
  const [orderedIds, setOrderedIds] = useState<string[]>(enabledIds);

  // Keep orderedIds in sync with enabledIds
  useEffect(() => {
    setOrderedIds(enabledIds.filter(id => allNavItems.some(item => item.id === id)));
  }, [enabledIds]);

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
  };

  const handleReorder = (newOrder: string[]) => {
    setOrderedIds(newOrder);
    reorderNavItems(newOrder);
  };

  const handleToggle = (id: string) => {
    toggleNavItem(id);
  };

  const handleReset = () => {
    resetToDefault();
  };

  const disabledItems = allNavItems.filter(item => !enabledIds.includes(item.id));

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        {children || (
          <Button variant="ghost" size="icon" className="h-9 w-9">
            <Settings2 className="h-4 w-4" />
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center justify-between">
            <span>Customize Navigation</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-muted-foreground text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Reset
            </Button>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 overflow-y-auto max-h-[calc(85vh-100px)] pb-8">
          {/* Active Items - Reorderable */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <Check className="h-4 w-4 text-primary" />
              Active ({enabledIds.length}/5)
            </h3>
            <p className="text-xs text-muted-foreground mb-3">
              Drag to reorder. Tap to remove.
            </p>
            
            <Reorder.Group
              axis="y"
              values={orderedIds}
              onReorder={handleReorder}
              className="space-y-2"
            >
              {orderedIds.map((id) => {
                const item = allNavItems.find(i => i.id === id);
                if (!item) return null;
                
                return (
                  <Reorder.Item
                    key={id}
                    value={id}
                    className="touch-none"
                  >
                    <motion.div
                      layout
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border/50",
                        "cursor-grab active:cursor-grabbing"
                      )}
                      whileDrag={{ scale: 1.02, boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <item.icon className="h-5 w-5 text-primary" />
                      </div>
                      <span className="flex-1 font-medium">{item.label}</span>
                      <Switch
                        checked={true}
                        onCheckedChange={() => handleToggle(id)}
                        disabled={enabledIds.length <= 3}
                      />
                    </motion.div>
                  </Reorder.Item>
                );
              })}
            </Reorder.Group>
          </div>

          {/* Available Items */}
          {disabledItems.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                Available
              </h3>
              <p className="text-xs text-muted-foreground mb-3">
                Tap to add to navigation.
              </p>
              
              <div className="space-y-2">
                {disabledItems.map((item) => (
                  <motion.div
                    key={item.id}
                    layout
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/30",
                      enabledIds.length >= 5 && "opacity-50"
                    )}
                  >
                    <div className="w-4 flex-shrink-0" />
                    <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center flex-shrink-0">
                      <item.icon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <span className="flex-1 text-muted-foreground">{item.label}</span>
                    <Switch
                      checked={false}
                      onCheckedChange={() => handleToggle(item.id)}
                      disabled={enabledIds.length >= 5}
                    />
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Info */}
          <div className="p-4 rounded-xl bg-primary/5 border border-primary/10">
            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Tip:</strong> You can have between 3-5 items in your navigation bar. 
              Drag items to change their order.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
