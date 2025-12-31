import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import PageLayout from "@/components/layout/PageLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Loader2, Plus, LayoutDashboard, MoreHorizontal, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateBoardDialog } from "@/components/boards/CreateBoardDialog";
import { useBoards } from "@/hooks/useBoards";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";

const Boards = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { boards, isLoading, deleteBoard } = useBoards();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  if (!user) {
    return (
      <PageLayout>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6">
          <h2 className="font-display text-2xl text-foreground">Sign in to view your boards</h2>
          <Button onClick={() => navigate("/auth")}>Sign In</Button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PageHeader
        title="Boards"
        description="Collaborative canvas workspaces"
        actions={
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            New Board
          </Button>
        }
      />

      <div className="px-5 pb-24">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : boards.length === 0 ? (
          <EmptyState
            icon={LayoutDashboard}
            title="No boards yet"
            description="Create your first board to start organizing ideas visually."
            action={{
              label: "Create Board",
              onClick: () => setShowCreateDialog(true),
            }}
          />
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {boards.map((board, index) => (
              <motion.div
                key={board.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card
                  className="p-4 cursor-pointer hover:border-primary/50 transition-all group"
                  onClick={() => navigate(`/boards/${board.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <LayoutDashboard className="w-4 h-4 text-primary flex-shrink-0" />
                        <h3 className="font-medium text-foreground truncate">
                          {board.title}
                        </h3>
                      </div>
                      {board.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {board.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Updated {formatDistanceToNow(new Date(board.updated_at), { addSuffix: true })}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteBoard.mutate(board.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      <CreateBoardDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </PageLayout>
  );
};

export default Boards;
