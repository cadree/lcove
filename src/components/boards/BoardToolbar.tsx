import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { StickyNote, Link, CheckSquare, Image } from "lucide-react";
import { BoardItemType } from "@/hooks/useBoardItems";

interface BoardToolbarProps {
  onAddItem: (type: BoardItemType) => void;
}

const toolbarItems: { type: BoardItemType; icon: React.ElementType; label: string }[] = [
  { type: 'note', icon: StickyNote, label: 'Add Note' },
  { type: 'link', icon: Link, label: 'Add Link' },
  { type: 'todo', icon: CheckSquare, label: 'Add Todo List' },
  { type: 'image', icon: Image, label: 'Add Image' },
];

export function BoardToolbar({ onAddItem }: BoardToolbarProps) {
  return (
    <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
      {toolbarItems.map(({ type, icon: Icon, label }) => (
        <Tooltip key={type}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onAddItem(type)}
            >
              <Icon className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{label}</p>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
