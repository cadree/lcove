import { createContext, lazy, Suspense, useContext, useState, ReactNode } from "react";

const CreateSheet = lazy(() =>
  import("@/components/navigation/CreateSheet").then((module) => ({ default: module.CreateSheet })),
);

const CreateShareFlow = lazy(() => import("./CreateShareFlow").then(m => ({ default: m.CreateShareFlow })));
const StoryUpload = lazy(() => import("@/components/stories/StoryUpload"));

interface CreateFlowContextValue {
  openShare: () => void;
  openStory: () => void;
  openCreate: () => void;
}

const CreateFlowContext = createContext<CreateFlowContextValue | null>(null);

export function CreateFlowProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const [shareOpen, setShareOpen] = useState(false);
  const [storyOpen, setStoryOpen] = useState(false);

  return (
    <CreateFlowContext.Provider value={{ openCreate: () => setOpen(true), openShare: () => { setOpen(false); setShareOpen(true); }, openStory: () => { setOpen(false); setStoryOpen(true); } }}>
      {children}
      <Suspense fallback={null}>
        {open ? <CreateSheet open={open} onOpenChange={setOpen} /> : null}
        {shareOpen && <CreateShareFlow open={shareOpen} onOpenChange={setShareOpen} />}
        {storyOpen && <StoryUpload open={storyOpen} onOpenChange={setStoryOpen} />}
      </Suspense>
    </CreateFlowContext.Provider>
  );
}

export function useCreateFlow() {
  const context = useContext(CreateFlowContext);
  if (!context) {
    throw new Error("useCreateFlow must be used within CreateFlowProvider");
  }
  return context;
}
