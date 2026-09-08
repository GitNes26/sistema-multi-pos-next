"use client";

import { DialogComponent } from "@/components/ui/dialog";
import { ReservationWizard } from "@/components/reservations/reservation-wizard";

// Wizard de reservación para el panel: mismo flujo a pasos que portal/invitado
// (sucursal → calendario según política → hora/asientos → sala → datos). Al
// terminar refresca el plano/avisos vía el callback del padre.

export function ReservationWizardDialog({
  open,
  onOpenChange,
  locations,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locations: { id: string; name: string }[];
}) {
  return (
    <DialogComponent open={open} onOpenChange={onOpenChange} title="Nueva reservación">
      <div className="max-h-[70vh] overflow-y-auto p-4">
        <ReservationWizard
          locations={locations}
          createUrl="/api/table-reservations"
          availabilityUrl="/api/table-reservations/availability?"
          onDone={() => onOpenChange(false)}
        />
      </div>
    </DialogComponent>
  );
}
