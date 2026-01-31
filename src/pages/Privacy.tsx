import { ArrowLeft, Shield, Database, Users, Lock, Eye, Trash2, Globe, Bell, CreditCard, Mail } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const Privacy = () => {
  const navigate = useNavigate();
  const lastUpdated = "January 31, 2026";

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-3xl mx-auto px-4 py-8 safe-area-top safe-area-bottom">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-semibold">Privacy Policy</h1>
              <p className="text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
            </div>
          </div>
        </div>

        {/* Introduction */}
        <div className="prose prose-sm dark:prose-invert max-w-none mb-8">
          <p className="text-muted-foreground leading-relaxed">
            Ether Creative Collective ("Ether," "we," "us," or "our") is committed to protecting your privacy. 
            This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you 
            use our mobile application and website (collectively, the "Platform").
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Please read this privacy policy carefully. By using the Platform, you consent to the practices 
            described in this policy. If you do not agree with the terms of this privacy policy, please do 
            not access the Platform.
          </p>
        </div>

        {/* Sections */}
        <Accordion type="single" collapsible className="space-y-2">
          {/* Information We Collect */}
          <AccordionItem value="collect" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-primary" />
                <span className="font-medium">Information We Collect</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground space-y-4">
              <div>
                <h4 className="font-medium text-foreground mb-2">Personal Information</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Name and email address when you create an account</li>
                  <li>Profile information including bio, avatar, and city</li>
                  <li>Creative roles and skills you select</li>
                  <li>Phone number (optional, for notifications)</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-foreground mb-2">Content You Create</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Posts, comments, and messages</li>
                  <li>Photos, videos, and other media uploads</li>
                  <li>Projects, portfolios, and creative work</li>
                  <li>Invoices, contracts, and business documents</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-foreground mb-2">Usage Data</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Device information (type, operating system, unique identifiers)</li>
                  <li>Log data (access times, pages viewed, app crashes)</li>
                  <li>Location data (city-level, based on your profile settings)</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-foreground mb-2">Payment Information</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Payment details are processed securely by Stripe</li>
                  <li>We do not store complete credit card numbers</li>
                  <li>Transaction history for purchases and payouts</li>
                </ul>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* How We Use Your Information */}
          <AccordionItem value="use" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Eye className="h-5 w-5 text-primary" />
                <span className="font-medium">How We Use Your Information</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground space-y-4">
              <p className="text-sm">We use the information we collect to:</p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li><strong>Provide Services:</strong> Create and manage your account, enable community features, and facilitate creator tools</li>
                <li><strong>Personalization:</strong> Customize your experience based on preferences and interests</li>
                <li><strong>Communications:</strong> Send notifications about activity, updates, and important announcements</li>
                <li><strong>Payments:</strong> Process transactions for memberships, store purchases, and creator payouts</li>
                <li><strong>Safety:</strong> Detect and prevent fraud, abuse, and violations of our terms</li>
                <li><strong>Improvement:</strong> Analyze usage patterns to improve features and user experience</li>
                <li><strong>Legal:</strong> Comply with legal obligations and enforce our terms of service</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          {/* Information Sharing */}
          <AccordionItem value="sharing" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-primary" />
                <span className="font-medium">Information Sharing</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground space-y-4">
              <p className="text-sm">We may share your information in the following situations:</p>
              <div>
                <h4 className="font-medium text-foreground mb-2">With Other Users</h4>
                <p className="text-sm">Your public profile, posts, and content you choose to share are visible to other community members.</p>
              </div>
              <div>
                <h4 className="font-medium text-foreground mb-2">Service Providers</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li><strong>Stripe:</strong> Payment processing</li>
                  <li><strong>Cloud Storage:</strong> Secure file and media storage</li>
                  <li><strong>Push Notifications:</strong> Delivery of app notifications</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-foreground mb-2">Legal Requirements</h4>
                <p className="text-sm">We may disclose information if required by law, court order, or government request, or to protect rights, property, or safety.</p>
              </div>
              <div>
                <h4 className="font-medium text-foreground mb-2">Business Transfers</h4>
                <p className="text-sm">In the event of a merger, acquisition, or sale of assets, your information may be transferred as part of that transaction.</p>
              </div>
              <p className="text-sm font-medium text-foreground">We do not sell your personal information to third parties.</p>
            </AccordionContent>
          </AccordionItem>

          {/* Data Security */}
          <AccordionItem value="security" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Lock className="h-5 w-5 text-primary" />
                <span className="font-medium">Data Security</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground space-y-4">
              <p className="text-sm">We implement appropriate security measures to protect your information:</p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li><strong>Encryption:</strong> Data is encrypted in transit (TLS/SSL) and at rest</li>
                <li><strong>Access Controls:</strong> Strict access controls limit who can access your data</li>
                <li><strong>Secure Authentication:</strong> Password hashing and secure session management</li>
                <li><strong>Regular Audits:</strong> Security practices are regularly reviewed and updated</li>
                <li><strong>Row Level Security:</strong> Database-level policies ensure users only access their own data</li>
              </ul>
              <p className="text-sm">While we strive to protect your information, no method of transmission over the internet is 100% secure. We cannot guarantee absolute security.</p>
            </AccordionContent>
          </AccordionItem>

          {/* Your Rights */}
          <AccordionItem value="rights" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Trash2 className="h-5 w-5 text-primary" />
                <span className="font-medium">Your Rights & Choices</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground space-y-4">
              <p className="text-sm">Depending on your location, you may have the following rights:</p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li><strong>Access:</strong> Request a copy of the personal data we hold about you</li>
                <li><strong>Correction:</strong> Update or correct inaccurate information</li>
                <li><strong>Deletion:</strong> Request deletion of your account and personal data</li>
                <li><strong>Portability:</strong> Receive your data in a portable format</li>
                <li><strong>Opt-Out:</strong> Unsubscribe from marketing communications</li>
                <li><strong>Restrict Processing:</strong> Request limitations on how we use your data</li>
              </ul>
              <p className="text-sm">To exercise these rights, please contact us at privacy@ethercreative.co or through the Settings page in the app.</p>
              <div>
                <h4 className="font-medium text-foreground mb-2">Account Deletion</h4>
                <p className="text-sm">You can delete your account at any time through Settings. Upon deletion, we will remove your personal data within 30 days, except where retention is required by law.</p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Children's Privacy */}
          <AccordionItem value="children" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-primary" />
                <span className="font-medium">Children's Privacy</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground space-y-4">
              <p className="text-sm">
                Ether is not intended for children under the age of 13 (or 16 in the European Economic Area). 
                We do not knowingly collect personal information from children under these ages.
              </p>
              <p className="text-sm">
                If we learn that we have collected personal information from a child under the applicable age, 
                we will take steps to delete that information as quickly as possible.
              </p>
              <p className="text-sm">
                If you believe a child has provided us with personal information, please contact us at privacy@ethercreative.co.
              </p>
            </AccordionContent>
          </AccordionItem>

          {/* Third-Party Services */}
          <AccordionItem value="thirdparty" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-primary" />
                <span className="font-medium">Third-Party Services</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground space-y-4">
              <p className="text-sm">We integrate with the following third-party services:</p>
              <div>
                <h4 className="font-medium text-foreground mb-2">Stripe (Payments)</h4>
                <p className="text-sm">Handles payment processing. View their privacy policy at stripe.com/privacy.</p>
              </div>
              <div>
                <h4 className="font-medium text-foreground mb-2">Push Notification Services</h4>
                <p className="text-sm">Apple Push Notification Service (APNs) and Firebase Cloud Messaging (FCM) for delivering notifications.</p>
              </div>
              <p className="text-sm">These services have their own privacy policies governing the use of your information.</p>
            </AccordionContent>
          </AccordionItem>

          {/* Data Retention */}
          <AccordionItem value="retention" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Database className="h-5 w-5 text-primary" />
                <span className="font-medium">Data Retention</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground space-y-4">
              <p className="text-sm">We retain your information for as long as necessary to:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Provide our services to you</li>
                <li>Comply with legal obligations</li>
                <li>Resolve disputes and enforce agreements</li>
              </ul>
              <p className="text-sm">
                When you delete your account, we will delete or anonymize your personal data within 30 days, 
                except for data we are required to retain for legal, regulatory, or security purposes.
              </p>
            </AccordionContent>
          </AccordionItem>

          {/* International Transfers */}
          <AccordionItem value="international" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-primary" />
                <span className="font-medium">International Data Transfers</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground space-y-4">
              <p className="text-sm">
                Your information may be transferred to and processed in countries other than your country of residence. 
                These countries may have data protection laws different from those of your country.
              </p>
              <p className="text-sm">
                We take appropriate safeguards to ensure your personal information remains protected in accordance 
                with this Privacy Policy, including standard contractual clauses approved by relevant authorities.
              </p>
            </AccordionContent>
          </AccordionItem>

          {/* Push Notifications */}
          <AccordionItem value="notifications" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Bell className="h-5 w-5 text-primary" />
                <span className="font-medium">Push Notifications</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground space-y-4">
              <p className="text-sm">
                With your consent, we may send push notifications to your device for messages, activity updates, 
                and important announcements.
              </p>
              <p className="text-sm">
                You can manage notification preferences in your device settings or within the app's Settings page. 
                Disabling notifications will not affect other functionality.
              </p>
            </AccordionContent>
          </AccordionItem>

          {/* Contact */}
          <AccordionItem value="contact" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-primary" />
                <span className="font-medium">Contact Us</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground space-y-4">
              <p className="text-sm">If you have questions about this Privacy Policy or our practices, please contact us:</p>
              <div className="space-y-2 text-sm">
                <p><strong>Email:</strong> privacy@ethercreative.co</p>
                <p><strong>Support:</strong> Available through the app's Settings page</p>
              </div>
              <p className="text-sm">
                We will respond to your inquiry within 30 days.
              </p>
            </AccordionContent>
          </AccordionItem>

          {/* Changes to Policy */}
          <AccordionItem value="changes" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-primary" />
                <span className="font-medium">Changes to This Policy</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground space-y-4">
              <p className="text-sm">
                We may update this Privacy Policy from time to time. We will notify you of any material changes by:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Posting the new Privacy Policy on this page</li>
                <li>Updating the "Last updated" date</li>
                <li>Sending a notification through the app for significant changes</li>
              </ul>
              <p className="text-sm">
                Your continued use of the Platform after changes are posted constitutes acceptance of the updated policy.
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t text-center">
          <p className="text-sm text-muted-foreground mb-4">
            By using Ether, you acknowledge that you have read and understood this Privacy Policy.
          </p>
          <div className="flex justify-center gap-4">
            <Link to="/terms" className="text-sm text-primary hover:underline">
              Terms of Service
            </Link>
            <span className="text-muted-foreground">•</span>
            <Link to="/" className="text-sm text-primary hover:underline">
              Return Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
