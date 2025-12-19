import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Handshake, Building2, Gift, FileText, Globe, Mail, Phone, MapPin, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePartnerCategories } from '@/hooks/usePartners';
import { useCreatePartnerApplication } from '@/hooks/usePartnerApplications';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const partnerApplicationSchema = z.object({
  business_name: z.string().min(2, 'Business name is required').max(100),
  category: z.enum(['studio', 'venue', 'cafe', 'housing', 'equipment', 'transport', 'service', 'other']),
  description: z.string().min(20, 'Please provide at least 20 characters').max(1000),
  contribution: z.string().min(30, 'Please describe what you bring to the table (at least 30 characters)').max(2000),
  member_benefits: z.string().min(10, 'Please describe the benefits for members').max(500),
  website_url: z.string().url('Please enter a valid URL').optional().or(z.literal('')),
  contact_email: z.string().email('Please enter a valid email'),
  contact_phone: z.string().optional(),
  city: z.string().min(2, 'City is required'),
  state: z.string().optional(),
  country: z.string().min(2, 'Country is required'),
  address: z.string().optional(),
});

type PartnerApplicationForm = z.infer<typeof partnerApplicationSchema>;

interface PartnerApplicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PartnerApplicationDialog({ open, onOpenChange }: PartnerApplicationDialogProps) {
  const { user } = useAuth();
  const categories = usePartnerCategories();
  const createApplication = useCreatePartnerApplication();

  const form = useForm<PartnerApplicationForm>({
    resolver: zodResolver(partnerApplicationSchema),
    defaultValues: {
      business_name: '',
      category: 'service',
      description: '',
      contribution: '',
      member_benefits: '',
      website_url: '',
      contact_email: '',
      contact_phone: '',
      city: '',
      state: '',
      country: '',
      address: '',
    },
  });

  const onSubmit = async (data: PartnerApplicationForm) => {
    if (!user) {
      toast.error('Please sign in to submit an application');
      return;
    }

    try {
      await createApplication.mutateAsync({
        ...data,
        user_id: user.id,
        website_url: data.website_url || null,
        contact_phone: data.contact_phone || null,
        state: data.state || null,
        address: data.address || null,
      });
      form.reset();
      onOpenChange(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Handshake className="h-5 w-5 text-primary" />
            Become a Partner
          </DialogTitle>
          <DialogDescription>
            Join our partner network and offer exclusive benefits to LC members. Tell us what you bring to the table.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
            {/* Business Info */}
            <FormField
              control={form.control}
              name="business_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Business / Organization Name
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Your business name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.icon} {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>About Your Business</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Tell us about your business or organization..."
                      className="min-h-[80px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* What They Bring */}
            <FormField
              control={form.control}
              name="contribution"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    What You Bring to the Table
                  </FormLabel>
                  <FormDescription>
                    Describe your resources, expertise, and what makes your partnership valuable
                  </FormDescription>
                  <FormControl>
                    <Textarea 
                      placeholder="E.g., We have a professional recording studio with 3 rooms, state-of-the-art equipment, and 10 years of experience working with independent artists..."
                      className="min-h-[100px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="member_benefits"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Gift className="h-4 w-4" />
                    Member Benefits
                  </FormLabel>
                  <FormDescription>
                    What exclusive benefits will LC members receive?
                  </FormDescription>
                  <FormControl>
                    <Textarea 
                      placeholder="E.g., 20% discount on studio time, free consultation, priority booking..."
                      className="min-h-[80px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Contact Info */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="contact_email"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Contact Email
                    </FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="contact@business.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contact_phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Phone (optional)
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="+1 234 567 8900" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="website_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Website (optional)
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Location */}
            <div className="space-y-3">
              <FormLabel className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Location
              </FormLabel>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input placeholder="City" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input placeholder="State/Province" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input placeholder="Country" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input placeholder="Address (optional)" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full"
              disabled={createApplication.isPending}
            >
              {createApplication.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Handshake className="h-4 w-4 mr-2" />
                  Submit Application
                </>
              )}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
