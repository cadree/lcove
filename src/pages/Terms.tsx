import { ArrowLeft, FileText, Users, Shield, AlertTriangle, Scale, Ban, Globe, Mail } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const Terms = () => {
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
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-semibold">Terms of Service</h1>
              <p className="text-sm text-muted-foreground">Last updated: {lastUpdated}</p>
            </div>
          </div>
        </div>

        {/* Introduction */}
        <div className="prose prose-sm dark:prose-invert max-w-none mb-8">
          <p className="text-muted-foreground leading-relaxed">
            Welcome to Ether Creative Collective ("Ether," "we," "us," or "our"). These Terms of Service 
            ("Terms") govern your access to and use of our mobile application, website, and services 
            (collectively, the "Platform").
          </p>
          <p className="text-muted-foreground leading-relaxed">
            By accessing or using the Platform, you agree to be bound by these Terms. If you do not agree 
            to these Terms, you may not access or use the Platform.
          </p>
        </div>

        {/* Sections */}
        <Accordion type="single" collapsible className="space-y-2">
          {/* Eligibility */}
          <AccordionItem value="eligibility" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-primary" />
                <span className="font-medium">Eligibility & Account</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground space-y-4">
              <div>
                <h4 className="font-medium text-foreground mb-2">Age Requirements</h4>
                <p className="text-sm">
                  You must be at least 13 years old (or 16 in the European Economic Area) to use the Platform. 
                  By using the Platform, you represent that you meet this age requirement.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-foreground mb-2">Account Responsibilities</h4>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>You are responsible for maintaining the security of your account credentials</li>
                  <li>You must provide accurate and complete information during registration</li>
                  <li>You are responsible for all activities under your account</li>
                  <li>Notify us immediately of any unauthorized access to your account</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium text-foreground mb-2">One Account Per Person</h4>
                <p className="text-sm">
                  Each person may only maintain one active account. Creating multiple accounts may result in 
                  termination of all accounts.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* User Conduct */}
          <AccordionItem value="conduct" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Shield className="h-5 w-5 text-primary" />
                <span className="font-medium">User Conduct</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground space-y-4">
              <p className="text-sm">When using the Platform, you agree NOT to:</p>
              <ul className="list-disc list-inside space-y-2 text-sm">
                <li>Post content that is illegal, harmful, threatening, abusive, harassing, defamatory, or discriminatory</li>
                <li>Impersonate any person or entity, or falsely claim affiliation</li>
                <li>Share others' personal information without consent</li>
                <li>Upload malware, viruses, or malicious code</li>
                <li>Attempt to gain unauthorized access to accounts or systems</li>
                <li>Use automated means (bots, scrapers) to access the Platform without permission</li>
                <li>Engage in spam, phishing, or deceptive practices</li>
                <li>Interfere with or disrupt the Platform or servers</li>
                <li>Violate any applicable laws or regulations</li>
                <li>Encourage or assist others in violating these Terms</li>
              </ul>
              <p className="text-sm">
                We reserve the right to remove content and suspend or terminate accounts that violate these guidelines.
              </p>
            </AccordionContent>
          </AccordionItem>

          {/* Content Ownership */}
          <AccordionItem value="content" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                <span className="font-medium">Content & Intellectual Property</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground space-y-4">
              <div>
                <h4 className="font-medium text-foreground mb-2">Your Content</h4>
                <p className="text-sm">
                  You retain ownership of content you create and post on the Platform. By posting content, 
                  you grant Ether a non-exclusive, worldwide, royalty-free license to use, display, and 
                  distribute your content in connection with operating the Platform.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-foreground mb-2">Content Responsibility</h4>
                <p className="text-sm">
                  You are solely responsible for content you post. You represent that you have all necessary 
                  rights to post such content and that it does not infringe on third-party rights.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-foreground mb-2">Ether's Content</h4>
                <p className="text-sm">
                  The Platform, including its design, features, and branding, is owned by Ether and protected 
                  by intellectual property laws. You may not copy, modify, or distribute our content without permission.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-foreground mb-2">Data Portability</h4>
                <p className="text-sm">
                  You can request a copy of your data at any time. We believe you should own your content and 
                  be able to take it with you.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Creator Tools & Payments */}
          <AccordionItem value="payments" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Scale className="h-5 w-5 text-primary" />
                <span className="font-medium">Creator Tools & Payments</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground space-y-4">
              <div>
                <h4 className="font-medium text-foreground mb-2">Memberships</h4>
                <p className="text-sm">
                  Some features require a paid membership. Membership fees are billed in advance on a recurring 
                  basis. You can cancel at any time, with access continuing until the end of your billing period.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-foreground mb-2">Creator Payouts</h4>
                <p className="text-sm">
                  If you earn money through the Platform (store sales, tips, etc.), payouts are processed through 
                  Stripe. You are responsible for providing accurate payment information and complying with tax obligations.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-foreground mb-2">Fees</h4>
                <p className="text-sm">
                  We may charge fees for certain services. Current fees are disclosed before any transaction. 
                  We reserve the right to modify fees with advance notice.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-foreground mb-2">Refunds</h4>
                <p className="text-sm">
                  Refund policies vary by product type. Digital content and services may have limited refund 
                  availability. Contact support for specific inquiries.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Termination */}
          <AccordionItem value="termination" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Ban className="h-5 w-5 text-primary" />
                <span className="font-medium">Termination</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground space-y-4">
              <div>
                <h4 className="font-medium text-foreground mb-2">By You</h4>
                <p className="text-sm">
                  You may delete your account at any time through the Settings page. Upon deletion, your 
                  personal data will be removed according to our Privacy Policy.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-foreground mb-2">By Us</h4>
                <p className="text-sm">
                  We may suspend or terminate your account if you violate these Terms, engage in harmful 
                  behavior, or for any reason with notice. In case of severe violations, termination may 
                  be immediate without notice.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-foreground mb-2">Effect of Termination</h4>
                <p className="text-sm">
                  Upon termination, your right to use the Platform ceases. Provisions that should survive 
                  termination (such as intellectual property rights and limitation of liability) will remain in effect.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Disclaimers */}
          <AccordionItem value="disclaimers" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-primary" />
                <span className="font-medium">Disclaimers & Limitations</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground space-y-4">
              <div>
                <h4 className="font-medium text-foreground mb-2">As-Is Basis</h4>
                <p className="text-sm">
                  THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, 
                  EXPRESS OR IMPLIED. WE DO NOT GUARANTEE THAT THE PLATFORM WILL BE UNINTERRUPTED, 
                  ERROR-FREE, OR SECURE.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-foreground mb-2">Limitation of Liability</h4>
                <p className="text-sm">
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, ETHER SHALL NOT BE LIABLE FOR ANY INDIRECT, 
                  INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE PLATFORM.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-foreground mb-2">Third-Party Content</h4>
                <p className="text-sm">
                  The Platform may contain links to third-party websites or services. We are not responsible 
                  for the content or practices of these third parties.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-foreground mb-2">User Interactions</h4>
                <p className="text-sm">
                  We are not responsible for disputes between users or any harm arising from user interactions. 
                  Use caution when engaging with other users.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Dispute Resolution */}
          <AccordionItem value="disputes" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Scale className="h-5 w-5 text-primary" />
                <span className="font-medium">Dispute Resolution</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground space-y-4">
              <div>
                <h4 className="font-medium text-foreground mb-2">Informal Resolution</h4>
                <p className="text-sm">
                  Before filing any formal dispute, you agree to contact us at legal@ethercreative.co to 
                  attempt to resolve the matter informally within 60 days.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-foreground mb-2">Governing Law</h4>
                <p className="text-sm">
                  These Terms are governed by the laws of the United States and the State of California, 
                  without regard to conflict of law principles.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-foreground mb-2">Jurisdiction</h4>
                <p className="text-sm">
                  Any legal action must be brought in the courts located in Los Angeles County, California, 
                  and you consent to the jurisdiction of such courts.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* General */}
          <AccordionItem value="general" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <Globe className="h-5 w-5 text-primary" />
                <span className="font-medium">General Provisions</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground space-y-4">
              <div>
                <h4 className="font-medium text-foreground mb-2">Entire Agreement</h4>
                <p className="text-sm">
                  These Terms, together with our Privacy Policy, constitute the entire agreement between 
                  you and Ether regarding the Platform.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-foreground mb-2">Severability</h4>
                <p className="text-sm">
                  If any provision of these Terms is found to be unenforceable, the remaining provisions 
                  will remain in full force and effect.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-foreground mb-2">No Waiver</h4>
                <p className="text-sm">
                  Our failure to enforce any right or provision of these Terms will not be considered a 
                  waiver of those rights.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-foreground mb-2">Assignment</h4>
                <p className="text-sm">
                  You may not assign or transfer these Terms without our consent. We may assign our rights 
                  and obligations without restriction.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Changes */}
          <AccordionItem value="changes" className="border rounded-lg px-4">
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                <span className="font-medium">Changes to Terms</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground space-y-4">
              <p className="text-sm">
                We may revise these Terms at any time. Material changes will be communicated through:
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Posting the updated Terms on the Platform</li>
                <li>Updating the "Last updated" date</li>
                <li>In-app notification for significant changes</li>
              </ul>
              <p className="text-sm">
                Your continued use of the Platform after changes are posted means you accept the revised Terms.
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
              <p className="text-sm">For questions about these Terms, please contact us:</p>
              <div className="space-y-2 text-sm">
                <p><strong>Email:</strong> legal@ethercreative.co</p>
                <p><strong>Support:</strong> Available through the app's Settings page</p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t text-center">
          <p className="text-sm text-muted-foreground mb-4">
            By using Ether, you acknowledge that you have read and agree to these Terms of Service.
          </p>
          <div className="flex justify-center gap-4">
            <Link to="/privacy" className="text-sm text-primary hover:underline">
              Privacy Policy
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

export default Terms;
