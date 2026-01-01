import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { 
  StickyNote, 
  Link, 
  CheckSquare, 
  Image, 
  Minus, 
  LayoutGrid,
  Columns,
  MessageSquare,
  MoreHorizontal,
  Upload,
  Pencil,
  Trash2
} from "lucide-react";
import { BoardItemType } from "@/hooks/useBoardItems";

interface BoardSidebarProps {
  onAddItem: (type: BoardItemType) => void;
  isConnectMode?: boolean;
}

const sidebarItems: { type: BoardItemType; icon: React.ElementType; label: string }[] = [
  { type: 'note', icon: StickyNote, label: 'Note' },
  { type: 'link', icon: Link, label: 'Link' },
  { type: 'todo', icon: CheckSquare, label: 'To-do' },
  { type: 'line', icon: Minus, label: 'Connect' },
  { type: 'board_ref', icon: LayoutGrid, label: 'Board' },
  { type: 'column', icon: Columns, label: 'Column' },
];

export function BoardSidebar({ onAddItem, isConnectMode }: BoardSidebarProps) {
  return (
    <div className="w-16 bg-[#2a2a2a] border-r border-white/10 flex flex-col py-4">
      {/* Main tools */}
      <div className="flex flex-col items-center gap-1 px-2">
        {sidebarItems.map(({ type, icon: Icon, label }) => {
          const isActive = type === 'line' && isConnectMode;
          return (
            <Tooltip key={type} delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className={`w-12 h-12 flex flex-col items-center gap-1 rounded-lg transition-colors ${
                    isActive 
                      ? 'bg-primary text-primary-foreground' 
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                  onClick={() => onAddItem(type)}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px]">{label}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{type === 'line' ? 'Connect items with a line' : `Add ${label}`}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      {/* Divider */}
      <div className="my-4 mx-3 border-t border-white/10" />

      {/* Secondary tools */}
      <div className="flex flex-col items-center gap-1 px-2">
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              className="w-12 h-12 flex flex-col items-center gap-1 text-white/70 hover:text-white hover:bg-white/10 rounded-lg"
              onClick={() => onAddItem('image')}
            >
              <Image className="w-5 h-5" />
              <span className="text-[10px]">Add image</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Add Image</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              className="w-12 h-12 flex flex-col items-center gap-1 text-white/70 hover:text-white hover:bg-white/10 rounded-lg"
            >
              <Upload className="w-5 h-5" />
              <span className="text-[10px]">Upload</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Upload File</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              className="w-12 h-12 flex flex-col items-center gap-1 text-white/70 hover:text-white hover:bg-white/10 rounded-lg"
            >
              <Pencil className="w-5 h-5" />
              <span className="text-[10px]">Draw</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Draw</p>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Trash at bottom */}
      <div className="flex flex-col items-center gap-1 px-2">
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              className="w-12 h-12 flex flex-col items-center gap-1 text-white/50 hover:text-white hover:bg-white/10 rounded-lg"
            >
              <Trash2 className="w-5 h-5" />
              <span className="text-[10px]">Trash</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Trash</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
