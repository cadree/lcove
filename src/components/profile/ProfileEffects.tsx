import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ProfileEffectsProps {
  grain?: boolean;
  scanlines?: boolean;
  neonGlow?: boolean;
  holographic?: boolean;
  motionGradient?: boolean;
  className?: string;
  /** Cover the viewport. A cover-sized layer stays hidden under the page background. */
  portal?: boolean;
}


export const ProfileEffects = ({
  grain,
  scanlines,
  neonGlow,
  holographic,
  motionGradient,
  className,
  portal = false,
}: ProfileEffectsProps) => {
  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const effect = (
    <div
      className={cn(
        "pointer-events-none inset-0",
        portal ? "fixed z-40" : "absolute overflow-hidden",
        className,
      )}
      style={portal ? { position: "fixed", inset: 0, zIndex: 40 } : undefined}
      aria-hidden
      data-profile-effects=""
    >
      {grain && (
        <div
          className="absolute inset-0"
          data-effect="grain"
          style={{
            opacity: 0.95,
            mixBlendMode: "screen",
            backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.95) 0.7px, transparent 0.85px), radial-gradient(circle, rgba(255,255,255,0.55) 0.6px, transparent 0.75px)",
            backgroundSize: "3px 3px, 5px 4px",
            backgroundPosition: "0 0, 1px 2px",
          }}
        />
      )}

      {scanlines && (
        <div
          className="absolute inset-0"
          data-effect="scanlines"
          style={{
            backgroundImage: "repeating-linear-gradient(to bottom, rgba(255,255,255,0.55) 0px, rgba(255,255,255,0.55) 2px, transparent 2px, transparent 6px)",
          }}
        />
      )}

      {neonGlow && (
        <motion.div
          className="absolute inset-3"
          data-effect="neon"
          style={{
            border: "3px solid #00ff9f",
            borderRadius: 16,
            boxShadow: "0 0 28px #00ff9f, inset 0 0 48px rgba(0,255,159,0.8), inset 0 0 140px rgba(0,255,159,0.35)",
          }}
          animate={prefersReducedMotion ? undefined : {
            boxShadow: [
              "0 0 28px #00ff9f, inset 0 0 48px rgba(0,255,159,0.8), inset 0 0 140px rgba(0,255,159,0.35)",
              "0 0 48px #00ff9f, inset 0 0 80px rgba(0,255,159,0.95), inset 0 0 180px rgba(0,255,159,0.5)",
              "0 0 28px #00ff9f, inset 0 0 48px rgba(0,255,159,0.8), inset 0 0 140px rgba(0,255,159,0.35)",
            ],
          }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {holographic && (
        <motion.div
          className="absolute inset-0"
          data-effect="holographic"
          style={{
            opacity: 0.72,
            mixBlendMode: "screen",
            background: "linear-gradient(115deg, #ff4d8d 0%, #7af 28%, #0ff 52%, #df0 76%, #f6f 100%)",
            backgroundSize: "220% 220%",
          }}
          animate={prefersReducedMotion ? undefined : { backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"] }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        />
      )}

      {motionGradient && (
        <motion.div
          className="absolute inset-0"
          data-effect="motion"
          style={{
            opacity: 0.7,
            mixBlendMode: "screen",
            background: "linear-gradient(120deg, #00ff9f 0%, #ff00aa 46%, #00c2ff 100%)",
            backgroundSize: "200% 200%",
          }}
          animate={prefersReducedMotion ? undefined : { backgroundPosition: ["0% 40%", "100% 60%", "0% 40%"] }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        />
      )}
    </div>
  );

  if (portal && typeof document !== "undefined") return createPortal(effect, document.body);
  return effect;
};

// Holographic card wrapper for Cyberpunk theme
export const HolographicCard = ({ 
  children, 
  className,
  enabled = true,
}: { 
  children: React.ReactNode; 
  className?: string;
  enabled?: boolean;
}) => {
  const prefersReducedMotion = typeof window !== 'undefined' 
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!enabled || prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={cn("relative overflow-hidden", className)}
      whileHover={{
        boxShadow: '0 0 30px rgba(0, 255, 159, 0.3), 0 0 60px rgba(255, 0, 255, 0.1)',
      }}
    >
      {/* Holographic edge effect */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(135deg, transparent 40%, rgba(0,255,159,0.1) 50%, transparent 60%)',
          backgroundSize: '200% 200%',
        }}
        animate={{
          backgroundPosition: ['-100% -100%', '200% 200%'],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
      {children}
    </motion.div>
  );
};

// Animated progress bar for Cyberpunk theme
export const CyberpunkProgressBar = ({
  value,
  max = 100,
  label,
  className,
}: {
  value: number;
  max?: number;
  label?: string;
  className?: string;
}) => {
  const percentage = (value / max) * 100;
  const prefersReducedMotion = typeof window !== 'undefined' 
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div className={cn("space-y-1", className)}>
      {label && (
        <div className="flex justify-between text-xs">
          <span className="text-[#00ff9f] font-mono">{label}</span>
          <span className="text-[#00ff9f]/70 font-mono">{value}/{max}</span>
        </div>
      )}
      <div className="relative h-2 bg-black border border-cyan-500/30 overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500 to-green-400"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
        {!prefersReducedMotion && (
          <motion.div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
              backgroundSize: '50% 100%',
            }}
            animate={{
              backgroundPosition: ['-100% 0%', '200% 0%'],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'linear',
            }}
          />
        )}
      </div>
    </div>
  );
};

// Neon text effect
export const NeonText = ({
  children,
  color = '#00ff9f',
  className,
}: {
  children: React.ReactNode;
  color?: string;
  className?: string;
}) => {
  return (
    <span
      className={cn("relative", className)}
      style={{
        color: color,
        textShadow: `0 0 10px ${color}, 0 0 20px ${color}, 0 0 30px ${color}`,
      }}
    >
      {children}
    </span>
  );
};
