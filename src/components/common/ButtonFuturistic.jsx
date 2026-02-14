import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Botão Futurista
 * Componente de botão com design cyberpunk/futurista
 * 
 * @param {React.ReactNode} children - Conteúdo do botão
 * @param {string} variant - Variante: 'primary', 'secondary', 'ghost', 'danger', 'success'
 * @param {string} size - Tamanho: 'sm', 'md', 'lg'
 * @param {boolean} loading - Estado de carregamento
 * @param {boolean} disabled - Estado desabilitado
 * @param {function} onClick - Função de clique
 * @param {string} className - Classes CSS adicionais
 * @param {object} icon - Ícone Lucide React (opcional)
 * @param {string} iconPosition - Posição do ícone: 'left', 'right'
 */
export default function ButtonFuturistic({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  onClick,
  className = '',
  icon: Icon,
  iconPosition = 'left',
  type = 'button',
  ...props
}) {
  // Variantes de estilo
  const variants = {
    primary: `
      relative overflow-hidden
      bg-gradient-to-r from-[hsl(var(--accent-neon))] to-[hsl(var(--accent-purple))]
      text-[hsl(var(--bg-void))]
      border-none
      shadow-[0_0_20px_rgba(0,255,255,0.3),0_4px_12px_rgba(0,0,0,0.4)]
      hover:shadow-[0_0_30px_rgba(0,255,255,0.5),0_8px_20px_rgba(0,0,0,0.5)]
      hover:-translate-y-0.5
      active:translate-y-0
      disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0
    `,
    secondary: `
      bg-[hsl(var(--bg-elevated))]
      text-[hsl(var(--text-primary))]
      border border-[hsl(var(--border-medium))]
      shadow-[var(--shadow-soft)]
      hover:bg-[hsl(var(--bg-surface))]
      hover:border-[hsl(var(--accent-neon))]
      hover:shadow-[0_0_15px_rgba(0,255,255,0.2),var(--shadow-medium)]
      hover:-translate-y-0.5
      active:translate-y-0
      disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0
    `,
    ghost: `
      bg-transparent
      text-[hsl(var(--text-secondary))]
      border border-transparent
      hover:bg-[hsl(var(--bg-surface))]
      hover:text-[hsl(var(--text-primary))]
      hover:border-[hsl(var(--border-subtle))]
      active:bg-[hsl(var(--bg-dark))]
      disabled:opacity-40 disabled:cursor-not-allowed
    `,
    danger: `
      relative overflow-hidden
      bg-gradient-to-r from-[hsl(var(--error-neon))] to-red-600
      text-white
      border-none
      shadow-[0_0_20px_rgba(255,0,100,0.3),0_4px_12px_rgba(0,0,0,0.4)]
      hover:shadow-[0_0_30px_rgba(255,0,100,0.5),0_8px_20px_rgba(0,0,0,0.5)]
      hover:-translate-y-0.5
      active:translate-y-0
      disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0
    `,
    success: `
      relative overflow-hidden
      bg-gradient-to-r from-[hsl(var(--success-neon))] to-green-500
      text-[hsl(var(--bg-void))]
      border-none
      shadow-[0_0_20px_rgba(0,255,100,0.3),0_4px_12px_rgba(0,0,0,0.4)]
      hover:shadow-[0_0_30px_rgba(0,255,100,0.5),0_8px_20px_rgba(0,0,0,0.5)]
      hover:-translate-y-0.5
      active:translate-y-0
      disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-y-0
    `,
  };

  // Tamanhos
  const sizes = {
    sm: 'px-3 py-2 text-xs rounded-lg',
    md: 'px-4 py-2.5 text-sm rounded-xl',
    lg: 'px-6 py-3.5 text-base rounded-xl',
  };

  // Classes do ícone baseadas no tamanho
  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        ${variants[variant]}
        ${sizes[size]}
        font-semibold
        transition-all duration-300 ease-out
        inline-flex items-center justify-center gap-2
        ${className}
      `}
      {...props}
    >
      {/* Shimmer effect para variantes primary, danger e success */}
      {(variant === 'primary' || variant === 'danger' || variant === 'success') && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent transform -translate-x-full hover:translate-x-full transition-transform duration-700 ease-out pointer-events-none"></div>
      )}

      {/* Loading spinner */}
      {loading && (
        <Loader2 className={`${iconSizes[size]} animate-spin`} strokeWidth={2.5} />
      )}

      {/* Icon esquerdo */}
      {!loading && Icon && iconPosition === 'left' && (
        <Icon className={iconSizes[size]} strokeWidth={2} />
      )}

      {/* Children */}
      <span className="relative z-10">{children}</span>

      {/* Icon direito */}
      {!loading && Icon && iconPosition === 'right' && (
        <Icon className={iconSizes[size]} strokeWidth={2} />
      )}
    </button>
  );
}
