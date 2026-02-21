import React, { useState } from 'react';
import { X, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import ButtonFuturistic from './ButtonFuturistic';

/**
 * Modal Base Futurista
 * Componente base para modais com design cyberpunk
 */
export function ModalFuturistic({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  showCloseButton = true,
}) {
  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 fade-in">
      {/* Backdrop com blur */}
      <div 
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div 
        className={`
          relative w-full ${sizeClasses[size]}
          modal-futuristic
          slide-in-up
        `}
      >
        {/* Header */}
        <div className="modal-header-futuristic">
          <h2 className="text-xl font-semibold text-[hsl(var(--text-primary))] pr-8">
            {title}
          </h2>
          
          {showCloseButton && (
            <button
              onClick={onClose}
              className="
                absolute top-4 right-4
                w-8 h-8 rounded-lg
                flex items-center justify-center
                text-[hsl(var(--text-tertiary))]
                hover:text-[hsl(var(--text-primary))]
                hover:bg-[hsl(var(--bg-dark))]
                transition-all duration-200
              "
            >
              <X className="w-5 h-5" strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="modal-body-futuristic">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="modal-footer-futuristic">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}


/**
 * Confirmation Dialog Futurista
 * Dialog de confirmação com design cyberpunk
 */
export function ConfirmDialogFuturistic({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirmar Ação',
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'warning', // 'warning', 'danger', 'info', 'success'
  loading = false,
}) {
  const icons = {
    warning: AlertTriangle,
    danger: AlertTriangle,
    info: Info,
    success: CheckCircle,
  };

  const iconColors = {
    warning: 'text-[hsl(var(--warning-neon))]',
    danger: 'text-[hsl(var(--error-neon))]',
    info: 'text-[hsl(var(--accent-neon))]',
    success: 'text-[hsl(var(--success-neon))]',
  };

  const Icon = icons[variant];

  return (
    <ModalFuturistic
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      showCloseButton={!loading}
      footer={
        <>
          <ButtonFuturistic
            variant="ghost"
            onClick={onClose}
            disabled={loading}
          >
            {cancelText}
          </ButtonFuturistic>
          
          <ButtonFuturistic
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            loading={loading}
          >
            {confirmText}
          </ButtonFuturistic>
        </>
      }
    >
      <div className="flex items-start gap-4">
        <div className={`
          p-3 rounded-xl
          ${variant === 'warning' ? 'bg-[hsl(var(--warning-neon))]/10' : ''}
          ${variant === 'danger' ? 'bg-[hsl(var(--error-neon))]/10' : ''}
          ${variant === 'info' ? 'bg-[hsl(var(--accent-neon))]/10' : ''}
          ${variant === 'success' ? 'bg-[hsl(var(--success-neon))]/10' : ''}
        `}>
          <Icon className={`w-6 h-6 ${iconColors[variant]}`} strokeWidth={2} />
        </div>
        
        <div className="flex-1">
          <p className="text-[hsl(var(--text-primary))] leading-relaxed">
            {message}
          </p>
        </div>
      </div>
    </ModalFuturistic>
  );
}


/**
 * Alert Dialog Futurista
 * Dialog de alerta/notificação
 */
export function AlertDialogFuturistic({
  isOpen,
  onClose,
  title,
  message,
  variant = 'info',
  confirmText = 'Entendi',
}) {
  const icons = {
    warning: AlertTriangle,
    danger: AlertTriangle,
    info: Info,
    success: CheckCircle,
  };

  const iconColors = {
    warning: 'text-[hsl(var(--warning-neon))]',
    danger: 'text-[hsl(var(--error-neon))]',
    info: 'text-[hsl(var(--accent-neon))]',
    success: 'text-[hsl(var(--success-neon))]',
  };

  const Icon = icons[variant];

  return (
    <ModalFuturistic
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <ButtonFuturistic
          variant="primary"
          onClick={onClose}
        >
          {confirmText}
        </ButtonFuturistic>
      }
    >
      <div className="flex items-start gap-4">
        <div className={`
          p-3 rounded-xl
          ${variant === 'warning' ? 'bg-[hsl(var(--warning-neon))]/10' : ''}
          ${variant === 'danger' ? 'bg-[hsl(var(--error-neon))]/10' : ''}
          ${variant === 'info' ? 'bg-[hsl(var(--accent-neon))]/10' : ''}
          ${variant === 'success' ? 'bg-[hsl(var(--success-neon))]/10' : ''}
        `}>
          <Icon className={`w-6 h-6 ${iconColors[variant]}`} strokeWidth={2} />
        </div>
        
        <div className="flex-1">
          <p className="text-[hsl(var(--text-primary))] leading-relaxed">
            {message}
          </p>
        </div>
      </div>
    </ModalFuturistic>
  );
}


/**
 * EXEMPLO DE USO
 */
export function ModalExamples() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const handleConfirm = async () => {
    // Simular ação assíncrona
    await new Promise(resolve => setTimeout(resolve, 2000));
    setConfirmOpen(false);
  };

  return (
    <div className="space-y-4 p-8">
      <h2 className="text-2xl font-bold text-gradient mb-6">
        Exemplos de Modais Futuristas
      </h2>

      {/* Botões de teste */}
      <div className="flex flex-wrap gap-4">
        <ButtonFuturistic
          variant="primary"
          onClick={() => setModalOpen(true)}
        >
          Abrir Modal Customizado
        </ButtonFuturistic>

        <ButtonFuturistic
          variant="secondary"
          onClick={() => setConfirmOpen(true)}
        >
          Abrir Dialog de Confirmação
        </ButtonFuturistic>

        <ButtonFuturistic
          variant="secondary"
          onClick={() => setAlertOpen(true)}
        >
          Abrir Alert Dialog
        </ButtonFuturistic>
      </div>

      {/* Modal Customizado */}
      <ModalFuturistic
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Modal Customizado"
        size="md"
        footer={
          <>
            <ButtonFuturistic
              variant="ghost"
              onClick={() => setModalOpen(false)}
            >
              Cancelar
            </ButtonFuturistic>
            <ButtonFuturistic
              variant="primary"
              onClick={() => setModalOpen(false)}
            >
              Salvar
            </ButtonFuturistic>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-[hsl(var(--text-secondary))]">
            Este é um modal totalmente customizável com design futurista.
            Você pode adicionar qualquer conteúdo aqui.
          </p>
          
          <div className="card-futuristic p-4">
            <h3 className="text-sm font-semibold text-[hsl(var(--text-primary))] mb-2">
              Exemplo de Card Interno
            </h3>
            <p className="text-xs text-[hsl(var(--text-tertiary))]">
              Cards podem ser usados dentro de modais para organizar o conteúdo.
            </p>
          </div>
        </div>
      </ModalFuturistic>

      {/* Confirmation Dialog */}
      <ConfirmDialogFuturistic
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este item? Esta ação não pode ser desfeita."
        variant="danger"
        confirmText="Sim, excluir"
        cancelText="Cancelar"
      />

      {/* Alert Dialog */}
      <AlertDialogFuturistic
        isOpen={alertOpen}
        onClose={() => setAlertOpen(false)}
        title="Operação Concluída"
        message="Seus dados foram salvos com sucesso!"
        variant="success"
        confirmText="OK"
      />
    </div>
  );
}
