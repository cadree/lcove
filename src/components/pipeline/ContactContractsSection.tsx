import { useState, useRef } from "react";
import { format } from "date-fns";
import { FileSignature, Plus, Trash2, Send, Loader2, X, Mail, Phone, Check, PenLine, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useContactContracts, ContractCreateInput } from "@/hooks/useContactContracts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";

interface ContactContractsSectionProps {
  pipelineItemId: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
}

interface AdditionalParty {
  name: string;
  role: string;
  address: string;
  email: string;
  phone: string;
}

type ContractFormData = Partial<ContractCreateInput> & { 
  title: string;
  additional_parties?: AdditionalParty[];
};

const defaultContract: ContractFormData = {
  title: '',
  provider_name: '',
  provider_address: '',
  provider_email: '',
  provider_phone: '',
  client_name: '',
  client_address: '',
  client_email: '',
  client_phone: '',
  additional_parties: [],
  scope_description: '',
  deliverables: '',
  timeline_milestones: '',
  exclusions: '',
  revisions_included: 2,
  revision_cost: null,
  total_price: null,
  payment_type: null,
  payment_schedule: '',
  payment_methods: '',
  late_fee_percentage: null,
  refund_policy: '',
  project_start_date: null,
  estimated_completion_date: null,
  client_responsibilities: '',
  ownership_before_payment: 'Provider retains ownership until paid in full',
  ownership_after_payment: 'Client receives full rights after payment',
  portfolio_rights: true,
  confidentiality_enabled: false,
  confidentiality_duration: '',
  confidentiality_terms: '',
  termination_notice_days: 14,
  termination_terms: '',
  early_termination_fee: null,
  limitation_of_liability: '',
  indemnification_terms: '',
  governing_law_state: '',
  governing_law_country: 'USA',
  force_majeure_enabled: false,
  force_majeure_terms: '',
};

export function ContactContractsSection({ pipelineItemId, contactName, contactEmail, contactPhone }: ContactContractsSectionProps) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { contracts, isLoading, createContract, sendContract, deleteContract, isCreating, isSending } = useContactContracts(pipelineItemId);
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(null);
  const [sendVia, setSendVia] = useState<'email' | 'sms'>('email');
  const [sendRecipient, setSendRecipient] = useState('');
  
  const [newContract, setNewContract] = useState<ContractFormData>({
    ...defaultContract,
    provider_name: profile?.display_name || '',
    provider_email: user?.email || '',
    provider_phone: profile?.phone || '',
    client_name: contactName || '',
    client_email: contactEmail || '',
    client_phone: contactPhone || '',
    additional_parties: [],
  });

  const addParty = () => {
    setNewContract({
      ...newContract,
      additional_parties: [
        ...(newContract.additional_parties || []),
        { name: '', role: '', address: '', email: '', phone: '' }
      ]
    });
  };

  const updateParty = (index: number, field: keyof AdditionalParty, value: string) => {
    const updated = [...(newContract.additional_parties || [])];
    updated[index] = { ...updated[index], [field]: value };
    setNewContract({ ...newContract, additional_parties: updated });
  };

  const removeParty = (index: number) => {
    const updated = (newContract.additional_parties || []).filter((_, i) => i !== index);
    setNewContract({ ...newContract, additional_parties: updated });
  };

  // Collapsible sections state
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    parties: true,
    scope: false,
    payment: false,
    timeline: false,
    ip: false,
    confidentiality: false,
    termination: false,
    legal: false,
    forceMajeure: false,
  });

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleCreate = async () => {
    if (!newContract.title.trim()) {
      toast.error("Contract title is required");
      return;
    }

    try {
      await createContract(newContract);
      setIsDialogOpen(false);
      setNewContract({
        ...defaultContract,
        provider_name: profile?.display_name || '',
        provider_email: user?.email || '',
        provider_phone: profile?.phone || '',
        client_name: contactName || '',
        client_email: contactEmail || '',
        client_phone: contactPhone || '',
      });
      toast.success("Contract created");
    } catch (error) {
      toast.error("Failed to create contract");
    }
  };

  const handleSend = async () => {
    if (!selectedContractId || !sendRecipient.trim()) {
      toast.error("Recipient is required");
      return;
    }

    try {
      await sendContract({
        contractId: selectedContractId,
        via: sendVia,
        recipient: sendRecipient.trim(),
      });
      setSendDialogOpen(false);
      setSelectedContractId(null);
      toast.success(`Contract sent via ${sendVia}`);
    } catch (error) {
      toast.error("Failed to send contract");
    }
  };

  const handleDelete = async (contractId: string) => {
    try {
      await deleteContract(contractId);
      toast.success("Contract deleted");
    } catch (error) {
      toast.error("Failed to delete contract");
    }
  };

  const statusColors: Record<string, string> = {
    draft: 'bg-muted text-muted-foreground',
    sent: 'bg-blue-500/10 text-blue-500',
    signed: 'bg-amber-500/10 text-amber-500',
    completed: 'bg-green-500/10 text-green-500',
    cancelled: 'bg-red-500/10 text-red-500',
  };

  const SectionHeader = ({ title, section }: { title: string; section: string }) => (
    <CollapsibleTrigger 
      onClick={() => toggleSection(section)}
      className="flex items-center justify-between w-full py-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
    >
      {title}
      {openSections[section] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
    </CollapsibleTrigger>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileSignature className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-medium text-sm text-foreground">Contracts</h3>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm">
              <Plus className="w-4 h-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Contract</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Contract Title */}
              <div className="space-y-2">
                <Label htmlFor="contract-title">Contract Title *</Label>
                <Input
                  id="contract-title"
                  value={newContract.title}
                  onChange={(e) => setNewContract({ ...newContract, title: e.target.value })}
                  placeholder="e.g., Photography Services Agreement"
                />
              </div>

              {/* Parties Involved */}
              <Collapsible open={openSections.parties}>
                <SectionHeader title="1. Parties Involved" section="parties" />
                <CollapsibleContent className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
                      <p className="text-xs font-medium text-muted-foreground">Service Provider (You)</p>
                      <Input
                        placeholder="Your Name / Company"
                        value={newContract.provider_name || ''}
                        onChange={(e) => setNewContract({ ...newContract, provider_name: e.target.value })}
                      />
                      <Textarea
                        placeholder="Your Address"
                        value={newContract.provider_address || ''}
                        onChange={(e) => setNewContract({ ...newContract, provider_address: e.target.value })}
                        className="min-h-[60px]"
                      />
                      <Input
                        placeholder="Your Email"
                        value={newContract.provider_email || ''}
                        onChange={(e) => setNewContract({ ...newContract, provider_email: e.target.value })}
                      />
                      <Input
                        placeholder="Your Phone"
                        value={newContract.provider_phone || ''}
                        onChange={(e) => setNewContract({ ...newContract, provider_phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-3 p-3 bg-muted/30 rounded-lg">
                      <p className="text-xs font-medium text-muted-foreground">Client</p>
                      <Input
                        placeholder="Client Name / Company"
                        value={newContract.client_name || ''}
                        onChange={(e) => setNewContract({ ...newContract, client_name: e.target.value })}
                      />
                      <Textarea
                        placeholder="Client Address"
                        value={newContract.client_address || ''}
                        onChange={(e) => setNewContract({ ...newContract, client_address: e.target.value })}
                        className="min-h-[60px]"
                      />
                      <Input
                        placeholder="Client Email"
                        value={newContract.client_email || ''}
                        onChange={(e) => setNewContract({ ...newContract, client_email: e.target.value })}
                      />
                      <Input
                        placeholder="Client Phone"
                        value={newContract.client_phone || ''}
                        onChange={(e) => setNewContract({ ...newContract, client_phone: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Additional Parties */}
                  {(newContract.additional_parties || []).map((party, index) => (
                    <div key={index} className="p-3 bg-muted/30 rounded-lg space-y-3 relative">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground">Additional Party #{index + 1}</p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => removeParty(index)}
                        >
                          <X className="w-3 h-3 text-destructive" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Name / Company"
                          value={party.name}
                          onChange={(e) => updateParty(index, 'name', e.target.value)}
                        />
                        <Input
                          placeholder="Role (e.g., Co-Producer)"
                          value={party.role}
                          onChange={(e) => updateParty(index, 'role', e.target.value)}
                        />
                      </div>
                      <Textarea
                        placeholder="Address"
                        value={party.address}
                        onChange={(e) => updateParty(index, 'address', e.target.value)}
                        className="min-h-[50px]"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Email"
                          value={party.email}
                          onChange={(e) => updateParty(index, 'email', e.target.value)}
                        />
                        <Input
                          placeholder="Phone"
                          value={party.phone}
                          onChange={(e) => updateParty(index, 'phone', e.target.value)}
                        />
                      </div>
                    </div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addParty}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add Another Party
                  </Button>
                </CollapsibleContent>
              </Collapsible>

              {/* Scope of Work */}
              <Collapsible open={openSections.scope}>
                <SectionHeader title="2. Scope of Work" section="scope" />
                <CollapsibleContent className="space-y-3 pt-2">
                  <div className="space-y-2">
                    <Label>Description of Services</Label>
                    <Textarea
                      placeholder="Describe the services you will provide..."
                      value={newContract.scope_description || ''}
                      onChange={(e) => setNewContract({ ...newContract, scope_description: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Deliverables</Label>
                    <Textarea
                      placeholder="What the client will receive..."
                      value={newContract.deliverables || ''}
                      onChange={(e) => setNewContract({ ...newContract, deliverables: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Timeline / Milestones</Label>
                    <Textarea
                      placeholder="Key dates and milestones..."
                      value={newContract.timeline_milestones || ''}
                      onChange={(e) => setNewContract({ ...newContract, timeline_milestones: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Exclusions (What is NOT included)</Label>
                    <Textarea
                      placeholder="Services not included in this contract..."
                      value={newContract.exclusions || ''}
                      onChange={(e) => setNewContract({ ...newContract, exclusions: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Revisions Included</Label>
                      <Input
                        type="number"
                        value={newContract.revisions_included ?? 2}
                        onChange={(e) => setNewContract({ ...newContract, revisions_included: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Additional Revision Cost ($)</Label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={newContract.revision_cost || ''}
                        onChange={(e) => setNewContract({ ...newContract, revision_cost: parseFloat(e.target.value) || null })}
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Payment Terms */}
              <Collapsible open={openSections.payment}>
                <SectionHeader title="3. Payment Terms" section="payment" />
                <CollapsibleContent className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Total Price ($)</Label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={newContract.total_price || ''}
                        onChange={(e) => setNewContract({ ...newContract, total_price: parseFloat(e.target.value) || null })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Payment Type</Label>
                      <Select 
                        value={newContract.payment_type || ''} 
                        onValueChange={(v) => setNewContract({ ...newContract, payment_type: v as any })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="flat_fee">Flat Fee</SelectItem>
                          <SelectItem value="hourly">Hourly</SelectItem>
                          <SelectItem value="retainer">Retainer</SelectItem>
                          <SelectItem value="milestone">Milestone-Based</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Payment Schedule</Label>
                    <Textarea
                      placeholder="e.g., 50% upfront, 50% on completion..."
                      value={newContract.payment_schedule || ''}
                      onChange={(e) => setNewContract({ ...newContract, payment_schedule: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Accepted Payment Methods</Label>
                    <Input
                      placeholder="e.g., Bank transfer, PayPal, Stripe..."
                      value={newContract.payment_methods || ''}
                      onChange={(e) => setNewContract({ ...newContract, payment_methods: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Late Fee (%)</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={newContract.late_fee_percentage || ''}
                        onChange={(e) => setNewContract({ ...newContract, late_fee_percentage: parseFloat(e.target.value) || null })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Refund Policy</Label>
                    <Textarea
                      placeholder="e.g., Payment is non-refundable once work begins..."
                      value={newContract.refund_policy || ''}
                      onChange={(e) => setNewContract({ ...newContract, refund_policy: e.target.value })}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Timeline & Deadlines */}
              <Collapsible open={openSections.timeline}>
                <SectionHeader title="4. Timeline & Client Responsibilities" section="timeline" />
                <CollapsibleContent className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Project Start Date</Label>
                      <Input
                        type="date"
                        value={newContract.project_start_date || ''}
                        onChange={(e) => setNewContract({ ...newContract, project_start_date: e.target.value || null })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Estimated Completion</Label>
                      <Input
                        type="date"
                        value={newContract.estimated_completion_date || ''}
                        onChange={(e) => setNewContract({ ...newContract, estimated_completion_date: e.target.value || null })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Client Responsibilities</Label>
                    <Textarea
                      placeholder="What the client must provide (content, feedback, access, approvals)..."
                      value={newContract.client_responsibilities || ''}
                      onChange={(e) => setNewContract({ ...newContract, client_responsibilities: e.target.value })}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Ownership & IP */}
              <Collapsible open={openSections.ip}>
                <SectionHeader title="5. Ownership & Intellectual Property" section="ip" />
                <CollapsibleContent className="space-y-3 pt-2">
                  <div className="space-y-2">
                    <Label>Ownership Before Payment</Label>
                    <Textarea
                      value={newContract.ownership_before_payment || ''}
                      onChange={(e) => setNewContract({ ...newContract, ownership_before_payment: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ownership After Payment</Label>
                    <Textarea
                      value={newContract.ownership_after_payment || ''}
                      onChange={(e) => setNewContract({ ...newContract, ownership_after_payment: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={newContract.portfolio_rights ?? true}
                      onCheckedChange={(v) => setNewContract({ ...newContract, portfolio_rights: v })}
                    />
                    <Label>I can use this work in my portfolio</Label>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Confidentiality */}
              <Collapsible open={openSections.confidentiality}>
                <SectionHeader title="6. Confidentiality" section="confidentiality" />
                <CollapsibleContent className="space-y-3 pt-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={newContract.confidentiality_enabled ?? false}
                      onCheckedChange={(v) => setNewContract({ ...newContract, confidentiality_enabled: v })}
                    />
                    <Label>Include confidentiality clause</Label>
                  </div>
                  {newContract.confidentiality_enabled && (
                    <>
                      <div className="space-y-2">
                        <Label>Duration</Label>
                        <Input
                          placeholder="e.g., 2 years after project completion"
                          value={newContract.confidentiality_duration || ''}
                          onChange={(e) => setNewContract({ ...newContract, confidentiality_duration: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Terms</Label>
                        <Textarea
                          placeholder="Specific confidentiality terms..."
                          value={newContract.confidentiality_terms || ''}
                          onChange={(e) => setNewContract({ ...newContract, confidentiality_terms: e.target.value })}
                        />
                      </div>
                    </>
                  )}
                </CollapsibleContent>
              </Collapsible>

              {/* Termination */}
              <Collapsible open={openSections.termination}>
                <SectionHeader title="7. Termination" section="termination" />
                <CollapsibleContent className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Notice Period (days)</Label>
                      <Input
                        type="number"
                        value={newContract.termination_notice_days ?? 14}
                        onChange={(e) => setNewContract({ ...newContract, termination_notice_days: parseInt(e.target.value) || 14 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Early Termination Fee ($)</Label>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={newContract.early_termination_fee || ''}
                        onChange={(e) => setNewContract({ ...newContract, early_termination_fee: parseFloat(e.target.value) || null })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Termination Terms</Label>
                    <Textarea
                      placeholder="What happens if the contract is terminated early..."
                      value={newContract.termination_terms || ''}
                      onChange={(e) => setNewContract({ ...newContract, termination_terms: e.target.value })}
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Legal */}
              <Collapsible open={openSections.legal}>
                <SectionHeader title="8. Legal Terms" section="legal" />
                <CollapsibleContent className="space-y-3 pt-2">
                  <div className="space-y-2">
                    <Label>Limitation of Liability</Label>
                    <Textarea
                      placeholder="e.g., Maximum liability is limited to the contract value..."
                      value={newContract.limitation_of_liability || ''}
                      onChange={(e) => setNewContract({ ...newContract, limitation_of_liability: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Indemnification</Label>
                    <Textarea
                      placeholder="e.g., Client agrees not to hold provider liable for..."
                      value={newContract.indemnification_terms || ''}
                      onChange={(e) => setNewContract({ ...newContract, indemnification_terms: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Governing Law State</Label>
                      <Input
                        placeholder="e.g., California"
                        value={newContract.governing_law_state || ''}
                        onChange={(e) => setNewContract({ ...newContract, governing_law_state: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Country</Label>
                      <Input
                        value={newContract.governing_law_country || 'USA'}
                        onChange={(e) => setNewContract({ ...newContract, governing_law_country: e.target.value })}
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Force Majeure */}
              <Collapsible open={openSections.forceMajeure}>
                <SectionHeader title="9. Force Majeure" section="forceMajeure" />
                <CollapsibleContent className="space-y-3 pt-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={newContract.force_majeure_enabled ?? false}
                      onCheckedChange={(v) => setNewContract({ ...newContract, force_majeure_enabled: v })}
                    />
                    <Label>Include force majeure clause</Label>
                  </div>
                  {newContract.force_majeure_enabled && (
                    <div className="space-y-2">
                      <Label>Terms</Label>
                      <Textarea
                        placeholder="e.g., Neither party is liable for delays due to natural disasters, illness..."
                        value={newContract.force_majeure_terms || ''}
                        onChange={(e) => setNewContract({ ...newContract, force_majeure_terms: e.target.value })}
                      />
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>

              <Button onClick={handleCreate} disabled={isCreating} className="w-full">
                {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Contract"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : contracts.length === 0 ? (
        <div 
          className="text-center py-6 bg-muted/30 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setIsDialogOpen(true)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setIsDialogOpen(true)}
        >
          <FileSignature className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Create a contract</p>
        </div>
      ) : (
        <div className="space-y-2">
          {contracts.map((contract) => (
            <div
              key={contract.id}
              className="p-3 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm truncate">{contract.title}</span>
                    <Badge className={`${statusColors[contract.status]} text-xs`}>
                      {contract.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{contract.contract_number}</p>
                  {contract.total_price && (
                    <p className="text-sm font-semibold mt-1">${contract.total_price.toLocaleString()}</p>
                  )}
                  {contract.client_signed_at && (
                    <p className="text-xs text-green-500 mt-1 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Signed by client
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {contract.status === 'draft' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setSelectedContractId(contract.id);
                        setSendRecipient(contactEmail || contactPhone || '');
                        setSendVia(contactEmail ? 'email' : 'sms');
                        setSendDialogOpen(true);
                      }}
                    >
                      <Send className="w-3 h-3 mr-1" /> Send
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleDelete(contract.id)}
                  >
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Send Contract Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Contract</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Send via</Label>
              <Select 
                value={sendVia} 
                onValueChange={(v) => {
                  const method = v as 'email' | 'sms';
                  setSendVia(method);
                  if (method === 'email') {
                    setSendRecipient(contactEmail || '');
                  } else {
                    setSendRecipient(contactPhone || '');
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4" /> Email
                    </div>
                  </SelectItem>
                  <SelectItem value="sms">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4" /> SMS
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="send-contract-recipient">{sendVia === 'email' ? 'Client Email Address' : 'Client Phone Number'}</Label>
              <Input
                id="send-contract-recipient"
                type={sendVia === 'email' ? 'email' : 'tel'}
                value={sendRecipient}
                onChange={(e) => setSendRecipient(e.target.value)}
                placeholder={sendVia === 'email' ? 'client@example.com' : '+1234567890'}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={isSending}>
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Contract"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
