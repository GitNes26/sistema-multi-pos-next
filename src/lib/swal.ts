import Swal, { SweetAlertIcon, SweetAlertOptions } from "sweetalert2"
import "sweetalert2/dist/sweetalert2.min.css"

export type SwalIcon = SweetAlertIcon

export interface ConfirmOptions {
  confirmText?: string
  cancelText?: string
  danger?: boolean
  icon?: SwalIcon
  titleText?: string
  reverseButtons?: boolean
}

const baseOptions = (danger = false): SweetAlertOptions => ({
  buttonsStyling: false,
  customClass: {
    container: "swal2-container-custom",
    popup: "swal2-popup-custom",
    title: "swal2-title-custom",
    htmlContainer: "swal2-html-custom",
    confirmButton: danger
      ? "swal2-confirm-custom swal2-danger-mode"
      : "swal2-confirm-custom",
    cancelButton: "swal2-cancel-custom",
    closeButton: "swal2-close-custom",
    footer: "swal2-footer-custom",
    loader: "swal2-loader-custom",
    icon: "swal2-icon-custom",
    validationMessage: "swal2-validation-custom",
  },
  showClass: { popup: "swal2-popup-custom-show" },
  hideClass: { popup: "swal2-popup-custom-hide" },
})

export function swalToast(
  title: string,
  icon: SwalIcon = "success",
  timer = 2400
) {
  return Swal.fire({
    ...baseOptions(),
    toast: true,
    position: "bottom-end",
    icon,
    title,
    timer,
    timerProgressBar: true,
    showConfirmButton: false,
  })
}

/** Toast de notificación entrante (FASE 11.4) con título + descripción. */
export function swalNotificationToast(n: {
  title: string;
  description?: string;
  href?: string;
}) {
  return Swal.fire({
    ...baseOptions(),
    toast: true,
    position: "top-end",
    timer: 5000,
    timerProgressBar: true,
    showConfirmButton: false,
    showCloseButton: true,
    allowOutsideClick: false,
    customClass: {
      ...baseOptions().customClass,
      popup: "swal2-popup-custom swal2-toast swal2-toast-notif",
    },
    title: n.title,
    html: n.description
      ? `<div class="swal2-notification-desc">${n.description}</div>`
      : undefined,
    didOpen: (el) => {
      const href = n.href;
      if (href) {
        el.addEventListener("click", () => {
          if (window.location.pathname !== href) {
            window.location.assign(href);
          }
          Swal.close();
        });
      }
    },
  })
}

export function swalMessage(title: string, icon: SwalIcon = "info") {
  return Swal.fire({
    ...baseOptions(),
    icon,
    title,
    width: "min(92vw, 26rem)",
  })
}

export function swalError(title: string, text?: string) {
  return Swal.fire({
    ...baseOptions(),
    icon: "error",
    title,
    text,
    confirmButtonText: "Entendido",
    width: "min(92vw, 26rem)",
  })
}

export async function swalConfirm(
  title: string,
  text?: string,
  opts: ConfirmOptions = {}
): Promise<boolean> {
  const {
    confirmText = "Confirmar",
    cancelText = "Cancelar",
    danger = false,
    icon = "warning",
    reverseButtons = false,
  } = opts

  const result = await Swal.fire({
    ...baseOptions(danger),
    icon,
    title,
    text,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    reverseButtons,
    width: "min(92vw, 28rem)",
    focusCancel: true,
  })

  return result.isConfirmed
}

export function swalLoading(title: string, text?: string) {
  return Swal.fire({
    ...baseOptions(),
    title,
    text,
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    didOpen: () => Swal.showLoading(),
  })
}

export function swalClose() {
  if (Swal.isVisible()) Swal.close()
}

export function swalPrompt(
  title: string,
  inputPlaceholder: string,
  currentValue?: string,
  hint?: string
): Promise<string | null> {
  return Swal.fire<string>({
    ...baseOptions(),
    title,
    input: "text",
    inputValue: currentValue ?? "",
    inputPlaceholder,
    inputLabel: hint,
    showCancelButton: true,
    confirmButtonText: "Guardar",
    cancelButtonText: "Cancelar",
    inputValidator: (v) => (!v || !v.trim() ? "Este campo es obligatorio" : null),
  }).then((r) => (r.isConfirmed ? (r.value ?? "") : null))
}