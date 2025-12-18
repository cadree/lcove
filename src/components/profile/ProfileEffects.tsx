import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ProfileEffectsProps {
  grain?: boolean;
  scanlines?: boolean;
  neonGlow?: boolean;
  holographic?: boolean;
  motionGradient?: boolean;
  className?: string;
}

export const ProfileEffects = ({
  grain,
  scanlines,
  neonGlow,
  holographic,
  motionGradient,
  className,
}: ProfileEffectsProps) => {
  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined' 
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {/* Grain Effect */}
      {grain && (
        <div 
          className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          }}
        />
      )}

      {/* Scanlines Effect */}
      {scanlines && (
        <div 
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)',
            backgroundSize: '100% 4px',
          }}
        />
      )}

      {/* Neon Glow Effect */}
      {neonGlow && !prefersReducedMotion && (
        <motion.div
          className="absolute inset-0"
          animate={{
            boxShadow: [
              'inset 0 0 60px rgba(0, 255, 159, 0.1)',
              'inset 0 0 80px rgba(0, 255, 159, 0.15)',
              'inset 0 0 60px rgba(0, 255, 159, 0.1)',
            ],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}

      {/* Holographic Border Effect */}
      {holographic && !prefersReducedMotion && (
        <motion.div
          className="absolute inset-0 rounded-inherit"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(0,255,159,0.1), rgba(255,0,255,0.1), rgba(0,255,255,0.1), transparent)',
            backgroundSize: '200% 100%',
          }}
          animate={{
            backgroundPosition: ['0% 0%', '200% 0%'],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      )}

      {/* Motion Gradient Background */}
      {motionGradient && !prefersReducedMotion && (
        <motion.div
          className="absolute inset-0 opacity-20"
          style={{
            background: 'linear-gradient(45deg, #00ff9f, #ff00ff, #00ffff, #ff00ff, #00ff9f)',
            backgroundSize: '400% 400%',
          }}
          animate={{
            backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      )}
    </div>
  );
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
