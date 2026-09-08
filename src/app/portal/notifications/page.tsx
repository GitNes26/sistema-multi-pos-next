import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { NotificationsClient } from "@/components/portal/notifications-client"

export const metadata = {
  title: "Notificaciones",
}

export default function NotificationsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-lg">
        <div className="flex items-center gap-2 px-4 py-3">
          <Button asChild variant="ghost" size="icon-sm">
            <Link href="/portal">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <h1 className="text-sm font-semibold">Notificaciones</h1>
        </div>
      </div>
      <NotificationsClient />
    </div>
  )
}
