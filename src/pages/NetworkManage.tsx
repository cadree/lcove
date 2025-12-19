import { useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Film,
  Plus,
  Settings,
  Users,
  Eye,
  DollarSign,
  Inbox,
  Tv,
  Trash2,
  Edit,
  MoreVertical,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useNetwork, NetworkContent } from '@/hooks/useCinema';
import { useNetworkContentManage, useDeleteContent, useTogglePublish } from '@/hooks/useNetworkContentManage';
import { useAuth } from '@/contexts/AuthContext';
import { AddContentDialog } from '@/components/cinema/AddContentDialog';
import { EditContentDialog } from '@/components/cinema/EditContentDialog';
import { ContentDetailManageDialog } from '@/components/cinema/ContentDetailManageDialog';
import { NetworkSettingsDialog } from '@/components/cinema/NetworkSettingsDialog';
import { cn } from '@/lib/utils';

const NetworkManage = () => {
  const { networkId } = useParams<{ networkId: string }>();
  const { user } = useAuth();
  const [addContentOpen, setAddContentOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editContent, setEditContent] = useState<NetworkContent | null>(null);
  const [viewContent, setViewContent] = useState<NetworkContent | null>(null);
  const [deleteContent, setDeleteContent] = useState<NetworkContent | null>(null);

  const { data: network, isLoading: networkLoading } = useNetwork(networkId || '');
  const { data: content = [], isLoading: contentLoading } = useNetworkContentManage(networkId || '');
  const deleteContentMutation = useDeleteContent();
  const togglePublish = useTogglePublish();

  // Redirect if not owner
  if (!networkLoading && network && user?.id !== network.owner_id) {
    return <Navigate to={`/cinema/network/${networkId}`} replace />;
  }

  if (networkLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!network) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <Film className="w-16 h-16 text-muted-foreground" />
        <h1 className="text-xl font-medium">Network not found</h1>
        <Link to="/cinema">
          <Button variant="outline">Back to Cinema</Button>
        </Link>
      </div>
    );
  }

  const shortFilms = content.filter((c) => c.content_type === 'short_film');
  const tvShows = content.filter((c) => c.content_type === 'tv_show');
  const featureFilms = content.filter((c) => c.content_type === 'feature_film');

  const handleEdit = (item: NetworkContent) => {
    setEditContent(item);
  };

  const handleView = (item: NetworkContent) => {
    setViewContent(item);
  };

  const handleDelete = (item: NetworkContent) => {
    setDeleteContent(item);
  };

  const confirmDelete = async () => {
    if (deleteContent) {
      await deleteContentMutation.mutateAsync({
        contentId: deleteContent.id,
        networkId: networkId!,
      });
      setDeleteContent(null);
    }
  };

  const handleTogglePublish = async (item: NetworkContent) => {
    await togglePublish.mutateAsync({
      contentId: item.id,
      isPublished: !item.is_published,
    });
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="border-b border-border bg-card/50">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Link to="/cinema">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-3 flex-1">
              {network.logo_url && (
                <img
                  src={network.logo_url}
                  alt=""
                  className="w-12 h-12 rounded-xl object-cover"
                />
              )}
              <div>
                <h1 className="font-display text-2xl font-bold">{network.name}</h1>
                <p className="text-sm text-muted-foreground">Network Dashboard</p>
              </div>
            </div>
            <Button variant="outline" onClick={() => setSettingsOpen(true)}>
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
            <Link to={`/cinema/network/${networkId}`}>
              <Button variant="outline">
                <Eye className="w-4 h-4 mr-2" />
                View Network
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              icon={<Users className="w-5 h-5" />}
              label="Subscribers"
              value={network.subscriber_count}
            />
            <StatCard
              icon={<Eye className="w-5 h-5" />}
              label="Total Views"
              value={network.total_views}
            />
            <StatCard
              icon={<Film className="w-5 h-5" />}
              label="Content"
              value={content.length}
            />
            <StatCard
              icon={<DollarSign className="w-5 h-5" />}
              label="Monthly"
              value={network.is_paid ? `$${network.subscription_price}` : 'Free'}
            />
          </div>
        </div>
      </div>

      {/* Content Management */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Tabs defaultValue="content">
          <div className="flex items-center justify-between mb-6">
            <TabsList>
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="submissions">
                Submissions
                <Badge variant="secondary" className="ml-2">0</Badge>
              </TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>
            
            <Button onClick={() => setAddContentOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Content
            </Button>
          </div>

          <TabsContent value="content" className="space-y-8">
            {contentLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : content.length === 0 ? (
              <div className="text-center py-16 bg-muted/30 rounded-xl">
                <Film className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-medium mb-2">No content yet</h3>
                <p className="text-muted-foreground mb-4">
                  Start adding films and shows to your network
                </p>
                <Button onClick={() => setAddContentOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Your First Content
                </Button>
              </div>
            ) : (
              <>
                {/* Short Films */}
                {shortFilms.length > 0 && (
                  <ContentSection
                    title="Short Films"
                    icon={<Film className="w-5 h-5" />}
                    items={shortFilms}
                    onEdit={handleEdit}
                    onView={handleView}
                    onDelete={handleDelete}
                    onTogglePublish={handleTogglePublish}
                  />
                )}

                {/* Feature Films */}
                {featureFilms.length > 0 && (
                  <ContentSection
                    title="Feature Films"
                    icon={<Film className="w-5 h-5" />}
                    items={featureFilms}
                    onEdit={handleEdit}
                    onView={handleView}
                    onDelete={handleDelete}
                    onTogglePublish={handleTogglePublish}
                  />
                )}

                {/* TV Shows */}
                {tvShows.length > 0 && (
                  <ContentSection
                    title="TV Shows"
                    icon={<Tv className="w-5 h-5" />}
                    items={tvShows}
                    onEdit={handleEdit}
                    onView={handleView}
                    onDelete={handleDelete}
                    onTogglePublish={handleTogglePublish}
                  />
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="submissions">
            <div className="text-center py-16 bg-muted/30 rounded-xl">
              <Inbox className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-medium mb-2">No pending submissions</h3>
              <p className="text-muted-foreground">
                When creators submit content to your network, it will appear here
              </p>
            </div>
          </TabsContent>

          <TabsContent value="analytics">
            <div className="text-center py-16 bg-muted/30 rounded-xl">
              <Eye className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-medium mb-2">Analytics coming soon</h3>
              <p className="text-muted-foreground">
                Detailed viewing analytics and subscriber insights
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <AddContentDialog
        open={addContentOpen}
        onOpenChange={setAddContentOpen}
        networkId={networkId!}
      />

      <EditContentDialog
        open={!!editContent}
        onOpenChange={(open) => !open && setEditContent(null)}
        content={editContent}
      />

      <ContentDetailManageDialog
        open={!!viewContent}
        onOpenChange={(open) => !open && setViewContent(null)}
        content={viewContent}
        onEdit={() => {
          setEditContent(viewContent);
          setViewContent(null);
        }}
      />

      <NetworkSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        network={network}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteContent} onOpenChange={(open) => !open && setDeleteContent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Content</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteContent?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteContentMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// Stat Card Component
const StatCard = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) => (
  <div className="p-4 rounded-lg bg-muted/30 border border-border">
    <div className="flex items-center gap-2 text-muted-foreground mb-1">
      {icon}
      <span className="text-sm">{label}</span>
    </div>
    <p className="text-2xl font-bold">{value}</p>
  </div>
);

// Content Section Component
const ContentSection = ({
  title,
  icon,
  items,
  onEdit,
  onView,
  onDelete,
  onTogglePublish,
}: {
  title: string;
  icon: React.ReactNode;
  items: NetworkContent[];
  onEdit: (item: NetworkContent) => void;
  onView: (item: NetworkContent) => void;
  onDelete: (item: NetworkContent) => void;
  onTogglePublish: (item: NetworkContent) => void;
}) => (
  <div>
    <h2 className="font-display text-lg font-semibold flex items-center gap-2 mb-4">
      {icon}
      {title}
      <Badge variant="secondary">{items.length}</Badge>
    </h2>
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {items.map((item) => (
        <ContentManageCard 
          key={item.id} 
          content={item} 
          onEdit={() => onEdit(item)}
          onView={() => onView(item)}
          onDelete={() => onDelete(item)}
          onTogglePublish={() => onTogglePublish(item)}
        />
      ))}
    </div>
  </div>
);

// Content Manage Card Component
const ContentManageCard = ({ 
  content,
  onEdit,
  onView,
  onDelete,
  onTogglePublish,
}: { 
  content: NetworkContent;
  onEdit: () => void;
  onView: () => void;
  onDelete: () => void;
  onTogglePublish: () => void;
}) => (
  <div className="group relative">
    <div 
      className="aspect-[2/3] rounded-lg overflow-hidden bg-muted cursor-pointer"
      onClick={onView}
    >
      {content.cover_art_url ? (
        <img
          src={content.cover_art_url}
          alt={content.title}
          className="w-full h-full object-cover transition-transform group-hover:scale-105"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
          <Film className="w-10 h-10 text-muted-foreground" />
        </div>
      )}
      
      {/* Badges */}
      <div className="absolute top-2 left-2 flex flex-col gap-1">
        {content.is_featured && (
          <Badge className="text-xs bg-amber-500">Featured</Badge>
        )}
        {!content.is_published && (
          <Badge variant="secondary" className="text-xs">Draft</Badge>
        )}
      </div>

      {/* Hover Overlay */}
      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <Eye className="w-8 h-8 text-white" />
      </div>

      {/* Actions */}
      <div 
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="secondary" className="h-8 w-8">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onTogglePublish}>
              <Eye className="w-4 h-4 mr-2" />
              {content.is_published ? 'Unpublish' : 'Publish'}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={onDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
    
    <div className="mt-2">
      <h3 className="font-medium text-sm truncate">{content.title}</h3>
      <p className="text-xs text-muted-foreground">
        {content.view_count} views
      </p>
    </div>
  </div>
);

export default NetworkManage;
