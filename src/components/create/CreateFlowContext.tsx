import { createContext, lazy, Suspense, useContext, useState, ReactNode } from "react";

const CreateSheet = lazy(() =>
  import("@/components/navigation/CreateSheet").then((module) => ({ default: module.CreateSheet })),
);

interface CreateFlowContextValue {
  openCreate: () => void;
}

const CreateFlowContext = createContext<CreateFlowContextValue | null>(null);

export function CreateFlowProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <CreateFlowContext.Provider value={{ openCreate: () => setOpen(true) }}>
      {children}
      <Suspense fallback={null}>
        {open ? <CreateSheet open={open} onOpenChange={setOpen} /> : null}
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
