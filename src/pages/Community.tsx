import React, { useState } from 'react';
import { Megaphone, Star, FileText, BarChart3, Plus, Pin } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCommunityUpdates, useCreateCommunityUpdate, UPDATE_CATEGORY_CONFIG, UpdateCategory } from '@/hooks/useCommunityUpdates';
import { useIsAdmin } from '@/hooks/useAdmin';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

const Community: React.FC = () => {
  const [activeTab, setActiveTab] = useState<UpdateCategory | 'all'>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [newUpdate, setNewUpdate] = useState({
    title: '',
    content: '',
    category: 'announcement' as UpdateCategory,
    image_url: '',
    is_pinned: false,
  });

  const { isAdmin } = useIsAdmin();
  const { data: updates, isLoading } = useCommunityUpdates(activeTab === 'all' ? undefined : activeTab);
  const createUpdate = useCreateCommunityUpdate();

  const handleCreate = () => {
    createUpdate.mutate(newUpdate);
    setCreateOpen(false);
    setNewUpdate({ title: '', content: '', category: 'announcement', image_url: '', is_pinned: false });
  };

  const getCategoryIcon = (category: UpdateCategory) => {
    switch (category) {
      case 'announcement': return <Megaphone className="h-4 w-4" />;
      case 'spotlight': return <Star className="h-4 w-4" />;
      case 'update': return <FileText className="h-4 w-4" />;
      case 'transparency': return <BarChart3 className="h-4 w-4" />;
    }
  };

  return (
    <PageLayout>
      <div className="min-h-screen pb-20">
        {/* Header */}
        <div className="bg-gradient-to-b from-primary/10 to-background px-4 pt-6 pb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-2">Community</h1>
              <p className="text-muted-foreground">Updates, spotlights, and transparency</p>
            </div>
            {isAdmin && (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Post
              </Button>
            )}
          </div>
        </div>

        {/* Category Tabs */}
        <div className="px-4 py-4">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as UpdateCategory | 'all')}>
            <TabsList className="w-full grid grid-cols-5">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="announcement"><Megaphone className="h-4 w-4" /></TabsTrigger>
              <TabsTrigger value="spotlight"><Star className="h-4 w-4" /></TabsTrigger>
              <TabsTrigger value="update"><FileText className="h-4 w-4" /></TabsTrigger>
              <TabsTrigger value="transparency"><BarChart3 className="h-4 w-4" /></TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Updates List */}
        <div className="px-4 space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-40" />)}
            </div>
          ) : updates?.length === 0 ? (
            <div className="text-center py-12">
              <Megaphone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium">No updates yet</h3>
              <p className="text-sm text-muted-foreground">Check back soon for community news</p>
            </div>
          ) : (
            <AnimatePresence>
              {updates?.map((update, i) => (
                <motion.div
                  key={update.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Card className={update.is_pinned ? 'border-primary' : ''}>
                    {update.image_url && (
                      <div className="relative">
                        <img 
                          src={update.image_url} 
                          alt={update.title}
                          className="w-full h-40 object-cover rounded-t-lg"
                        />
                        {update.is_pinned && (
                          <div className="absolute top-2 right-2">
                            <Badge variant="secondary" className="gap-1">
                              <Pin className="h-3 w-3" /> Pinned
                            </Badge>
                          </div>
                        )}
                      </div>
                    )}
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant="secondary" 
                            className={UPDATE_CATEGORY_CONFIG[update.category as UpdateCategory].color + ' text-white'}
                          >
                            {getCategoryIcon(update.category as UpdateCategory)}
                            <span className="ml-1">{UPDATE_CATEGORY_CONFIG[update.category as UpdateCategory].label}</span>
                          </Badge>
                          {update.is_pinned && !update.image_url && (
                            <Pin className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(update.published_at), { addSuffix: true })}
                        </span>
                      </div>
                      <CardTitle className="text-lg">{update.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {update.content}
                      </p>
                      {update.author && (
                        <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={update.author.avatar_url || undefined} />
                            <AvatarFallback>{update.author.display_name?.[0] || '?'}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-muted-foreground">
                            {update.author.display_name}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Create Update Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Update</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Category</Label>
              <Select 
                value={newUpdate.category} 
                onValueChange={(v) => setNewUpdate({ ...newUpdate, category: v as UpdateCategory })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(UPDATE_CATEGORY_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.icon} {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Title</Label>
              <Input
                value={newUpdate.title}
                onChange={(e) => setNewUpdate({ ...newUpdate, title: e.target.value })}
                placeholder="Update title..."
              />
            </div>
            <div>
              <Label>Content</Label>
              <Textarea
                value={newUpdate.content}
                onChange={(e) => setNewUpdate({ ...newUpdate, content: e.target.value })}
                placeholder="Write your update..."
                rows={5}
              />
            </div>
            <div>
              <Label>Image URL (optional)</Label>
              <Input
                value={newUpdate.image_url}
                onChange={(e) => setNewUpdate({ ...newUpdate, image_url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="pinned"
                checked={newUpdate.is_pinned}
                onChange={(e) => setNewUpdate({ ...newUpdate, is_pinned: e.target.checked })}
              />
              <Label htmlFor="pinned">Pin this update</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newUpdate.title || !newUpdate.content}>
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
};

export default Community;
