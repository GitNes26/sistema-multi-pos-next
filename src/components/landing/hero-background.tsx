"use client"

import { motion } from "framer-motion"
import {
  ShoppingCart,
  Package,
  Coins,
  ScanBarcode,
  TrendingUp,
  Store,
  Truck,
  CreditCard,
  Gift,
  BarChart3,
  Receipt,
  Wallet,
} from "lucide-react"

// Fondo animado del hero: orbes de gradiente + iconos flotantes de negocio/ventas.
// Pensado para transmitir la esencia del sistema (POS, inventario, ventas, entregas).

const ICONS = [
  { Icon: ShoppingCart, name: "cart", top: "12%", left: "6%", size: 28, delay: 0, duration: 7 },
  { Icon: Package, name: "package", top: "68%", left: "8%", size: 24, delay: 1.2, duration: 8 },
  { Icon: Coins, name: "coins", top: "22%", left: "88%", size: 26, delay: 0.6, duration: 6.5 },
  { Icon: ScanBarcode, name: "scan", top: "72%", left: "86%", size: 30, delay: 1.8, duration: 7.5 },
  { Icon: TrendingUp, name: "trend", top: "8%", left: "46%", size: 24, delay: 2.2, duration: 8 },
  { Icon: Store, name: "store", top: "80%", left: "30%", size: 28, delay: 0.9, duration: 7 },
  { Icon: Truck, name: "truck", top: "30%", left: "74%", size: 26, delay: 1.5, duration: 8.5 },
  { Icon: CreditCard, name: "card", top: "52%", left: "16%", size: 24, delay: 2.8, duration: 7 },
  { Icon: Gift, name: "gift", top: "40%", left: "92%", size: 22, delay: 0.3, duration: 7.2 },
  { Icon: BarChart3, name: "chart", top: "84%", left: "60%", size: 24, delay: 2.4, duration: 7.8 },
  { Icon: Receipt, name: "receipt", top: "6%", left: "70%", size: 22, delay: 1.0, duration: 6.8 },
  { Icon: Wallet, name: "wallet", top: "58%", left: "82%", size: 26, delay: 3.2, duration: 8.2 },
]

function FloatingIcon({
  Icon,
  top,
  left,
  size,
  delay,
  duration,
}: (typeof ICONS)[number]) {
  return (
    <motion.div
      aria-hidden
      className="absolute text-white/15"
      style={{ top, left }}
      initial={{ opacity: 0 }}
      animate={{
        opacity: [0, 0.9, 0.9, 0],
        y: [0, -26, -52, -78],
        rotate: [0, 8, -6, 0],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: "easeInOut",
        times: [0, 0.2, 0.8, 1],
      }}
    >
      <Icon style={{ width: size, height: size }} />
    </motion.div>
  )
}

export function HeroBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {/* Orbes de gradiente */}
      <motion.div
        className="absolute -top-32 -left-32 size-[28rem] rounded-full bg-emerald-500/20 blur-3xl"
        animate={{ x: [0, 40, 0], y: [0, 30, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-32 top-10 size-[26rem] rounded-full bg-violet-500/20 blur-3xl"
        animate={{ x: [0, -30, 0], y: [0, 50, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[-8rem] left-1/3 size-[24rem] rounded-full bg-sky-500/20 blur-3xl"
        animate={{ x: [0, 30, 0], y: [0, -30, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Rejilla sutil */}
      <div className="absolute inset-0 [background-image:linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_75%)]" />

      {/* Iconos flotantes */}
      {ICONS.map((item) => (
        <FloatingIcon key={item.name} {...item} />
      ))}
    </div>
  )
}
