"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { DialogComponent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
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

  const confirm = (value?: string) => {
    const expected =
      (typeof window !== "undefined" && localStorage.getItem(POS_SUPERVISOR_STORAGE_KEY)) ||
      POS_SUPERVISOR_PIN_DEFAULT;
    if ((value ?? pin) === expected) {
      finish(true);
    } else {
      setError(true);
      setPin("");
    }
  };

  return (
    <SupervisorContext.Provider value={{ required, setRequired, setPin, requestSupervisor }}>
      {children}
      <DialogComponent
        open={open}
        onOpenChange={(o) => !o && finish(false)}
        icon={<ShieldCheck className="size-5 text-primary" />}
        title="Aprobación de supervisor"
        description={
          <>
            Se requiere autorización para: <span className="font-semibold text-foreground">{action}</span>
          </>
        }
        className="sm:max-w-sm"
        bodyClassName="space-y-2"
        footerClassName="gap-2"
        footer={
          <>
            <Button variant="outline" onClick={() => finish(false)}>
              Cancelar
            </Button>
            <Button onClick={() => confirm()}>Autorizar</Button>
          </>
        }
      >
          <InputOTP
            maxLength={6}
            value={pin}
            autoFocus
            onChange={(v) => {
              setPin(v.replace(/\D/g, ""));
              setError(false);
            }}
            onComplete={confirm}
          >
            <InputOTPGroup>
              {Array.from({ length: 6 }).map((_, i) => (
                <InputOTPSlot key={i} index={i} />
              ))}
            </InputOTPGroup>
          </InputOTP>
          {error && <p className="text-xs text-destructive">PIN incorrecto</p>}
      </DialogComponent>
    </SupervisorContext.Provider>
  );
}