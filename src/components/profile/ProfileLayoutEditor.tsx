import { useState, useEffect } from 'react';
import { motion, Reorder, useDragControls } from 'framer-motion';
import { GripVertical, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
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

  const setSize = (id: string, size: ProfileSection['size']) => {
    setSections(prev => prev.map(section => section.id === id ? { ...section, size } : section));
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
        <div className="safe-header flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-display text-xl font-semibold text-foreground">Edit Layout</h2>
            <p className="text-sm text-muted-foreground">Use the grip to reorder. Choose a size and visibility.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="min-h-11" onClick={handleCancel}>
              <X className="w-4 h-4 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm" className="min-h-11"
              onClick={handleSave}
              disabled={!hasChanges || saveLayout.isPending}
            >
              <Check className="w-4 h-4 mr-1" />
              Save
            </Button>
          </div>
        </div>

        {/* Reorderable List */}
        <div className="safe-footer flex-1 min-h-0 overflow-y-auto p-5">
          <Reorder.Group
            axis="y"
            values={sections}
            onReorder={handleReorder}
            className="space-y-2"
          >
            {sections.map((section) => (
              <LayoutRow key={section.id} section={section} onSize={setSize} onToggle={toggleVisibility} />
            ))}
          </Reorder.Group>

          {/* Legend */}
          <div className="mt-6 p-4 rounded-xl bg-muted/50 text-sm text-muted-foreground">
            <p className="font-medium mb-2">Tips:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Drag the grip to change order</li>
              <li>Use the visibility switch to show or hide sections</li>
              <li>Choose Small, Medium, or Large from the size control</li>
            </ul>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function LayoutRow({ section, onSize, onToggle }: {
  section: ProfileSection;
  onSize: (id: string, size: ProfileSection['size']) => void;
  onToggle: (id: string) => void;
}) {
  const controls = useDragControls();
  return <Reorder.Item value={section} dragListener={false} dragControls={controls}
    className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
    <button type="button" aria-label={`Reorder ${section.label}`} className="flex h-11 w-11 touch-none items-center justify-center cursor-grab"
      onPointerDown={event => controls.start(event)}>
      <GripVertical className="h-5 w-5" />
    </button>
    <span className="min-w-0 flex-1 font-medium">{section.label}</span>
    <label className="flex items-center gap-2 text-sm">
      <span className="sr-only">Size of {section.label}</span>
      <select aria-label={`Size of ${section.label}`} value={section.size}
        onChange={event => onSize(section.id, event.target.value as ProfileSection['size'])}
        className="min-h-11 rounded-md border border-border bg-background px-2">
        <option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option>
      </select>
    </label>
    <label className="flex min-h-11 items-center gap-2 px-2 text-sm">
      <Switch aria-label={`Show ${section.label}`} checked={section.visible} onCheckedChange={() => onToggle(section.id)} />
      {section.visible ? 'Shown' : 'Hidden'}
    </label>
  </Reorder.Item>;
}
