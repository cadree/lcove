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
  Upload,
  Pencil,
  Trash2,
  FileDown
} from "lucide-react";
import { BoardItemType } from "@/hooks/useBoardItems";

interface BoardSidebarProps {
  onAddItem: (type: BoardItemType) => void;
  isConnectMode?: boolean;
  isDrawMode?: boolean;
  onToggleDrawMode?: () => void;
  onExportPDF?: () => void;
}

const sidebarItems: { type: BoardItemType; icon: React.ElementType; label: string }[] = [
  { type: 'note', icon: StickyNote, label: 'Note' },
  { type: 'link', icon: Link, label: 'Link' },
  { type: 'todo', icon: CheckSquare, label: 'To-do' },
  { type: 'line', icon: Minus, label: 'Connect' },
  { type: 'board_ref', icon: LayoutGrid, label: 'Board' },
  { type: 'column', icon: Columns, label: 'Column' },
];

export function BoardSidebar({ onAddItem, isConnectMode, isDrawMode, onToggleDrawMode, onExportPDF }: BoardSidebarProps) {
  return (
    <div className="w-14 sm:w-16 bg-[#2a2a2a] border-r border-white/10 flex flex-col py-2 sm:py-4 shrink-0">
      {/* Main tools */}
      <div className="flex flex-col items-center gap-1 px-2">
        {sidebarItems.map(({ type, icon: Icon, label }) => {
          const isActive = type === 'line' && isConnectMode;
          return (
            <Tooltip key={type} delayDuration={0}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  className={`w-10 h-10 sm:w-12 sm:h-12 flex flex-col items-center gap-0.5 sm:gap-1 rounded-lg transition-colors touch-manipulation ${
                    isActive 
                      ? 'bg-primary text-primary-foreground' 
                      : 'text-white/70 hover:text-white hover:bg-white/10 active:bg-white/20'
                  }`}
                  onClick={() => onAddItem(type)}
                >
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="text-[8px] sm:text-[10px]">{label}</span>
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
              className="w-10 h-10 sm:w-12 sm:h-12 flex flex-col items-center gap-0.5 sm:gap-1 text-white/70 hover:text-white hover:bg-white/10 active:bg-white/20 rounded-lg touch-manipulation"
              onClick={() => onAddItem('image')}
            >
              <Image className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-[8px] sm:text-[10px]">Image</span>
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
              className={`w-10 h-10 sm:w-12 sm:h-12 flex flex-col items-center gap-0.5 sm:gap-1 rounded-lg transition-colors touch-manipulation ${
                isDrawMode 
                  ? 'bg-primary text-primary-foreground' 
                  : 'text-white/70 hover:text-white hover:bg-white/10 active:bg-white/20'
              }`}
              onClick={onToggleDrawMode}
            >
              <Pencil className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-[8px] sm:text-[10px]">Draw</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Draw on canvas</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              className="w-10 h-10 sm:w-12 sm:h-12 flex flex-col items-center gap-0.5 sm:gap-1 text-white/70 hover:text-white hover:bg-white/10 active:bg-white/20 rounded-lg touch-manipulation"
              onClick={onExportPDF}
            >
              <FileDown className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-[8px] sm:text-[10px]">Export</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>Export to PDF</p>
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
              className="w-10 h-10 sm:w-12 sm:h-12 flex flex-col items-center gap-0.5 sm:gap-1 text-white/50 hover:text-white hover:bg-white/10 active:bg-white/20 rounded-lg touch-manipulation"
            >
              <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="text-[8px] sm:text-[10px]">Trash</span>
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
