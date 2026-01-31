import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageLayout from '@/components/layout/PageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  ArrowLeft, Building2, Upload, Save, Globe, MapPin, Image as ImageIcon, 
  CheckCircle, AlertCircle, Loader2, Trash2
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface PartnerProfile {
  id: string;
  brand_name: string;
  brand_logo_url: string | null;
  description: string | null;
  about_business: string | null;
  exclusive_offer: string | null;
  offer_code: string | null;
  offer_terms: string | null;
  website_url: string | null;
  contact_email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  gallery_images: string[] | null;
  partnership_type: string;
  is_active: boolean;
}

export default function PartnerPortal() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [formData, setFormData] = useState({
    brandName: '',
    description: '',
    aboutBusiness: '',
    exclusiveOffer: '',
    offerCode: '',
    offerTerms: '',
    websiteUrl: '',
    address: '',
    city: '',
    state: '',
    country: '',
  });

  // Fetch partner profile
  const { data: partnership, isLoading } = useQuery({
    queryKey: ['my-partnership', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('brand_partnerships')
        .select('*')
        .eq('owner_user_id', user.id)
        .maybeSingle();
      
      if (error) throw error;
      return data as PartnerProfile | null;
    },
    enabled: !!user,
  });

  // Initialize form with existing data
  useEffect(() => {
    if (partnership) {
      setFormData({
        brandName: partnership.brand_name || '',
        description: partnership.description || '',
        aboutBusiness: partnership.about_business || '',
        exclusiveOffer: partnership.exclusive_offer || '',
        offerCode: partnership.offer_code || '',
        offerTerms: partnership.offer_terms || '',
        websiteUrl: partnership.website_url || '',
        address: partnership.address || '',
        city: partnership.city || '',
        state: partnership.state || '',
        country: partnership.country || '',
      });
      if (partnership.brand_logo_url) {
        setLogoPreview(partnership.brand_logo_url);
      }
    }
  }, [partnership]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Partial<PartnerProfile>) => {
      if (!partnership) throw new Error('No partnership found');
      
      const { error } = await supabase
        .from('brand_partnerships')
        .update(data)
        .eq('id', partnership.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-partnership'] });
      queryClient.invalidateQueries({ queryKey: ['brand-partnerships'] });
      toast.success('Profile updated successfully!');
    },
    onError: (error: any) => {
      toast.error('Failed to update: ' + error.message);
    },
  });

  // Handle logo upload
  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  // Handle gallery upload
  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setGalleryFiles(prev => [...prev, ...files]);
  };

  // Save profile
  const handleSave = async () => {
    if (!partnership) return;
    
    let logoUrl = partnership.brand_logo_url;
    let galleryUrls = partnership.gallery_images || [];

    // Upload logo if changed
    if (logoFile) {
      const ext = logoFile.name.split('.').pop();
      const path = `partner-logos/${partnership.id}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(path, logoFile, { upsert: true });
      
      if (uploadError) {
        toast.error('Failed to upload logo: ' + uploadError.message);
        return;
      }
      
      const { data: urlData } = supabase.storage.from('media').getPublicUrl(path);
      logoUrl = urlData.publicUrl;
    }

    // Upload gallery images
    for (const file of galleryFiles) {
      const ext = file.name.split('.').pop();
      const path = `partner-gallery/${partnership.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(path, file);
      
      if (uploadError) {
        console.error('Failed to upload gallery image:', uploadError);
        continue;
      }
      
      const { data: urlData } = supabase.storage.from('media').getPublicUrl(path);
      galleryUrls.push(urlData.publicUrl);
    }

    updateMutation.mutate({
      brand_name: formData.brandName,
      description: formData.description,
      about_business: formData.aboutBusiness,
      exclusive_offer: formData.exclusiveOffer,
      offer_code: formData.offerCode,
      offer_terms: formData.offerTerms,
      website_url: formData.websiteUrl || null,
      address: formData.address || null,
      city: formData.city || null,
      state: formData.state || null,
      country: formData.country || null,
      brand_logo_url: logoUrl,
      gallery_images: galleryUrls.length > 0 ? galleryUrls : null,
    });

    setGalleryFiles([]);
  };

  // Activate partnership
  const handleActivate = () => {
    if (!partnership) return;
    
    // Basic validation
    if (!formData.brandName || !formData.description) {
      toast.error('Please fill in your brand name and description before going live');
      return;
    }
    
    updateMutation.mutate({ is_active: true });
  };

  // Remove gallery image
  const removeGalleryImage = (index: number) => {
    if (!partnership?.gallery_images) return;
    
    const newImages = [...partnership.gallery_images];
    newImages.splice(index, 1);
    
    updateMutation.mutate({ gallery_images: newImages.length > 0 ? newImages : null });
  };

  if (!user) {
    return (
      <PageLayout>
        <div className="container max-w-2xl py-12 px-4 text-center">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Sign in required</h2>
          <p className="text-muted-foreground mb-4">Please sign in to access your partner portal</p>
          <Button onClick={() => navigate('/auth')}>Sign In</Button>
        </div>
      </PageLayout>
    );
  }

  if (isLoading) {
    return (
      <PageLayout>
        <div className="container max-w-2xl py-6 px-4">
          <Skeleton className="h-8 w-48 mb-6" />
          <Skeleton className="h-64 w-full" />
        </div>
      </PageLayout>
    );
  }

  if (!partnership) {
    return (
      <PageLayout>
        <div className="container max-w-2xl py-12 px-4 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Partnership Found</h2>
          <p className="text-muted-foreground mb-4">
            You don't have an active partnership yet. Apply to become a brand partner first!
          </p>
          <Button onClick={() => navigate('/brand-partners')}>
            Apply for Partnership
          </Button>
        </div>
      </PageLayout>
    );
  }

  const getPartnershipTypeBadge = () => {
    const types: Record<string, { label: string; className: string }> = {
      sponsor: { label: 'Sponsor', className: 'bg-amber-500/20 text-amber-500' },
      collaborator: { label: 'Collaborator', className: 'bg-primary/20 text-primary' },
      supporter: { label: 'Supporter', className: 'bg-green-500/20 text-green-500' },
    };
    const type = types[partnership.partnership_type] || types.supporter;
    return <Badge className={type.className}>{type.label}</Badge>;
  };

  return (
    <PageLayout>
      <div className="container max-w-2xl py-6 px-4 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-display font-medium">Partner Portal</h1>
            <p className="text-sm text-muted-foreground">Customize your brand partnership profile</p>
          </div>
          {getPartnershipTypeBadge()}
        </div>

        {/* Status Card */}
        <Card className={`mb-6 ${partnership.is_active ? 'border-green-500/50 bg-green-500/5' : 'border-amber-500/50 bg-amber-500/5'}`}>
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {partnership.is_active ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-500" />
              )}
              <div>
                <div className="font-medium">
                  {partnership.is_active ? 'Profile is Live' : 'Profile Not Active'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {partnership.is_active 
                    ? 'Your partnership is visible to community members' 
                    : 'Complete your profile and activate to go live'}
                </div>
              </div>
            </div>
            {!partnership.is_active && (
              <Button onClick={handleActivate} disabled={updateMutation.isPending}>
                Go Live
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Logo Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Brand Logo</CardTitle>
            <CardDescription>Upload your company logo</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20 rounded-xl">
                <AvatarImage src={logoPreview || undefined} />
                <AvatarFallback className="rounded-xl bg-primary/10">
                  <Building2 className="h-8 w-8 text-primary" />
                </AvatarFallback>
              </Avatar>
              <div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoChange}
                  className="hidden"
                  id="logo-upload"
                />
                <label htmlFor="logo-upload">
                  <Button variant="outline" asChild>
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Logo
                    </span>
                  </Button>
                </label>
                <p className="text-xs text-muted-foreground mt-1">
                  Recommended: 200x200px, PNG or JPG
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Basic Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="brandName">Brand Name</Label>
              <Input
                id="brandName"
                value={formData.brandName}
                onChange={(e) => setFormData({ ...formData, brandName: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="description">Short Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of your business"
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="aboutBusiness">About Your Business</Label>
              <Textarea
                id="aboutBusiness"
                value={formData.aboutBusiness}
                onChange={(e) => setFormData({ ...formData, aboutBusiness: e.target.value })}
                placeholder="Detailed information about your business, history, and what makes you unique"
                rows={4}
              />
            </div>
            <div>
              <Label htmlFor="websiteUrl">Website</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="websiteUrl"
                  type="url"
                  value={formData.websiteUrl}
                  onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                  placeholder="https://"
                  className="pl-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Location
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Street address"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="country">Country</Label>
                <Input
                  id="country"
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Exclusive Offer */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Exclusive Offer</CardTitle>
            <CardDescription>Set up your exclusive deal for community members</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="exclusiveOffer">Offer Description</Label>
              <Textarea
                id="exclusiveOffer"
                value={formData.exclusiveOffer}
                onChange={(e) => setFormData({ ...formData, exclusiveOffer: e.target.value })}
                placeholder="e.g., 20% off all services for Ether members"
                rows={2}
              />
            </div>
            <div>
              <Label htmlFor="offerCode">Offer Code (optional)</Label>
              <Input
                id="offerCode"
                value={formData.offerCode}
                onChange={(e) => setFormData({ ...formData, offerCode: e.target.value })}
                placeholder="e.g., ETHER20"
              />
            </div>
            <div>
              <Label htmlFor="offerTerms">Terms & Conditions</Label>
              <Textarea
                id="offerTerms"
                value={formData.offerTerms}
                onChange={(e) => setFormData({ ...formData, offerTerms: e.target.value })}
                placeholder="Any restrictions or conditions for the offer"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Gallery */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Gallery
            </CardTitle>
            <CardDescription>Add photos of your business, products, or services</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Existing images */}
            {partnership.gallery_images && partnership.gallery_images.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-4">
                {partnership.gallery_images.map((url, idx) => (
                  <div key={idx} className="relative aspect-square rounded-lg overflow-hidden group">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeGalleryImage(idx)}
                      className="absolute top-1 right-1 p-1 bg-background/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Pending uploads preview */}
            {galleryFiles.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-4">
                {galleryFiles.map((file, idx) => (
                  <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border-2 border-dashed border-primary/50">
                    <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                    <Badge className="absolute bottom-1 left-1 text-xs">Pending</Badge>
                  </div>
                ))}
              </div>
            )}

            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleGalleryChange}
              className="hidden"
              id="gallery-upload"
            />
            <label htmlFor="gallery-upload">
              <Button variant="outline" asChild>
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  Add Photos
                </span>
              </Button>
            </label>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="fixed bottom-20 left-0 right-0 p-4 bg-background/80 backdrop-blur border-t">
          <div className="container max-w-2xl">
            <Button 
              onClick={handleSave} 
              className="w-full" 
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
