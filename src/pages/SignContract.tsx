import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Loader2, Download, Check, PenTool, FileText, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface AdditionalParty {
  name: string;
  role: string;
  address: string;
  email: string;
  phone: string;
}

interface Contract {
  id: string;
  contract_number: string;
  title: string;
  provider_name: string | null;
  provider_address: string | null;
  provider_email: string | null;
  provider_phone: string | null;
  provider_signature_url: string | null;
  provider_signed_at: string | null;
  client_name: string | null;
  client_address: string | null;
  client_email: string | null;
  client_phone: string | null;
  client_signature_url: string | null;
  client_signed_at: string | null;
  additional_parties: AdditionalParty[] | null;
  scope_description: string | null;
  deliverables: string | null;
  timeline_milestones: string | null;
  exclusions: string | null;
  revisions_included: number;
  revision_cost: number | null;
  total_price: number | null;
  payment_type: string | null;
  payment_schedule: string | null;
  payment_methods: string | null;
  late_fee_percentage: number | null;
  refund_policy: string | null;
  project_start_date: string | null;
  estimated_completion_date: string | null;
  client_responsibilities: string | null;
  ownership_before_payment: string | null;
  ownership_after_payment: string | null;
  portfolio_rights: boolean;
  confidentiality_enabled: boolean;
  confidentiality_duration: string | null;
  confidentiality_terms: string | null;
  termination_notice_days: number;
  termination_terms: string | null;
  early_termination_fee: number | null;
  limitation_of_liability: string | null;
  indemnification_terms: string | null;
  governing_law_state: string | null;
  governing_law_country: string;
  force_majeure_enabled: boolean;
  force_majeure_terms: string | null;
  status: string;
  created_at: string;
}

export default function SignContract() {
  const { contractId } = useParams();
  const navigate = useNavigate();
  const [signatureName, setSignatureName] = useState("");
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contractRef = useRef<HTMLDivElement>(null);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const { data: contract, isLoading, error, refetch } = useQuery({
    queryKey: ['sign-contract', contractId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contact_contracts')
        .select('*')
        .eq('id', contractId)
        .single();
      
      if (error) throw error;
      
      // Parse additional_parties safely
      let parsedParties: AdditionalParty[] | null = null;
      if (Array.isArray(data.additional_parties)) {
        parsedParties = data.additional_parties as unknown as AdditionalParty[];
      }
      
      return {
        ...data,
        additional_parties: parsedParties
      } as Contract;
    },
    enabled: !!contractId,
  });

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const signContract = useMutation({
    mutationFn: async (signatureUrl: string) => {
      const { error } = await supabase
        .from('contact_contracts')
        .update({
          client_signature_url: signatureUrl,
          client_signed_at: new Date().toISOString(),
          status: 'signed',
        })
        .eq('id', contractId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contract signed successfully!");
      refetch();
    },
    onError: () => {
      toast.error("Failed to sign contract");
    },
  });

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setSignatureDataUrl(canvas.toDataURL('image/png'));
    }
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    ctx.beginPath();
    ctx.moveTo(touch.clientX - rect.left, touch.clientY - rect.top);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    ctx.lineTo(touch.clientX - rect.left, touch.clientY - rect.top);
    ctx.stroke();
  };

  const handleTouchEnd = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setSignatureDataUrl(canvas.toDataURL('image/png'));
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setSignatureDataUrl(null);
  };

  const handleSign = async () => {
    if (!signatureName.trim()) {
      toast.error("Please enter your name");
      return;
    }
    if (!signatureDataUrl) {
      toast.error("Please draw your signature");
      return;
    }

    await signContract.mutateAsync(signatureDataUrl);
  };

  const generatePDF = async () => {
    if (!contractRef.current || !contract) return;
    
    setIsGeneratingPdf(true);
    try {
      const canvas = await html2canvas(contractRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      const imgWidth = 210;
      const pageHeight = 297;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Contract-${contract.contract_number}.pdf`);
      toast.success("PDF downloaded!");
    } catch (err) {
      console.error("PDF generation error:", err);
      toast.error("Failed to generate PDF");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'TBD';
    return format(new Date(date), 'MMMM d, yyyy');
  };

  const formatCurrency = (amount: number | null) => {
    if (!amount) return 'TBD';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const paymentTypeLabels: Record<string, string> = {
    flat_fee: 'Flat Fee',
    hourly: 'Hourly Rate',
    retainer: 'Retainer',
    milestone: 'Milestone-Based',
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <FileText className="w-16 h-16 text-muted-foreground" />
        <h1 className="text-2xl font-bold">Contract Not Found</h1>
        <p className="text-muted-foreground">This contract may have been deleted or the link is invalid.</p>
      </div>
    );
  }

  const isSigned = !!contract.client_signed_at;

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header Actions */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button 
            onClick={generatePDF} 
            disabled={isGeneratingPdf}
            variant="outline"
          >
            {isGeneratingPdf ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-2" />
            )}
            Download PDF
          </Button>
        </div>

        {/* Contract Document */}
        <Card className="mb-6">
          <div ref={contractRef} className="bg-white p-8">
            {/* Contract Header */}
            <div className="text-center mb-8 border-b pb-6">
              <h1 className="text-3xl font-bold text-foreground">{contract.title}</h1>
              <p className="text-muted-foreground mt-2">Contract #{contract.contract_number}</p>
              <p className="text-sm text-muted-foreground">Created: {formatDate(contract.created_at)}</p>
            </div>

            {/* Section 1: Parties */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4 border-b pb-2">1. Parties Involved</h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-muted/30 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase mb-2">Service Provider</h3>
                  <p className="font-semibold">{contract.provider_name || 'Not specified'}</p>
                  {contract.provider_address && <p className="text-sm text-muted-foreground">{contract.provider_address}</p>}
                  {contract.provider_email && <p className="text-sm text-muted-foreground">{contract.provider_email}</p>}
                  {contract.provider_phone && <p className="text-sm text-muted-foreground">{contract.provider_phone}</p>}
                </div>
                <div className="bg-muted/30 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase mb-2">Client</h3>
                  <p className="font-semibold">{contract.client_name || 'Not specified'}</p>
                  {contract.client_address && <p className="text-sm text-muted-foreground">{contract.client_address}</p>}
                  {contract.client_email && <p className="text-sm text-muted-foreground">{contract.client_email}</p>}
                  {contract.client_phone && <p className="text-sm text-muted-foreground">{contract.client_phone}</p>}
                </div>
              </div>
              
              {contract.additional_parties && contract.additional_parties.length > 0 && (
                <div className="grid md:grid-cols-2 gap-6 mt-4">
                  {contract.additional_parties.map((party, idx) => (
                    <div key={idx} className="bg-muted/30 p-4 rounded-lg">
                      <h3 className="text-sm font-medium text-muted-foreground uppercase mb-2">{party.role || 'Additional Party'}</h3>
                      <p className="font-semibold">{party.name || 'Not specified'}</p>
                      {party.address && <p className="text-sm text-muted-foreground">{party.address}</p>}
                      {party.email && <p className="text-sm text-muted-foreground">{party.email}</p>}
                      {party.phone && <p className="text-sm text-muted-foreground">{party.phone}</p>}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Section 2: Scope of Work */}
            {(contract.scope_description || contract.deliverables) && (
              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4 border-b pb-2">2. Scope of Work</h2>
                {contract.scope_description && (
                  <div className="mb-4">
                    <h3 className="font-medium mb-1">Description</h3>
                    <p className="text-muted-foreground whitespace-pre-wrap">{contract.scope_description}</p>
                  </div>
                )}
                {contract.deliverables && (
                  <div className="mb-4">
                    <h3 className="font-medium mb-1">Deliverables</h3>
                    <p className="text-muted-foreground whitespace-pre-wrap">{contract.deliverables}</p>
                  </div>
                )}
                {contract.timeline_milestones && (
                  <div className="mb-4">
                    <h3 className="font-medium mb-1">Milestones</h3>
                    <p className="text-muted-foreground whitespace-pre-wrap">{contract.timeline_milestones}</p>
                  </div>
                )}
                {contract.exclusions && (
                  <div className="mb-4">
                    <h3 className="font-medium mb-1">Exclusions</h3>
                    <p className="text-muted-foreground whitespace-pre-wrap">{contract.exclusions}</p>
                  </div>
                )}
                <div className="bg-muted/30 p-4 rounded-lg">
                  <p><strong>Revisions Included:</strong> {contract.revisions_included}</p>
                  {contract.revision_cost && <p><strong>Additional Revision Cost:</strong> {formatCurrency(contract.revision_cost)}</p>}
                </div>
              </section>
            )}

            {/* Section 3: Payment Terms */}
            {contract.total_price && (
              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4 border-b pb-2">3. Payment Terms</h2>
                <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border-l-4 border-amber-500">
                  <p className="text-lg font-bold">Total Price: {formatCurrency(contract.total_price)}</p>
                  {contract.payment_type && <p><strong>Type:</strong> {paymentTypeLabels[contract.payment_type] || contract.payment_type}</p>}
                  {contract.payment_schedule && <p><strong>Schedule:</strong> {contract.payment_schedule}</p>}
                  {contract.payment_methods && <p><strong>Methods:</strong> {contract.payment_methods}</p>}
                  {contract.late_fee_percentage && <p><strong>Late Fee:</strong> {contract.late_fee_percentage}% per month</p>}
                  {contract.refund_policy && <p><strong>Refund Policy:</strong> {contract.refund_policy}</p>}
                </div>
              </section>
            )}

            {/* Section 4: Timeline */}
            {(contract.project_start_date || contract.estimated_completion_date) && (
              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4 border-b pb-2">4. Timeline</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Start Date</p>
                    <p className="font-semibold">{formatDate(contract.project_start_date)}</p>
                  </div>
                  <div className="bg-muted/30 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Estimated Completion</p>
                    <p className="font-semibold">{formatDate(contract.estimated_completion_date)}</p>
                  </div>
                </div>
                {contract.client_responsibilities && (
                  <div className="mt-4">
                    <h3 className="font-medium mb-1">Client Responsibilities</h3>
                    <p className="text-muted-foreground whitespace-pre-wrap">{contract.client_responsibilities}</p>
                  </div>
                )}
              </section>
            )}

            {/* Section 5: IP & Ownership */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4 border-b pb-2">5. Ownership & Intellectual Property</h2>
              <div className="space-y-2">
                <p><strong>Before Payment:</strong> {contract.ownership_before_payment || 'Provider retains ownership until paid in full'}</p>
                <p><strong>After Payment:</strong> {contract.ownership_after_payment || 'Client receives full rights after payment'}</p>
                <p><strong>Portfolio Rights:</strong> {contract.portfolio_rights ? 'Provider may use work in portfolio' : 'Provider may not use work in portfolio'}</p>
              </div>
            </section>

            {/* Section 6: Confidentiality */}
            {contract.confidentiality_enabled && (
              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4 border-b pb-2">6. Confidentiality</h2>
                {contract.confidentiality_duration && <p><strong>Duration:</strong> {contract.confidentiality_duration}</p>}
                <p className="text-muted-foreground">{contract.confidentiality_terms || 'Both parties agree to keep confidential information private.'}</p>
              </section>
            )}

            {/* Section 7: Termination */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4 border-b pb-2">7. Termination</h2>
              <p><strong>Notice Period:</strong> {contract.termination_notice_days} days</p>
              {contract.early_termination_fee && <p><strong>Early Termination Fee:</strong> {formatCurrency(contract.early_termination_fee)}</p>}
              {contract.termination_terms && <p className="text-muted-foreground mt-2">{contract.termination_terms}</p>}
            </section>

            {/* Section 8: Legal */}
            {(contract.limitation_of_liability || contract.indemnification_terms) && (
              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4 border-b pb-2">8. Legal Terms</h2>
                {contract.limitation_of_liability && (
                  <div className="mb-2">
                    <strong>Limitation of Liability:</strong>
                    <p className="text-muted-foreground">{contract.limitation_of_liability}</p>
                  </div>
                )}
                {contract.indemnification_terms && (
                  <div className="mb-2">
                    <strong>Indemnification:</strong>
                    <p className="text-muted-foreground">{contract.indemnification_terms}</p>
                  </div>
                )}
                <p><strong>Governing Law:</strong> {contract.governing_law_state ? `${contract.governing_law_state}, ` : ''}{contract.governing_law_country}</p>
              </section>
            )}

            {/* Section 9: Force Majeure */}
            {contract.force_majeure_enabled && (
              <section className="mb-8">
                <h2 className="text-xl font-semibold mb-4 border-b pb-2">9. Force Majeure</h2>
                <p className="text-muted-foreground">{contract.force_majeure_terms || 'Neither party shall be liable for delays caused by circumstances beyond their reasonable control.'}</p>
              </section>
            )}

            {/* Signatures */}
            <section className="mb-8">
              <h2 className="text-xl font-semibold mb-4 border-b pb-2">Signatures</h2>
              <p className="text-muted-foreground mb-6">This contract constitutes the entire agreement between the parties. By signing below, both parties agree to the terms and conditions outlined in this contract.</p>
              
              <div className="grid md:grid-cols-2 gap-6">
                {/* Provider Signature */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium mb-2">Service Provider</h3>
                  {contract.provider_signature_url ? (
                    <div>
                      <img src={contract.provider_signature_url} alt="Provider signature" className="h-16 mb-2" />
                      <p className="text-sm text-muted-foreground">Signed: {formatDate(contract.provider_signed_at)}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Not yet signed</p>
                  )}
                  <p className="mt-2 font-medium">{contract.provider_name}</p>
                </div>

                {/* Client Signature */}
                <div className="border rounded-lg p-4">
                  <h3 className="font-medium mb-2">Client</h3>
                  {contract.client_signature_url ? (
                    <div>
                      <img src={contract.client_signature_url} alt="Client signature" className="h-16 mb-2" />
                      <p className="text-sm text-muted-foreground">Signed: {formatDate(contract.client_signed_at)}</p>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">Awaiting signature</p>
                  )}
                  <p className="mt-2 font-medium">{contract.client_name}</p>
                </div>
              </div>
            </section>

            {/* Footer */}
            <div className="text-center text-sm text-muted-foreground border-t pt-4">
              <p>Contract #{contract.contract_number} • Generated via Ether</p>
            </div>
          </div>
        </Card>

        {/* Signing Section - Only show if not signed */}
        {!isSigned && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PenTool className="w-5 h-5" />
                Sign Contract
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="signature-name">Your Full Name</Label>
                <Input
                  id="signature-name"
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  placeholder="Enter your full legal name"
                />
              </div>

              <div className="space-y-2">
                <Label>Draw Your Signature</Label>
                <div className="border rounded-lg overflow-hidden bg-white">
                  <canvas
                    ref={canvasRef}
                    width={400}
                    height={150}
                    className="w-full cursor-crosshair touch-none"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                  />
                </div>
                <Button variant="ghost" size="sm" onClick={clearSignature}>
                  Clear Signature
                </Button>
              </div>

              <div className="flex gap-4">
                <Button 
                  onClick={handleSign} 
                  disabled={signContract.isPending || !signatureName || !signatureDataUrl}
                  className="flex-1"
                >
                  {signContract.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  Sign Contract
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                By signing, you agree to be legally bound by the terms of this contract.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Success Message */}
        {isSigned && (
          <Card className="border-green-200 bg-green-50 dark:bg-green-900/20">
            <CardContent className="py-6 text-center">
              <Check className="w-12 h-12 mx-auto text-green-500 mb-4" />
              <h3 className="text-xl font-semibold text-green-700 dark:text-green-400">Contract Signed!</h3>
              <p className="text-green-600 dark:text-green-500 mt-2">
                This contract was signed on {formatDate(contract.client_signed_at)}
              </p>
              <Button onClick={generatePDF} className="mt-4">
                <Download className="w-4 h-4 mr-2" />
                Download Signed Contract PDF
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
