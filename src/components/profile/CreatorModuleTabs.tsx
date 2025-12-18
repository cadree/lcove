import React from 'react';
import { Camera, Utensils, Music2, Clapperboard, Plus, Play, Image as ImageIcon } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  useCreatorRoles, 
  usePortfolio, 
  useMenu, 
  useDJMixes, 
  useDanceVideos,
  CREATOR_ROLE_CONFIG,
  CreatorRoleType
} from '@/hooks/useCreatorModules';

interface CreatorModuleTabsProps {
  userId: string;
  isOwner: boolean;
}

export const CreatorModuleTabs: React.FC<CreatorModuleTabsProps> = ({ userId, isOwner }) => {
  const { data: roles, isLoading: loadingRoles } = useCreatorRoles(userId);
  const { data: portfolio, isLoading: loadingPortfolio } = usePortfolio(userId);
  const { data: menu, isLoading: loadingMenu } = useMenu(userId);
  const { data: mixes, isLoading: loadingMixes } = useDJMixes(userId);
  const { data: danceVideos, isLoading: loadingDance } = useDanceVideos(userId);

  if (loadingRoles) {
    return <Skeleton className="h-40" />;
  }

  if (!roles || roles.length === 0) {
    return null;
  }

  const activeRoles = roles.filter(r => r.is_active);
  if (activeRoles.length === 0) return null;

  const getTabIcon = (role: CreatorRoleType) => {
    switch (role) {
      case 'model':
      case 'photographer':
        return <Camera className="h-4 w-4" />;
      case 'chef':
        return <Utensils className="h-4 w-4" />;
      case 'dj':
      case 'musician':
        return <Music2 className="h-4 w-4" />;
      case 'dancer':
        return <Play className="h-4 w-4" />;
      case 'filmmaker':
        return <Clapperboard className="h-4 w-4" />;
      default:
        return <ImageIcon className="h-4 w-4" />;
    }
  };

  return (
    <Tabs defaultValue={activeRoles[0]?.role_type} className="w-full">
      <TabsList className="w-full flex overflow-x-auto">
        {activeRoles.map(role => (
          <TabsTrigger key={role.id} value={role.role_type} className="flex-shrink-0">
            {getTabIcon(role.role_type)}
            <span className="ml-1">{CREATOR_ROLE_CONFIG[role.role_type].tab}</span>
          </TabsTrigger>
        ))}
      </TabsList>

      {/* Portfolio Tab (Models/Photographers) */}
      {activeRoles.some(r => r.role_type === 'model' || r.role_type === 'photographer') && (
        <TabsContent value="model" className="mt-4">
          <TabsContent value="photographer" className="mt-4">
            {loadingPortfolio ? (
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="aspect-square" />)}
              </div>
            ) : portfolio?.length === 0 ? (
              <EmptyState 
                message="No portfolio items yet" 
                showAdd={isOwner} 
                onAdd={() => {}}
              />
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {portfolio?.map(item => (
                  <div key={item.id} className="aspect-square rounded-lg overflow-hidden bg-muted">
                    {item.media_type === 'video' ? (
                      <video src={item.media_url} className="w-full h-full object-cover" />
                    ) : (
                      <img src={item.media_url} alt={item.title || ''} className="w-full h-full object-cover" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </TabsContent>
      )}

      {/* Menu Tab (Chefs) */}
      {activeRoles.some(r => r.role_type === 'chef') && (
        <TabsContent value="chef" className="mt-4">
          {loadingMenu ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : menu?.length === 0 ? (
            <EmptyState 
              message="No menu items yet" 
              showAdd={isOwner}
              onAdd={() => {}}
            />
          ) : (
            <div className="space-y-3">
              {menu?.map(item => (
                <Card key={item.id}>
                  <CardContent className="p-3 flex gap-3">
                    {item.image_url && (
                      <img 
                        src={item.image_url} 
                        alt={item.name}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-medium">{item.name}</h4>
                          {item.category && (
                            <Badge variant="secondary" className="text-xs mt-1">{item.category}</Badge>
                          )}
                        </div>
                        {item.price && (
                          <span className="font-semibold">${item.price}</span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      )}

      {/* Mixes Tab (DJs) */}
      {activeRoles.some(r => r.role_type === 'dj') && (
        <TabsContent value="dj" className="mt-4">
          {loadingMixes ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : mixes?.length === 0 ? (
            <EmptyState 
              message="No mixes yet" 
              showAdd={isOwner}
              onAdd={() => {}}
            />
          ) : (
            <div className="space-y-3">
              {mixes?.map(mix => (
                <Card key={mix.id}>
                  <CardContent className="p-3 flex gap-3">
                    {mix.cover_art_url ? (
                      <img 
                        src={mix.cover_art_url} 
                        alt={mix.title}
                        className="w-16 h-16 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <Music2 className="h-6 w-6 text-white" />
                      </div>
                    )}
                    <div className="flex-1">
                      <h4 className="font-medium">{mix.title}</h4>
                      {mix.genre && (
                        <Badge variant="secondary" className="text-xs mt-1">{mix.genre}</Badge>
                      )}
                      {mix.duration_seconds && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {Math.floor(mix.duration_seconds / 60)}:{(mix.duration_seconds % 60).toString().padStart(2, '0')}
                        </p>
                      )}
                    </div>
                    {mix.audio_url && (
                      <Button size="sm" variant="ghost">
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      )}

      {/* Dance Videos Tab (Dancers) */}
      {activeRoles.some(r => r.role_type === 'dancer') && (
        <TabsContent value="dancer" className="mt-4">
          {loadingDance ? (
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3, 4].map(i => <Skeleton key={i} className="aspect-video" />)}
            </div>
          ) : danceVideos?.length === 0 ? (
            <EmptyState 
              message="No dance videos yet" 
              showAdd={isOwner}
              onAdd={() => {}}
            />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {danceVideos?.map(video => (
                <Card key={video.id} className="overflow-hidden">
                  <div className="aspect-video relative bg-muted">
                    {video.thumbnail_url ? (
                      <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" />
                    ) : (
                      <video src={video.video_url} className="w-full h-full object-cover" />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
                      <Play className="h-8 w-8 text-white" />
                    </div>
                    {video.is_choreography && (
                      <Badge className="absolute top-2 left-2 text-xs">Choreography</Badge>
                    )}
                  </div>
                  <CardContent className="p-2">
                    <h4 className="font-medium text-sm truncate">{video.title}</h4>
                    {video.style && (
                      <p className="text-xs text-muted-foreground">{video.style}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      )}
    </Tabs>
  );
};

const EmptyState: React.FC<{ message: string; showAdd: boolean; onAdd: () => void }> = ({ 
  message, 
  showAdd, 
  onAdd 
}) => (
  <div className="text-center py-8">
    <p className="text-muted-foreground mb-4">{message}</p>
    {showAdd && (
      <Button onClick={onAdd}>
        <Plus className="h-4 w-4 mr-2" />
        Add
      </Button>
    )}
  </div>
);
