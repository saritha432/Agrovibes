import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { CreateModal } from "../components/create/CreateModal";

type CreateModalContextValue = {
  openCreate: () => void;
  closeCreate: () => void;
};

const CreateModalContext = createContext<CreateModalContextValue | null>(null);

export function CreateModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const openCreate = useCallback(() => setOpen(true), []);
  const closeCreate = useCallback(() => setOpen(false), []);

  const value = useMemo(() => ({ openCreate, closeCreate }), [openCreate, closeCreate]);

  return (
    <CreateModalContext.Provider value={value}>
      {children}
      <CreateModal open={open} onClose={closeCreate} />
    </CreateModalContext.Provider>
  );
}

export function useCreateModal() {
  const ctx = useContext(CreateModalContext);
  if (!ctx) throw new Error("useCreateModal must be used within CreateModalProvider");
  return ctx;
}
