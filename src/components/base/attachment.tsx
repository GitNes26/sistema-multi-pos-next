"use client"

import * as React from "react"
import {
  FileText,
  ImagePlus,
  Loader2,
  Trash2,
  UploadCloud,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { InfoTooltip } from "@/components/base/info-tooltip"

export interface AttachmentProps {
  value?: string | null
  onChange?: (value: string | null) => void
  onFileChange?: (file: File | null) => void
  upload?: (file: File) => Promise<string>
  accept?: string
  maxSizeMB?: number
  label?: string
  helper?: React.ReactNode
  required?: boolean
  disabled?: boolean
  className?: string
  hint?: string
  widthClass?: string
  heightClass?: string
}

const DEFAULT_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,.pdf"

export function Attachment({
  value,
  onChange,
  onFileChange,
  upload,
  accept = DEFAULT_ACCEPT,
  maxSizeMB = 5,
  label,
  helper,
  required,
  disabled,
  className,
  hint,
  widthClass = "w-40",
  heightClass = "h-40",
}: AttachmentProps) {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = React.useState(false)
  const [error, setError] = React.useState<string>()
  const [uploading, setUploading] = React.useState(false)

  const isImage = value?.match(/^data:image\//) || value?.match(/\.(png|jpe?g|webp|gif|svg)$/i)

  async function processFile(file: File) {
    setError(undefined)
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`El archivo excede ${maxSizeMB} MB.`)
      return
    }
    if (accept) {
      const ok = file.type
        ? accept
            .split(",")
            .map((a) => a.trim().toLowerCase())
            .some(
              (a) =>
                a === file.type.toLowerCase() ||
                (a.startsWith(".") && file.name.toLowerCase().endsWith(a))
            )
        : true
      if (!ok) {
        setError("Tipo de archivo no permitido.")
        return
      }
    }
    onFileChange?.(file)
    if (upload) {
      setUploading(true)
      try {
        const url = await upload(file)
        onChange?.(url)
      } catch {
        setError("No se pudo subir el archivo.")
      } finally {
        setUploading(false)
      }
    } else {
      const localUrl = URL.createObjectURL(file)
      onChange?.(localUrl)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void processFile(file)
  }

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="flex items-center gap-1.5">
          <Label className="leading-none">
            {label}
            {required && <span className="text-destructive"> *</span>}
          </Label>
          {helper && <InfoTooltip text={helper} />}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void processFile(file)
          e.target.value = ""
        }}
      />

      <div className={cn("flex items-start gap-3")}>
        {value ? (
          <div
            className={cn(
              "relative overflow-hidden rounded-lg border bg-card",
              widthClass,
              heightClass
            )}
          >
            {uploading && <div className="absolute inset-0 z-10 grid place-items-center bg-background/60"><Loader2 className="size-6 animate-spin" /></div>}
            {isImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={value}
                alt="Adjunto"
                className="size-full object-cover"
              />
            ) : (
              <object
                data={value}
                type="application/pdf"
                className="size-full"
                aria-label="Vista previa de PDF"
              >
                <div className="grid h-full w-full place-items-center text-muted-foreground">
                  <FileText className="size-8" />
                </div>
              </object>
            )}
          </div>
        ) : (
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={cn(
              "flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed text-muted-foreground transition-colors",
              "hover:border-primary/60 hover:bg-accent/40",
              dragging && "border-primary bg-accent",
              widthClass,
              heightClass
            )}
          >
            <UploadCloud className="size-6" />
            <span className="px-2 text-center text-xs">
              Arrastra o haz clic
            </span>
            <span className="px-2 text-center text-[0.7rem] text-muted-foreground/70">
              Máx {maxSizeMB} MB
            </span>
          </button>
        )}

        {value && (
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || uploading}
              onClick={() => inputRef.current?.click()}
            >
              <ImagePlus className="size-4" />
              Reemplazar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled || uploading}
              onClick={() => onChange?.(null)}
            >
              <Trash2 className="size-4" />
              Quitar
            </Button>
          </div>
        )}
      </div>

      {hint && !error && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
      {error && (
        <p className="text-xs leading-relaxed text-destructive">{error}</p>
      )}
    </div>
  )
}