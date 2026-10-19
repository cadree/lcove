import { createContext, useContext, useState, ReactNode } from "react";
import { CreateSheet } from "@/components/navigation/CreateSheet";

interface CreateFlowContextValue {
  openCreate: () => void;
}

const CreateFlowContext = createContext<CreateFlowContextValue | null>(null);

export function CreateFlowProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <CreateFlowContext.Provider value={{ openCreate: () => setOpen(true) }}>
      {children}
      <CreateSheet open={open} onOpenChange={setOpen} />
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
