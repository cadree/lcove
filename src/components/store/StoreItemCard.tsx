import { StoreItem } from '@/hooks/useStore';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Package, Wrench, Building2, Coins } from 'lucide-react';

interface StoreItemCardProps {
  item: StoreItem;
  onClick?: () => void;
  showSeller?: boolean;
}

const typeIcons = {
  product: Package,
  service: Wrench,
  rental: Building2,
};

const typeColors = {
  product: 'bg-primary/20 text-primary',
  service: 'bg-accent/20 text-accent-foreground',
  rental: 'bg-secondary/20 text-secondary-foreground',
};

export const StoreItemCard = ({ item, onClick, showSeller = true }: StoreItemCardProps) => {
  const TypeIcon = typeIcons[item.type];
  const store = item.store as StoreItem['store'];
  const profile = store?.profile;

  return (
    <Card 
      className="group cursor-pointer overflow-hidden transition-all hover:shadow-lg hover:scale-[1.02] bg-card/80 backdrop-blur-sm border-border/50"
      onClick={onClick}
    >
      <div className="aspect-square relative overflow-hidden bg-muted">
        {item.images && item.images.length > 0 ? (
          <img 
            src={item.images[0]} 
            alt={item.title}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <TypeIcon className="w-16 h-16 text-muted-foreground/30" />
          </div>
        )}
        <Badge className={`absolute top-2 left-2 ${typeColors[item.type]}`}>
          <TypeIcon className="w-3 h-3 mr-1" />
          {item.type.charAt(0).toUpperCase() + item.type.slice(1)}
        </Badge>
      </div>

      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
            {item.title}
          </h3>
          {item.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {item.description}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            {item.price > 0 && (
              <span className="font-bold text-foreground">
                ${item.price.toFixed(2)}
              </span>
            )}
            {item.credits_price > 0 && (
              <span className="text-sm text-primary flex items-center gap-1">
                <Coins className="w-3 h-3" />
                {item.credits_price} LC
              </span>
            )}
            {item.price === 0 && item.credits_price === 0 && (
              <span className="text-sm text-muted-foreground">Contact for pricing</span>
            )}
          </div>

          {item.type === 'product' && item.inventory_count !== null && (
            <Badge variant={item.inventory_count > 0 ? 'secondary' : 'destructive'}>
              {item.inventory_count > 0 ? `${item.inventory_count} left` : 'Sold out'}
            </Badge>
          )}
        </div>

        {showSeller && profile && (
          <div className="flex items-center gap-2 pt-2 border-t border-border/50">
            <Avatar className="w-6 h-6">
              <AvatarImage src={profile.avatar_url || undefined} />
              <AvatarFallback className="text-xs">
                {profile.display_name?.charAt(0) || '?'}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground truncate">
              {profile.display_name || 'Anonymous'}
            </span>
          </div>
        )}

        {item.category && (
          <Badge variant="outline" className="text-xs">
            {item.category.name}
          </Badge>
        )}
      </CardContent>
    </Card>
  );
};
