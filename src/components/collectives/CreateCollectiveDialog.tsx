import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useCreateCollective, COLLECTIVE_TOPICS } from "@/hooks/useCollectives";
import { useUserSearch } from "@/hooks/useUserSearch";
import { Camera, X, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CreateCollectiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const topicLabels: Record<string, string> = {
  models: "Models",
  dancers: "Dancers",
  djs: "DJs",
  filmmakers: "Filmmakers",
  photographers: "Photographers",
  musicians: "Musicians",
  travelers: "Travelers",
  writers: "Writers",
  artists: "Artists",
  general: "General",
};

export function CreateCollectiveDialog({
  open,
  onOpenChange,
}: CreateCollectiveDialogProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [topic, setTopic] = useState("general");
  const [visibility, setVisibility] = useState<"public" | "private" | "discoverable">("public");
  const [maxMembers, setMaxMembers] = useState("100");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<Array<{ id: string; display_name: string; avatar_url: string | null }>>([]);
  const [uploading, setUploading] = useState(false);

  const createMutation = useCreateCollective();
  const { data: searchResults } = useUserSearch(searchQuery);

  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "avatar" | "cover"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `collectives/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("media").getPublicUrl(filePath);

      if (type === "avatar") {
        setAvatarUrl(data.publicUrl);
      } else {
        setCoverImageUrl(data.publicUrl);
      }
    } catch (error: any) {
      toast.error("Failed to upload image: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleCreate = () => {
    createMutation.mutate(
      {
        name,
        description,
        topic,
        visibility,
        maxMembers: parseInt(maxMembers),
        avatarUrl,
        coverImageUrl,
        inviteUserIds: selectedUsers.map((u) => u.id),
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          resetForm();
        },
      }
    );
  };

  const resetForm = () => {
    setStep(1);
    setName("");
    setDescription("");
    setTopic("general");
    setVisibility("public");
    setMaxMembers("100");
    setAvatarUrl("");
    setCoverImageUrl("");
    setSearchQuery("");
    setSelectedUsers([]);
  };

  const addUser = (user: { id: string; display_name: string; avatar_url: string | null }) => {
    if (!selectedUsers.find((u) => u.id === user.id)) {
      setSelectedUsers([...selectedUsers, user]);
    }
    setSearchQuery("");
  };

  const removeUser = (userId: string) => {
    setSelectedUsers(selectedUsers.filter((u) => u.id !== userId));
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return name.trim().length > 0;
      case 2:
        return true;
      case 3:
        return true;
      case 4:
        return true;
      default:
        return false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Collective</DialogTitle>
        </DialogHeader>

        <div className="mb-4">
          <Progress value={(step / 4) * 100} className="h-1" />
          <p className="text-xs text-muted-foreground mt-2">Step {step} of 4</p>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Collective Name</Label>
              <Input
                id="name"
                placeholder="Enter a name for your collective"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="topic">Topic/Focus</Label>
              <Select value={topic} onValueChange={setTopic}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLLECTIVE_TOPICS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {topicLabels[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="What is this collective about?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-3">
              <Label>Who can join?</Label>
              <RadioGroup value={visibility} onValueChange={(v) => setVisibility(v as any)}>
                <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="public" id="public" className="mt-0.5" />
                  <div>
                    <Label htmlFor="public" className="cursor-pointer font-medium">
                      Public
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Anyone can join freely
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="discoverable" id="discoverable" className="mt-0.5" />
                  <div>
                    <Label htmlFor="discoverable" className="cursor-pointer font-medium">
                      Discoverable
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Visible to all, but requires approval to join
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                  <RadioGroupItem value="private" id="private" className="mt-0.5" />
                  <div>
                    <Label htmlFor="private" className="cursor-pointer font-medium">
                      Private
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Invite only, not visible in discovery
                    </p>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxMembers">Max Members</Label>
              <Input
                id="maxMembers"
                type="number"
                min="2"
                max="1000"
                value={maxMembers}
                onChange={(e) => setMaxMembers(e.target.value)}
              />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Collective Avatar</Label>
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20 rounded-xl">
                  <AvatarImage src={avatarUrl} />
                  <AvatarFallback className="rounded-xl bg-primary/10 text-primary text-xl">
                    {name.charAt(0) || "C"}
                  </AvatarFallback>
                </Avatar>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleImageUpload(e, "avatar")}
                    disabled={uploading}
                  />
                  <Button variant="outline" size="sm" asChild disabled={uploading}>
                    <span>
                      {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Camera className="h-4 w-4 mr-2" />
                      )}
                      Upload
                    </span>
                  </Button>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cover Image (optional)</Label>
              <div className="relative">
                {coverImageUrl ? (
                  <div className="relative aspect-[3/1] rounded-lg overflow-hidden bg-muted">
                    <img
                      src={coverImageUrl}
                      alt="Cover"
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={() => setCoverImageUrl("")}
                      className="absolute top-2 right-2 p-1 bg-black/50 rounded-full"
                    >
                      <X className="h-4 w-4 text-white" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer block">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleImageUpload(e, "cover")}
                      disabled={uploading}
                    />
                    <div className="aspect-[3/1] rounded-lg border-2 border-dashed flex items-center justify-center hover:bg-muted/50 transition-colors">
                      {uploading ? (
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      ) : (
                        <Camera className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                  </label>
                )}
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="search">Invite Members (optional)</Label>
              <Input
                id="search"
                placeholder="Search users to invite..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {searchQuery && searchResults && searchResults.length > 0 && (
              <div className="border rounded-lg max-h-40 overflow-auto">
                {searchResults.slice(0, 5).map((user) => (
                  <button
                    key={user.user_id}
                    onClick={() =>
                      addUser({
                        id: user.user_id,
                        display_name: user.display_name || "User",
                        avatar_url: user.avatar_url,
                      })
                    }
                    className="w-full flex items-center gap-3 p-2 hover:bg-muted transition-colors"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatar_url || undefined} />
                      <AvatarFallback>
                        {(user.display_name || "U").charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm">{user.display_name}</span>
                  </button>
                ))}
              </div>
            )}

            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map((user) => (
                  <Badge key={user.id} variant="secondary" className="gap-1 pr-1">
                    @{user.display_name}
                    <button
                      onClick={() => removeUser(user.id)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              You can always invite more members later.
            </p>
          </div>
        )}

        <div className="flex justify-between pt-4">
          {step > 1 ? (
            <Button variant="ghost" onClick={() => setStep(step - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canProceed()}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending || !canProceed()}
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Create Collective
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
