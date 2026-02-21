import React, { forwardRef } from 'react';
import { Search, AlertCircle } from 'lucide-react';

/**
 * Input Futurista
 * Componente de input com design cyberpunk/futurista
 * 
 * @param {string} label - Label do input
 * @param {string} placeholder - Placeholder
 * @param {string} type - Tipo do input (text, email, password, number, etc.)
 * @param {string} value - Valor controlado
 * @param {function} onChange - Função de mudança
 * @param {string} error - Mensagem de erro
 * @param {boolean} disabled - Estado desabilitado
 * @param {object} icon - Ícone Lucide React (opcional)
 * @param {string} className - Classes CSS adicionais
 * @param {boolean} fullWidth - Input ocupa toda a largura
 */
const InputFuturistic = forwardRef(({
  label,
  placeholder,
  type = 'text',
  value,
  onChange,
  error,
  disabled = false,
  icon: Icon,
  className = '',
  fullWidth = false,
  helperText,
  ...props
}, ref) => {
  return (
    <div className={`${fullWidth ? 'w-full' : ''}`}>
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-[hsl(var(--text-secondary))] mb-2 uppercase tracking-wide">
          {label}
        </label>
      )}

      {/* Input Container */}
      <div className="relative">
        {/* Icon à esquerda */}
        {Icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <Icon className="w-4 h-4 text-[hsl(var(--text-tertiary))]" strokeWidth={2} />
          </div>
        )}

        {/* Input */}
        <input
          ref={ref}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          className={`
            w-full
            bg-[hsl(var(--bg-dark))]
            border ${error ? 'border-[hsl(var(--error-neon))]' : 'border-[hsl(var(--border-subtle))]'}
            rounded-xl
            ${Icon ? 'pl-10 pr-4' : 'px-4'}
            py-3
            text-[hsl(var(--text-primary))]
            text-sm
            placeholder:text-[hsl(var(--text-muted))]
            transition-all duration-300
            outline-none
            focus:border-[hsl(var(--accent-neon))]
            focus:shadow-[0_0_0_3px_rgba(0,255,255,0.1),0_0_15px_rgba(0,255,255,0.2)]
            hover:border-[hsl(var(--border-medium))]
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'shadow-[0_0_0_3px_rgba(255,0,100,0.1)]' : ''}
            ${className}
          `}
          {...props}
        />

        {/* Error Icon */}
        {error && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <AlertCircle className="w-4 h-4 text-[hsl(var(--error-neon))]" strokeWidth={2} />
          </div>
        )}
      </div>

      {/* Helper Text ou Error Message */}
      {(helperText || error) && (
        <p className={`
          mt-2 text-xs
          ${error ? 'text-[hsl(var(--error-neon))]' : 'text-[hsl(var(--text-tertiary))]'}
        `}>
          {error || helperText}
        </p>
      )}
    </div>
  );
});

InputFuturistic.displayName = 'InputFuturistic';

export default InputFuturistic;


/**
 * Textarea Futurista
 * Componente de textarea com design cyberpunk/futurista
 */
export const TextareaFuturistic = forwardRef(({
  label,
  placeholder,
  value,
  onChange,
  error,
  disabled = false,
  className = '',
  fullWidth = false,
  helperText,
  rows = 4,
  ...props
}, ref) => {
  return (
    <div className={`${fullWidth ? 'w-full' : ''}`}>
      {/* Label */}
      {label && (
        <label className="block text-sm font-medium text-[hsl(var(--text-secondary))] mb-2 uppercase tracking-wide">
          {label}
        </label>
      )}

      {/* Textarea Container */}
      <div className="relative">
        <textarea
          ref={ref}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows}
          className={`
            w-full
            bg-[hsl(var(--bg-dark))]
            border ${error ? 'border-[hsl(var(--error-neon))]' : 'border-[hsl(var(--border-subtle))]'}
            rounded-xl
            px-4 py-3
            text-[hsl(var(--text-primary))]
            text-sm
            placeholder:text-[hsl(var(--text-muted))]
            transition-all duration-300
            outline-none
            resize-y
            focus:border-[hsl(var(--accent-neon))]
            focus:shadow-[0_0_0_3px_rgba(0,255,255,0.1),0_0_15px_rgba(0,255,255,0.2)]
            hover:border-[hsl(var(--border-medium))]
            disabled:opacity-50 disabled:cursor-not-allowed
            ${error ? 'shadow-[0_0_0_3px_rgba(255,0,100,0.1)]' : ''}
            ${className}
          `}
          {...props}
        />

        {/* Error Icon */}
        {error && (
          <div className="absolute right-3 top-3 pointer-events-none">
            <AlertCircle className="w-4 h-4 text-[hsl(var(--error-neon))]" strokeWidth={2} />
          </div>
        )}
      </div>

      {/* Helper Text ou Error Message */}
      {(helperText || error) && (
        <p className={`
          mt-2 text-xs
          ${error ? 'text-[hsl(var(--error-neon))]' : 'text-[hsl(var(--text-tertiary))]'}
        `}>
          {error || helperText}
        </p>
      )}
    </div>
  );
});

TextareaFuturistic.displayName = 'TextareaFuturistic';


/**
 * Search Input Futurista
 * Input especializado para busca com ícone de lupa
 */
export const SearchInputFuturistic = forwardRef(({
  placeholder = 'Buscar...',
  value,
  onChange,
  onSearch,
  className = '',
  fullWidth = true,
  ...props
}, ref) => {
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && onSearch) {
      onSearch(value);
    }
  };

  return (
    <div className={`relative ${fullWidth ? 'w-full' : ''}`}>
      <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
        <Search className="w-4 h-4 text-[hsl(var(--text-tertiary))]" strokeWidth={2} />
      </div>

      <input
        ref={ref}
        type="text"
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`
          w-full
          bg-[hsl(var(--bg-dark))]
          border border-[hsl(var(--border-subtle))]
          rounded-xl
          pl-10 pr-4 py-3
          text-[hsl(var(--text-primary))]
          text-sm
          placeholder:text-[hsl(var(--text-muted))]
          transition-all duration-300
          outline-none
          focus:border-[hsl(var(--accent-neon))]
          focus:shadow-[0_0_0_3px_rgba(0,255,255,0.1),0_0_15px_rgba(0,255,255,0.2)]
          hover:border-[hsl(var(--border-medium))]
          ${className}
        `}
        {...props}
      />
    </div>
  );
});

SearchInputFuturistic.displayName = 'SearchInputFuturistic';
