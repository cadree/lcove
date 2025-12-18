import { motion } from 'framer-motion';
import { ExternalLink, Handshake } from 'lucide-react';
import { useBrandPartnerships } from '@/hooks/useBrandPartnerships';
import { Skeleton } from '@/components/ui/skeleton';

interface BrandPartnersProps {
  className?: string;
}

export function BrandPartners({ className }: BrandPartnersProps) {
  const { data: partners, isLoading } = useBrandPartnerships();

  if (isLoading) {
    return (
      <div className={className}>
        <div className="flex items-center gap-2 mb-4">
          <Handshake className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-display text-lg font-medium">Our Partners</h3>
        </div>
        <div className="flex gap-6 overflow-x-auto pb-2">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="w-24 h-12 rounded-lg flex-shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  if (!partners || partners.length === 0) return null;

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-4">
        <Handshake className="w-5 h-5 text-muted-foreground" />
        <h3 className="font-display text-lg font-medium">Our Partners</h3>
      </div>

      <div className="flex flex-wrap gap-4">
        {partners.map((partner, index) => (
          <motion.a
            key={partner.id}
            href={partner.website_url || '#'}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            className="group"
          >
            <div className="glass-card rounded-xl p-4 hover:bg-accent/20 transition-all flex items-center gap-3 min-w-[140px]">
              {partner.brand_logo_url ? (
                <img 
                  src={partner.brand_logo_url} 
                  alt={partner.brand_name}
                  className="w-10 h-10 object-contain rounded-lg"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground">
                  {partner.brand_name.charAt(0)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {partner.brand_name}
                </p>
                <p className="text-xs text-muted-foreground capitalize">
                  {partner.partnership_type}
                </p>
              </div>
              {partner.website_url && (
                <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </div>
          </motion.a>
        ))}
      </div>
    </div>
  );
}
