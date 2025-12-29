import { useState, useEffect } from 'react';
import { motion, Reorder } from 'framer-motion';
import { GripVertical, Eye, EyeOff, Maximize2, Minimize2, Square, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ProfileSection, useProfileLayout } from '@/hooks/useProfileLayout';

interface ProfileLayoutEditorProps {
  userId: string;
  open: boolean;
  onClose: () => void;
}

export function ProfileLayoutEditor({ userId, open, onClose }: ProfileLayoutEditorProps) {
  const { layout, saveLayout } = useProfileLayout(userId);
  const [sections, setSections] = useState<ProfileSection[]>(layout);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setSections(layout);
  }, [layout]);

  const handleReorder = (newOrder: ProfileSection[]) => {
    const updated = newOrder.map((section, index) => ({ ...section, order: index }));
    setSections(updated);
    setHasChanges(true);
  };

  const toggleVisibility = (id: string) => {
    setSections(prev => 
      prev.map(s => s.id === id ? { ...s, visible: !s.visible } : s)
    );
    setHasChanges(true);
  };

  const cycleSize = (id: string) => {
    const sizes: ('small' | 'medium' | 'large')[] = ['small', 'medium', 'large'];
    setSections(prev => 
      prev.map(s => {
        if (s.id !== id) return s;
        const currentIndex = sizes.indexOf(s.size);
        const nextIndex = (currentIndex + 1) % sizes.length;
        return { ...s, size: sizes[nextIndex] };
      })
    );
    setHasChanges(true);
  };

  const handleSave = async () => {
    await saveLayout.mutateAsync(sections);
    setHasChanges(false);
    onClose();
  };

  const handleCancel = () => {
    setSections(layout);
    setHasChanges(false);
    onClose();
  };

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm"
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-display text-xl font-semibold text-foreground">Edit Layout</h2>
            <p className="text-sm text-muted-foreground">Drag to reorder, tap icons to toggle</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
            <Button 
              size="sm" 
              onClick={handleSave}
              disabled={!hasChanges || saveLayout.isPending}
            >
              <Check className="w-4 h-4 mr-1" />
              Save
            </Button>
          </div>
        </div>

        {/* Reorderable List */}
        <div className="flex-1 overflow-y-auto p-5">
          <Reorder.Group 
            axis="y" 
            values={sections} 
            onReorder={handleReorder}
            className="space-y-2"
          >
            {sections.map((section) => (
              <Reorder.Item
                key={section.id}
                value={section}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-xl cursor-grab active:cursor-grabbing",
                  "bg-card border border-border",
                  !section.visible && "opacity-50"
                )}
              >
                {/* Drag Handle */}
                <GripVertical className="w-5 h-5 text-muted-foreground flex-shrink-0" />

                {/* Section Label */}
                <span className={cn(
                  "flex-1 font-medium",
                  section.visible ? "text-foreground" : "text-muted-foreground line-through"
                )}>
                  {section.label}
                </span>

                {/* Size Indicator */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8"
                  onClick={(e) => { e.stopPropagation(); cycleSize(section.id); }}
                  title={`Size: ${section.size}`}
                >
                  {section.size === 'small' && <Minimize2 className="w-4 h-4 text-muted-foreground" />}
                  {section.size === 'medium' && <Square className="w-4 h-4 text-muted-foreground" />}
                  {section.size === 'large' && <Maximize2 className="w-4 h-4 text-muted-foreground" />}
                </Button>

                {/* Visibility Toggle */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8"
                  onClick={(e) => { e.stopPropagation(); toggleVisibility(section.id); }}
                >
                  {section.visible ? (
                    <Eye className="w-4 h-4 text-primary" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-muted-foreground" />
                  )}
                </Button>
              </Reorder.Item>
            ))}
          </Reorder.Group>

          {/* Legend */}
          <div className="mt-6 p-4 rounded-xl bg-muted/50 text-sm text-muted-foreground">
            <p className="font-medium mb-2">Tips:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Drag items to change order</li>
              <li>Tap eye icon to show/hide sections</li>
              <li>Tap size icon to cycle between small/medium/large</li>
            </ul>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
