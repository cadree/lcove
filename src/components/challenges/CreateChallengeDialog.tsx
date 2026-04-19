import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useCreateChallenge } from '@/hooks/useChallenges';
import { useNavigate } from 'react-router-dom';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function CreateChallengeDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const create = useCreateChallenge();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState('');
  const [reward, setReward] = useState(0);
  const [cost, setCost] = useState(0);
  const [deadline, setDeadline] = useState('');
  const [cover, setCover] = useState('');

  const submit = async () => {
    if (!title.trim()) return;
    const res = await create.mutateAsync({
      title: title.trim(),
      description: description.trim() || null,
      rules: rules.trim() || null,
      reward_credits: reward,
      cost_credits: cost,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      cover_image_url: cover.trim() || null,
      is_published: true,
      is_active: true,
    });
    onOpenChange(false);
    setTitle(''); setDescription(''); setRules(''); setReward(0); setCost(0); setDeadline(''); setCover('');
    navigate(`/challenge/${res.id}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Create a Fan Challenge</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Title *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Remix my new track" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this about?" rows={3} />
          </div>
          <div>
            <Label>Rules</Label>
            <Textarea value={rules} onChange={(e) => setRules(e.target.value)} placeholder="Submission requirements, format, etc." rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Reward (credits)</Label>
              <Input type="number" min={0} value={reward} onChange={(e) => setReward(parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <Label>Cost to join</Label>
              <Input type="number" min={0} value={cost} onChange={(e) => setCost(parseInt(e.target.value) || 0)} />
            </div>
          </div>
          <div>
            <Label>Deadline</Label>
            <Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
          </div>
          <div>
            <Label>Cover image URL (optional)</Label>
            <Input value={cover} onChange={(e) => setCover(e.target.value)} placeholder="https://..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={!title.trim() || create.isPending}>
            {create.isPending ? 'Creating...' : 'Publish challenge'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
