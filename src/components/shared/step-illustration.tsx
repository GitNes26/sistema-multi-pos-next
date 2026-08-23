"use client";

import { motion } from "framer-motion";

// Animated step illustrations for order tracking — pure framer-motion, no Lottie dependency.

const bounce = {
  animate: { y: [0, -6, 0], transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" } },
};

const pulse = {
  animate: { scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7], transition: { duration: 2, repeat: Infinity, ease: "easeInOut" } },
};

const spin = {
  animate: { rotate: 360, transition: { duration: 3, repeat: Infinity, ease: "linear" } },
};

const slideRight = {
  animate: { x: [0, 8, 0], transition: { duration: 1.2, repeat: Infinity, ease: "easeInOut" } },
};

const checkmark = {
  animate: { pathLength: [0, 1], transition: { duration: 0.8, ease: "easeOut" } },
};

export function StepIllustration({ step, size = 80 }: { step: string; size?: number }) {
  const s = size;

  if (step === "pending") {
    return (
      <svg width={s} height={s} viewBox="0 0 80 80" fill="none">
        <motion.circle cx="40" cy="40" r="36" stroke="#f59e0b" strokeWidth="3" fill="#fef3c7" {...pulse} />
        <motion.g {...bounce}>
          <rect x="32" y="22" width="16" height="20" rx="3" fill="#f59e0b" />
          <rect x="36" y="18" width="8" height="6" rx="2" fill="#d97706" />
          <circle cx="40" cy="32" r="2" fill="#fff" />
          <line x1="40" y1="26" x2="40" y2="34" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="40" y1="34" x2="44" y2="31" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
        </motion.g>
        <motion.text x="40" y="62" textAnchor="middle" fontSize="9" fill="#92400e" fontWeight="600" animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }}>
          Esperando...
        </motion.text>
      </svg>
    );
  }

  if (step === "confirmed") {
    return (
      <svg width={s} height={s} viewBox="0 0 80 80" fill="none">
        <motion.circle cx="40" cy="40" r="36" stroke="#0ea5e9" strokeWidth="3" fill="#e0f2fe" {...pulse} />
        <motion.g {...bounce}>
          <circle cx="40" cy="32" r="10" fill="#0ea5e9" />
          <motion.path d="M36 32 L39 35 L44 29" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" {...checkmark} />
        </motion.g>
        <motion.g {...slideRight}>
          <rect x="28" y="50" width="24" height="6" rx="3" fill="#bae6fd" />
          <rect x="28" y="50" width="12" height="6" rx="3" fill="#0ea5e9" />
        </motion.g>
      </svg>
    );
  }

  if (step === "preparing") {
    return (
      <svg width={s} height={s} viewBox="0 0 80 80" fill="none">
        <motion.circle cx="40" cy="40" r="36" stroke="#f97316" strokeWidth="3" fill="#fff7ed" {...pulse} />
        <motion.g {...spin} style={{ transformOrigin: "40px 32px" }}>
          <circle cx="40" cy="32" r="12" stroke="#f97316" strokeWidth="2" fill="none" strokeDasharray="4 3" />
        </motion.g>
        <motion.g {...bounce}>
          <rect x="34" y="26" width="12" height="12" rx="2" fill="#f97316" />
          <rect x="37" y="23" width="6" height="4" rx="1" fill="#ea580c" />
        </motion.g>
        {/* Steam lines */}
        <motion.path d="M36 22 Q34 18 36 14" stroke="#f97316" strokeWidth="1.5" fill="none" strokeLinecap="round" animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }} transition={{ duration: 1, repeat: Infinity, delay: 0 }} />
        <motion.path d="M40 20 Q38 16 40 12" stroke="#f97316" strokeWidth="1.5" fill="none" strokeLinecap="round" animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }} transition={{ duration: 1, repeat: Infinity, delay: 0.3 }} />
        <motion.path d="M44 22 Q42 18 44 14" stroke="#f97316" strokeWidth="1.5" fill="none" strokeLinecap="round" animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }} transition={{ duration: 1, repeat: Infinity, delay: 0.6 }} />
      </svg>
    );
  }

  if (step === "ready") {
    return (
      <svg width={s} height={s} viewBox="0 0 80 80" fill="none">
        <motion.circle cx="40" cy="40" r="36" stroke="#10b981" strokeWidth="3" fill="#ecfdf5" {...pulse} />
        <motion.g {...bounce}>
          <rect x="28" y="26" width="24" height="18" rx="3" fill="#10b981" />
          <rect x="30" y="28" width="20" height="14" rx="2" fill="#34d399" />
          <motion.path d="M36 35 L39 38 L44 31" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" {...checkmark} />
        </motion.g>
        <rect x="32" y="48" width="16" height="4" rx="2" fill="#a7f3d0" />
      </svg>
    );
  }

  if (step === "in_transit") {
    return (
      <svg width={s} height={s} viewBox="0 0 80 80" fill="none">
        <motion.circle cx="40" cy="40" r="36" stroke="#8b5cf6" strokeWidth="3" fill="#f5f3ff" {...pulse} />
        {/* Road */}
        <line x1="10" y1="52" x2="70" y2="52" stroke="#c4b5fd" strokeWidth="2" strokeDasharray="4 3" />
        {/* Truck body */}
        <motion.g animate={{ x: [0, 4, 0] }} transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}>
          <rect x="22" y="34" width="22" height="14" rx="2" fill="#8b5cf6" />
          <rect x="44" y="38" width="10" height="10" rx="2" fill="#a78bfa" />
          <rect x="46" y="40" width="6" height="5" rx="1" fill="#e0e7ff" />
          {/* Wheels */}
          <circle cx="28" cy="50" r="3" fill="#6d28d9" />
          <circle cx="28" cy="50" r="1.5" fill="#c4b5fd" />
          <circle cx="50" cy="50" r="3" fill="#6d28d9" />
          <circle cx="50" cy="50" r="1.5" fill="#c4b5fd" />
        </motion.g>
        {/* Motion lines */}
        <motion.line x1="16" y1="40" x2="20" y2="40" stroke="#c4b5fd" strokeWidth="1.5" strokeLinecap="round" animate={{ opacity: [0, 1, 0] }} transition={{ duration: 0.8, repeat: Infinity }} />
        <motion.line x1="14" y1="44" x2="19" y2="44" stroke="#c4b5fd" strokeWidth="1.5" strokeLinecap="round" animate={{ opacity: [0, 1, 0] }} transition={{ duration: 0.8, repeat: Infinity, delay: 0.2 }} />
      </svg>
    );
  }

  if (step === "delivered") {
    return (
      <svg width={s} height={s} viewBox="0 0 80 80" fill="none">
        <motion.circle cx="40" cy="40" r="36" stroke="#2563eb" strokeWidth="3" fill="#eff6ff" {...pulse} />
        <motion.g {...bounce}>
          <circle cx="40" cy="34" r="14" fill="#2563eb" />
          <motion.path d="M33 34 L38 39 L47 29" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" {...checkmark} />
        </motion.g>
        {/* Stars */}
        <motion.circle cx="22" cy="22" r="2" fill="#fbbf24" animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0 }} />
        <motion.circle cx="58" cy="24" r="1.5" fill="#fbbf24" animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }} />
        <motion.circle cx="18" cy="48" r="1.5" fill="#fbbf24" animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }} transition={{ duration: 1.5, repeat: Infinity, delay: 1 }} />
      </svg>
    );
  }

  // Fallback
  return (
    <svg width={s} height={s} viewBox="0 0 80 80" fill="none">
      <circle cx="40" cy="40" r="36" stroke="#6b7280" strokeWidth="3" fill="#f9fafb" />
      <circle cx="40" cy="40" r="8" fill="#6b7280" />
    </svg>
  );
}
