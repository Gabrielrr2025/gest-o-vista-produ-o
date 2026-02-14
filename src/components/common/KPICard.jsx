import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Card KPI Futurista
 * Componente para exibir métricas importantes com design cyberpunk/futurista
 * 
 * @param {string} title - Título do KPI
 * @param {string|number} value - Valor principal a ser exibido
 * @param {string} subtitle - Subtítulo ou descrição adicional
 * @param {object} icon - Ícone Lucide React (ex: <TrendingUp />)
 * @param {number} trend - Valor de tendência em porcentagem (positivo ou negativo)
 * @param {string} trendLabel - Label da tendência (ex: "vs semana anterior")
 * @param {string} variant - Variante de cor: 'cyan', 'purple', 'success', 'warning', 'error'
 * @param {boolean} loading - Estado de carregamento
 */
export default function KPICardFuturistic({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendLabel,
  variant = 'cyan',
  loading = false
}) {
  // Definir cores baseadas na variante
  const variantStyles = {
    cyan: {
      bg: 'from-[hsl(var(--accent-neon))]/10 to-[hsl(var(--accent-neon))]/5',
      border: 'border-[hsl(var(--accent-neon))]/30',
      glow: 'glow-cyan',
      iconBg: 'bg-[hsl(var(--accent-neon))]/20',
      iconColor: 'text-[hsl(var(--accent-neon))]',
      valueColor: 'text-[hsl(var(--accent-neon))]'
    },
    purple: {
      bg: 'from-[hsl(var(--accent-purple))]/10 to-[hsl(var(--accent-purple))]/5',
      border: 'border-[hsl(var(--accent-purple))]/30',
      glow: 'glow-purple',
      iconBg: 'bg-[hsl(var(--accent-purple))]/20',
      iconColor: 'text-[hsl(var(--accent-purple))]',
      valueColor: 'text-[hsl(var(--accent-purple))]'
    },
    success: {
      bg: 'from-[hsl(var(--success-neon))]/10 to-[hsl(var(--success-neon))]/5',
      border: 'border-[hsl(var(--success-neon))]/30',
      glow: 'shadow-[0_0_20px_rgba(0,255,100,0.3)]',
      iconBg: 'bg-[hsl(var(--success-neon))]/20',
      iconColor: 'text-[hsl(var(--success-neon))]',
      valueColor: 'text-[hsl(var(--success-neon))]'
    },
    warning: {
      bg: 'from-[hsl(var(--warning-neon))]/10 to-[hsl(var(--warning-neon))]/5',
      border: 'border-[hsl(var(--warning-neon))]/30',
      glow: 'shadow-[0_0_20px_rgba(255,215,0,0.3)]',
      iconBg: 'bg-[hsl(var(--warning-neon))]/20',
      iconColor: 'text-[hsl(var(--warning-neon))]',
      valueColor: 'text-[hsl(var(--warning-neon))]'
    },
    error: {
      bg: 'from-[hsl(var(--error-neon))]/10 to-[hsl(var(--error-neon))]/5',
      border: 'border-[hsl(var(--error-neon))]/30',
      glow: 'shadow-[0_0_20px_rgba(255,0,100,0.3)]',
      iconBg: 'bg-[hsl(var(--error-neon))]/20',
      iconColor: 'text-[hsl(var(--error-neon))]',
      valueColor: 'text-[hsl(var(--error-neon))]'
    }
  };

  const styles = variantStyles[variant] || variantStyles.cyan;

  // Renderizar ícone de tendência
  const renderTrendIcon = () => {
    if (trend === undefined || trend === null) return null;
    
    if (trend > 0) {
      return <TrendingUp className="w-3.5 h-3.5 text-[hsl(var(--success-neon))]" strokeWidth={2.5} />;
    } else if (trend < 0) {
      return <TrendingDown className="w-3.5 h-3.5 text-[hsl(var(--error-neon))]" strokeWidth={2.5} />;
    } else {
      return <Minus className="w-3.5 h-3.5 text-[hsl(var(--text-tertiary))]" strokeWidth={2.5} />;
    }
  };

  if (loading) {
    return (
      <div className="card-futuristic p-6 relative overflow-hidden">
        <div className="flex items-start justify-between mb-4">
          <div className="skeleton h-10 w-10 rounded-xl"></div>
          <div className="skeleton h-4 w-16 rounded"></div>
        </div>
        <div className="skeleton h-8 w-24 rounded mb-2"></div>
        <div className="skeleton h-3 w-32 rounded"></div>
      </div>
    );
  }

  return (
    <div 
      className={`
        group relative overflow-hidden
        bg-gradient-to-br ${styles.bg}
        backdrop-filter backdrop-blur-md
        border ${styles.border}
        rounded-2xl p-6
        transition-all duration-300
        hover:scale-[1.02]
        ${styles.glow}
      `}
    >
      {/* Top Gradient Line */}
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${styles.border} opacity-50`}></div>
      
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        {/* Icon */}
        {Icon && (
          <div className={`
            ${styles.iconBg} 
            p-3 rounded-xl 
            transition-all duration-300
            group-hover:scale-110
            group-hover:rotate-3
          `}>
            <Icon className={`w-6 h-6 ${styles.iconColor}`} strokeWidth={2} />
          </div>
        )}
        
        {/* Trend Badge */}
        {trend !== undefined && trend !== null && (
          <div className={`
            flex items-center gap-1.5 px-2.5 py-1 rounded-lg
            text-xs font-semibold
            ${trend > 0 
              ? 'bg-[hsl(var(--success-neon))]/10 text-[hsl(var(--success-neon))] border border-[hsl(var(--success-neon))]/30' 
              : trend < 0 
              ? 'bg-[hsl(var(--error-neon))]/10 text-[hsl(var(--error-neon))] border border-[hsl(var(--error-neon))]/30'
              : 'bg-[hsl(var(--text-muted))]/10 text-[hsl(var(--text-tertiary))] border border-[hsl(var(--text-muted))]/30'
            }
          `}>
            {renderTrendIcon()}
            <span>{Math.abs(trend)}%</span>
          </div>
        )}
      </div>

      {/* Title */}
      <h3 className="text-sm font-medium text-[hsl(var(--text-secondary))] uppercase tracking-wide mb-2">
        {title}
      </h3>

      {/* Value */}
      <div className={`text-3xl font-bold ${styles.valueColor} mb-1 tracking-tight`}>
        {value}
      </div>

      {/* Subtitle / Description */}
      {subtitle && (
        <p className="text-xs text-[hsl(var(--text-tertiary))]">
          {subtitle}
        </p>
      )}

      {/* Trend Label */}
      {trendLabel && (
        <p className="text-xs text-[hsl(var(--text-muted))] mt-2 flex items-center gap-1.5">
          {trendLabel}
        </p>
      )}

      {/* Bottom Decorative Line */}
      <div className={`
        absolute bottom-0 left-0 right-0 h-1 
        bg-gradient-to-r ${styles.border}
        opacity-0 group-hover:opacity-100
        transition-opacity duration-300
      `}></div>
    </div>
  );
}
