import React, { useState } from 'react';
import { MapPin, Search, Filter, ExternalLink, Mail, Phone, Building2, ChevronRight } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { usePartners, usePartnerCategories, Partner, PartnerCategory } from '@/hooks/usePartners';
import { motion, AnimatePresence } from 'framer-motion';

const Partners: React.FC = () => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<PartnerCategory | 'all'>('all');
  const [cityFilter, setCityFilter] = useState('');
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);

  const categories = usePartnerCategories();
  const { data: partners, isLoading } = usePartners({
    category: categoryFilter === 'all' ? undefined : categoryFilter,
    city: cityFilter || undefined,
  });

  const filteredPartners = partners?.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description?.toLowerCase().includes(search.toLowerCase())
  );

  const getCategoryIcon = (category: PartnerCategory) => {
    return categories.find(c => c.value === category)?.icon || '📦';
  };

  return (
    <PageLayout>
      <div className="min-h-screen pb-20">
        {/* Header */}
        <div className="bg-gradient-to-b from-primary/10 to-background px-4 pt-6 pb-8">
          <h1 className="text-2xl font-bold mb-2">Partnerships</h1>
          <p className="text-muted-foreground">
            Exclusive benefits for LC members from our partner network
          </p>
        </div>

        {/* Filters */}
        <div className="px-4 py-4 space-y-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search partners..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as PartnerCategory | 'all')}>
              <SelectTrigger className="flex-1">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.icon} {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="City..."
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="flex-1"
            />
          </div>
        </div>

        {/* Partner Grid */}
        <div className="px-4 py-4">
          {isLoading ? (
            <div className="grid gap-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-32 rounded-xl" />
              ))}
            </div>
          ) : filteredPartners?.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium">No partners found</h3>
              <p className="text-sm text-muted-foreground">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="grid gap-4">
              <AnimatePresence>
                {filteredPartners?.map((partner, i) => (
                  <motion.div
                    key={partner.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card 
                      className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setSelectedPartner(partner)}
                    >
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          <Avatar className="h-16 w-16 rounded-lg">
                            <AvatarImage src={partner.logo_url || undefined} />
                            <AvatarFallback className="rounded-lg text-2xl">
                              {getCategoryIcon(partner.category)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h3 className="font-semibold truncate">{partner.name}</h3>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Badge variant="secondary" className="text-xs">
                                    {getCategoryIcon(partner.category)} {partner.category}
                                  </Badge>
                                  {partner.is_verified && (
                                    <Badge variant="default" className="text-xs">Verified</Badge>
                                  )}
                                </div>
                              </div>
                              <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                            </div>
                            {partner.city && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                                <MapPin className="h-3 w-3" />
                                {partner.city}, {partner.state}
                              </div>
                            )}
                            {partner.member_benefits && (
                              <p className="text-sm text-primary mt-2 line-clamp-1">
                                🎁 {partner.member_benefits}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Partner Detail Sheet */}
      <Sheet open={!!selectedPartner} onOpenChange={() => setSelectedPartner(null)}>
        <SheetContent className="overflow-y-auto">
          {selectedPartner && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedPartner.name}</SheetTitle>
              </SheetHeader>
              
              <div className="mt-6 space-y-6">
                {selectedPartner.cover_image_url && (
                  <img 
                    src={selectedPartner.cover_image_url} 
                    alt={selectedPartner.name}
                    className="w-full h-40 object-cover rounded-lg"
                  />
                )}

                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16 rounded-lg">
                    <AvatarImage src={selectedPartner.logo_url || undefined} />
                    <AvatarFallback className="rounded-lg text-2xl">
                      {getCategoryIcon(selectedPartner.category)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <Badge variant="secondary">
                      {getCategoryIcon(selectedPartner.category)} {selectedPartner.category}
                    </Badge>
                    {selectedPartner.is_verified && (
                      <Badge variant="default" className="ml-2">Verified</Badge>
                    )}
                  </div>
                </div>

                {selectedPartner.description && (
                  <div>
                    <h4 className="font-medium mb-2">About</h4>
                    <p className="text-sm text-muted-foreground">{selectedPartner.description}</p>
                  </div>
                )}

                {selectedPartner.member_benefits && (
                  <div className="bg-primary/10 rounded-lg p-4">
                    <h4 className="font-medium mb-2">🎁 Member Benefits</h4>
                    <p className="text-sm">{selectedPartner.member_benefits}</p>
                  </div>
                )}

                {selectedPartner.terms && (
                  <div>
                    <h4 className="font-medium mb-2">Terms</h4>
                    <p className="text-sm text-muted-foreground">{selectedPartner.terms}</p>
                  </div>
                )}

                {selectedPartner.address && (
                  <div>
                    <h4 className="font-medium mb-2">Location</h4>
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div>
                        <p>{selectedPartner.address}</p>
                        <p className="text-muted-foreground">
                          {selectedPartner.city}, {selectedPartner.state} {selectedPartner.country}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {selectedPartner.website_url && (
                    <Button variant="outline" className="w-full" asChild>
                      <a href={selectedPartner.website_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Visit Website
                      </a>
                    </Button>
                  )}
                  {selectedPartner.contact_email && (
                    <Button variant="outline" className="w-full" asChild>
                      <a href={`mailto:${selectedPartner.contact_email}`}>
                        <Mail className="h-4 w-4 mr-2" />
                        {selectedPartner.contact_email}
                      </a>
                    </Button>
                  )}
                  {selectedPartner.contact_phone && (
                    <Button variant="outline" className="w-full" asChild>
                      <a href={`tel:${selectedPartner.contact_phone}`}>
                        <Phone className="h-4 w-4 mr-2" />
                        {selectedPartner.contact_phone}
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </PageLayout>
  );
};

export default Partners;
