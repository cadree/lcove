import { useState } from 'react';
import { RepostComposer } from '@/components/share/RepostComposer';
import { Check, Link2, Repeat2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useShareRecipients, useMyReposts, useSharingActions } from '@/hooks/useSharing';
import { canRepostMedia, shareUrlFor, type SharePerson, type ShareTarget } from '@/lib/sharing';
import { useAuth } from '@/contexts/AuthContext';

async function copyLink(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    toast.success('Link copied');
  } catch {
    const area = document.createElement('textarea');
    area.value = url;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    if (ok) toast.success('Link copied');
    else toast.error('Could not copy link');
  }
}

function PersonButton({
  person,
  selected,
  onToggle,
}: {
  person: SharePerson;
  selected: boolean;
  onToggle: () => void;
}) {
  const name = person.display_name || 'User';
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className="flex w-[76px] shrink-0 flex-col items-center gap-1"
    >
      <span className={`relative rounded-full ${selected ? 'ring-2 ring-primary ring-offset-2 ring-offset-card' : ''}`}>
        <Avatar className="h-14 w-14">
          <AvatarImage src={person.avatar_url || undefined} />
          <AvatarFallback className="bg-muted text-muted-foreground">{name.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        {selected && (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-3 w-3" />
          </span>
        )}
      </span>
      <span className="w-full truncate text-center text-xs text-foreground">{name}</span>
    </button>
  );
}

function PeopleRow({
  label,
  people,
  selected,
  onToggle,
}: {
  label: string;
  people: SharePerson[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  if (people.length === 0) return null;
  return (
    <div>
      <p className="mono-label mb-2 text-[10px] text-muted-foreground">{label}</p>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {people.map((person) => (
          <PersonButton
            key={person.user_id}
            person={person}
            selected={selected.includes(person.user_id)}
            onToggle={() => onToggle(person.user_id)}
          />
        ))}
      </div>
    </div>
  );
}

export function ShareSheet({
  open,
  onOpenChange,
  target,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: ShareTarget | null;
}) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [repostOpen, setRepostOpen] = useState(false);
  const { recent, suggested, results, searching, isLoading } = useShareRecipients(open, search);
  const { postIds } = useMyReposts();
  const { sendShare, addPostToStory, repostPost, undoRepost } = useSharingActions();

  const toggle = (id: string) => {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const close = () => {
    setSelected([]);
    setNote('');
    setSearch('');
    onOpenChange(false);
  };

  const post = target?.kind === 'post' ? target.post : null;
  const alreadyReposted = post ? postIds.has(post.id) : false;
  const showRepost = post ? canRepostMedia(post.media_type, post.user_id, user?.id) || alreadyReposted : false;
  const showStory = Boolean(post?.media_url && (post.media_type === 'photo' || post.media_type === 'video'));

  const send = async () => {
    if (!target) return;
    try {
      await sendShare.mutateAsync({ target, recipientIds: selected, note });
      close();
    } catch {
      // The send action already reports the error.
    }
  };

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <SheetContent side="bottom" className="z-[80] max-h-[85vh] rounded-t-[28px] px-4 pb-6 pt-4">
        <SheetHeader className="space-y-1 text-left">
          <SheetTitle>Send</SheetTitle>
          <SheetDescription className="sr-only">Choose people, copy the link, or add it to your story</SheetDescription>
        </SheetHeader>

        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search"
          aria-label="Search people"
          className="mt-3"
        />

        <div className="mt-4 space-y-4">
          {isLoading && <p className="text-sm text-muted-foreground">Loading</p>}
          {searching ? (
            <PeopleRow label="Results" people={results} selected={selected} onToggle={toggle} />
          ) : (
            <>
              <PeopleRow label="Recent" people={recent} selected={selected} onToggle={toggle} />
              <PeopleRow label="Suggested" people={suggested} selected={selected} onToggle={toggle} />
            </>
          )}
          {!isLoading && searching && results.length === 0 && (
            <p className="text-sm text-muted-foreground">No people</p>
          )}
          {!isLoading && !searching && recent.length === 0 && suggested.length === 0 && (
            <p className="text-sm text-muted-foreground">No people yet</p>
          )}
        </div>

        {selected.length > 0 && (
          <div className="mt-4 space-y-2">
            <Input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Message"
              aria-label="Message"
            />
            <Button className="min-h-11 w-full" onClick={send} disabled={sendShare.isPending}>
              {selected.length > 1 ? `Send (${selected.length})` : 'Send'}
            </Button>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-4">
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => target && copyLink(shareUrlFor(target))}
          >
            <Link2 className="h-4 w-4" />
            Copy link
          </Button>
          {showStory && target?.kind === 'post' && (
            <Button
              variant="outline"
              className="min-h-11"
              disabled={addPostToStory.isPending}
              onClick={async () => {
                if (target?.kind !== 'post') return;
                try {
                  await addPostToStory.mutateAsync(target);
                  close();
                } catch {
                  // The story action already reports the error.
                }
              }}
            >
              <Plus className="h-4 w-4" />
              Add to story
            </Button>
          )}
          {showRepost && post && (
            <Button
              variant="outline"
              className="min-h-11"
              disabled={repostPost.isPending || undoRepost.isPending}
              onClick={() => {
                if (alreadyReposted) {
                  undoRepost.mutate(post.id, { onSuccess: close });
                  return;
                }
                setRepostOpen(true);
                close();
              }}
            >
              <Repeat2 className="h-4 w-4" />
              {alreadyReposted ? 'Undo repost' : 'Repost'}
            </Button>
          )}
        </div>
      </SheetContent>
      <RepostComposer
        open={repostOpen}
        onOpenChange={setRepostOpen}
        pending={repostPost.isPending}
        onSubmit={async (caption) => {
          if (!post) return;
          await repostPost.mutateAsync({ postId: post.id, caption });
          close();
        }}
      />
    </Sheet>
  );
}
