import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  usePartnerApplications, 
  useAcceptPartnerApplication, 
  useRejectPartnerApplication,
  PartnerApplication 
} from '@/hooks/usePartnerApplicationsAdmin';
import { Building2, Globe, Mail, Phone, MapPin, CheckCircle, XCircle, Clock, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function PartnerApplicationsTab() {
  const [filter, setFilter] = useState<'pending' | 'accepted' | 'rejected' | undefined>('pending');
  const [acceptDialog, setAcceptDialog] = useState<PartnerApplication | null>(null);
  const [rejectDialog, setRejectDialog] = useState<PartnerApplication | null>(null);
  const [selectedType, setSelectedType] = useState<'sponsor' | 'collaborator' | 'supporter'>('collaborator');
  const [rejectReason, setRejectReason] = useState('');

  const { data: applications, isLoading } = usePartnerApplications(filter);
  const acceptMutation = useAcceptPartnerApplication();
  const rejectMutation = useRejectPartnerApplication();

  const handleAccept = () => {
    if (acceptDialog) {
      acceptMutation.mutate({
        applicationId: acceptDialog.id,
        partnershipType: selectedType,
      });
      setAcceptDialog(null);
    }
  };

  const handleReject = () => {
    if (rejectDialog && rejectReason) {
      rejectMutation.mutate({
        applicationId: rejectDialog.id,
        reason: rejectReason,
      });
      setRejectDialog(null);
      setRejectReason('');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'accepted':
        return <Badge className="bg-green-500/20 text-green-500"><CheckCircle className="h-3 w-3 mr-1" />Accepted</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  const getCategoryLabel = (category: string) => {
    const categories: Record<string, string> = {
      studio: '🎬 Studio',
      venue: '🏛️ Venue',
      cafe: '☕ Café',
      housing: '🏠 Housing',
      equipment: '📷 Equipment',
      transport: '🚗 Transport',
      service: '✨ Service',
      other: '📦 Other',
    };
    return categories[category] || category;
  };

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex gap-2">
        <Badge
          variant={filter === 'pending' ? 'default' : 'secondary'}
          className="cursor-pointer"
          onClick={() => setFilter('pending')}
        >
          Pending
        </Badge>
        <Badge
          variant={filter === 'accepted' ? 'default' : 'secondary'}
          className="cursor-pointer"
          onClick={() => setFilter('accepted')}
        >
          Accepted
        </Badge>
        <Badge
          variant={filter === 'rejected' ? 'default' : 'secondary'}
          className="cursor-pointer"
          onClick={() => setFilter('rejected')}
        >
          Rejected
        </Badge>
        <Badge
          variant={filter === undefined ? 'default' : 'secondary'}
          className="cursor-pointer"
          onClick={() => setFilter(undefined)}
        >
          All
        </Badge>
      </div>

      <ScrollArea className="h-[500px]">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
        ) : applications?.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No {filter || ''} applications</p>
          </div>
        ) : (
          <div className="space-y-3">
            {applications?.map(app => (
              <Card key={app.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-semibold">{app.business_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {getCategoryLabel(app.category)}
                        </div>
                      </div>
                    </div>
                    {getStatusBadge(app.status)}
                  </div>

                  {app.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                      {app.description}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground mb-3">
                    <div className="flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      <span className="truncate">{app.contact_email}</span>
                    </div>
                    {app.contact_phone && (
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {app.contact_phone}
                      </div>
                    )}
                    {app.city && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {app.city}{app.state ? `, ${app.state}` : ''}{app.country ? `, ${app.country}` : ''}
                      </div>
                    )}
                    {app.website_url && (
                      <a 
                        href={app.website_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        <Globe className="h-3 w-3" />
                        Website
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>

                  {app.member_benefits && (
                    <div className="bg-muted/50 rounded-lg p-2 mb-3">
                      <div className="text-xs font-medium mb-1">Proposed Benefit:</div>
                      <div className="text-xs text-muted-foreground">{app.member_benefits}</div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Applied {formatDistanceToNow(new Date(app.created_at), { addSuffix: true })}
                    </span>
                    
                    {app.status === 'pending' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setRejectDialog(app)}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => setAcceptDialog(app)}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Accept
                        </Button>
                      </div>
                    )}
                  </div>

                  {app.status === 'rejected' && app.rejection_reason && (
                    <div className="mt-3 p-2 bg-destructive/10 rounded-lg">
                      <div className="text-xs font-medium text-destructive">Rejection Reason:</div>
                      <div className="text-xs text-muted-foreground">{app.rejection_reason}</div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Accept Dialog */}
      <Dialog open={!!acceptDialog} onOpenChange={() => setAcceptDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Accept Partner Application</DialogTitle>
            <DialogDescription>
              Accept {acceptDialog?.business_name} as a brand partner
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Partnership Type</Label>
              <Select value={selectedType} onValueChange={(v: any) => setSelectedType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sponsor">Sponsor - Premium visibility & exclusive perks</SelectItem>
                  <SelectItem value="collaborator">Collaborator - Joint initiatives & events</SelectItem>
                  <SelectItem value="supporter">Supporter - Community benefits & discounts</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAcceptDialog(null)}>Cancel</Button>
            <Button onClick={handleAccept} disabled={acceptMutation.isPending}>
              Accept Partner
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={() => setRejectDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Partner Application</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting {rejectDialog?.business_name}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Rejection Reason</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Explain why this application is being rejected..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={handleReject} 
              disabled={!rejectReason || rejectMutation.isPending}
            >
              Reject Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
