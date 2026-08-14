"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck } from "lucide-react";
import {
  POS_SUPERVISOR_PIN_DEFAULT,
  POS_SUPERVISOR_STORAGE_KEY,
} from "@/lib/pos/config";

interface SupervisorContextValue {
  required: boolean;
  setRequired: (value: boolean) => void;
  setPin: (pin: string) => void;
  requestSupervisor: (action: string) => Promise<boolean>;
}

const SupervisorContext = createContext<SupervisorContextValue>({
  required: false,
  setRequired: () => undefined,
  setPin: () => undefined,
  requestSupervisor: async () => true,
});

export function useSupervisor() {
  return useContext(SupervisorContext);
}

/**
 * 6.19 – Aprobación de supervisor. En demo el PIN se guarda en localStorage;
 * en producción se valida contra el permiso RBAC `supervisor.approve`.
 */
export function SupervisorProvider({ children }: { children: ReactNode }) {
  const [required, setRequiredState] = useState(false);
  const [pin, setPinState] = useState("");
  const [open, setOpen] = useState(false);
  const [action, setAction] = useState("");
  const [error, setError] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const requestSupervisor = useCallback(
    (act: string) =>
      new Promise<boolean>((resolve) => {
        if (!required) {
          resolve(true);
          return;
        }
        setAction(act);
        setPin("");
        setError(false);
        setOpen(true);
        resolver.current = resolve;
      }),
    [required]
  );

  const setRequired = (value: boolean) => setRequiredState(value);
  const setPin = (value: string) => setPinState(value);

  const finish = (ok: boolean) => {
    setOpen(false);
    resolver.current?.(ok);
    resolver.current = null;
  };

  const confirm = () => {
    const expected =
      (typeof window !== "undefined" && localStorage.getItem(POS_SUPERVISOR_STORAGE_KEY)) ||
      POS_SUPERVISOR_PIN_DEFAULT;
    if (pin === expected) {
      finish(true);
    } else {
      setError(true);
      setPin("");
    }
  };

  return (
    <SupervisorContext.Provider value={{ required, setRequired, setPin, requestSupervisor }}>
      {children}
      <Dialog open={open} onOpenChange={(o) => !o && finish(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" /> Aprobación de supervisor
            </DialogTitle>
            <DialogDescription>
              Se requiere autorización para: <span className="font-semibold text-foreground">{action}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              type="password"
              inputMode="numeric"
              autoFocus
              maxLength={6}
              placeholder="PIN del supervisor"
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, ""));
                setError(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && confirm()}
            />
            {error && <p className="text-xs text-destructive">PIN incorrecto</p>}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => finish(false)}>
              Cancelar
            </Button>
            <Button onClick={confirm}>Autorizar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SupervisorContext.Provider>
  );
}