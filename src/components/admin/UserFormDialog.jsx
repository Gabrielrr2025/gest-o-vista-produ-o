import React, { useState, useEffect } from 'react';
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function UserFormDialog({ user, onClose, onSave }) {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    position: '',
    permissions: {
      dashboard: true,
      products: true,
      planning: true,
      calendar: true,
      reports: false,
      settings: true,
      admin: false
    },
    active: true
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      // Se o usuário não tem permissions ainda, criar baseado em reports_access
      const permissions = user.permissions || {
        dashboard: true,
        products: true,
        planning: true,
        calendar: true,
        reports: user.reports_access || false,
        settings: true,
        admin: user.role === 'admin'
      };
      
      setFormData({
        full_name: user.full_name || '',
        email: user.email || '',
        position: user.position || '',
        permissions: permissions,
        active: user.active !== false
      });
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validações
    if (!formData.full_name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    if (!formData.email.trim()) {
      toast.error("Email é obrigatório");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast.error("Email inválido");
      return;
    }

    setIsSubmitting(true);

    try {
       if (user) {
         // Editar usuário existente
         console.log("💾 Salvando permissões do usuário:", {
           userId: user.id,
           permissions: formData.permissions
         });
         await base44.entities.User.update(user.id, {
           full_name: formData.full_name,
           position: formData.position,
           permissions: formData.permissions,
           active: formData.active
         });
         console.log("✅ Permissões salvas com sucesso no banco");
         toast.success("Usuário atualizado com sucesso");
       } else {
         // Convidar novo usuário
         console.log("📧 Enviando convite para:", formData.email);
         await base44.users.inviteUser(formData.email, "user");

         // Atualizar dados do usuário após convite
         // Precisamos buscar o usuário recém-criado para atualizar
         setTimeout(async () => {
           try {
             const users = await base44.entities.User.list();
             const newUser = users.find(u => u.email === formData.email);
             if (newUser) {
               console.log("💾 Salvando dados do novo usuário:", {
                 userId: newUser.id,
                 permissions: formData.permissions
               });
               await base44.entities.User.update(newUser.id, {
                 full_name: formData.full_name,
                 position: formData.position,
                 permissions: formData.permissions
               });
               console.log("✅ Dados do novo usuário salvos com sucesso");
             }
           } catch (err) {
             console.error("❌ Erro ao atualizar dados do usuário:", err);
           }
         }, 1000);

         toast.success("Convite enviado com sucesso");
       }
      
      onSave(formData);
    } catch (error) {
      console.error(error);
      if (error.message?.includes('already exists')) {
        toast.error("Este email já está cadastrado");
      } else {
        toast.error(user ? "Erro ao atualizar usuário" : "Erro ao enviar convite");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="modal-container sm:max-w-[600px] w-[95%] p-0">
        <DialogHeader className="modal-header">
          <DialogTitle>{user ? 'Editar Usuário' : 'Adicionar Novo Usuário'}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="modal-body space-y-3">
          <div>
            <Label htmlFor="full_name">Nome Completo *</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => setFormData({...formData, full_name: e.target.value})}
              placeholder="Ex: João Silva"
              required
            />
          </div>

          <div>
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              placeholder="usuario@email.com"
              disabled={!!user}
              required
            />
            {!user && (
              <p className="text-xs text-slate-500 mt-1">
                Um convite será enviado para este email
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="position">Cargo</Label>
            <Input
              id="position"
              value={formData.position}
              onChange={(e) => setFormData({...formData, position: e.target.value})}
              placeholder="Ex: Gerente, Supervisor, Operador"
            />
          </div>

          <div className="border-t pt-3 space-y-2">
            <Label className="text-sm font-semibold">Permissões por Aba</Label>
            <p className="text-xs text-gray-500">Selecione quais abas o usuário pode acessar</p>
            
            <div className="space-y-1 mt-2">
              {[
                { key: 'dashboard', label: 'Dashboard', desc: 'Visão geral e indicadores' },
                { key: 'products', label: 'Produtos', desc: 'Gerenciamento de produtos' },
                { key: 'planning', label: 'Planejamento', desc: 'Planejamento de produção' },
                { key: 'calendar', label: 'Calendário', desc: 'Eventos e feriados' },
                { key: 'reports', label: 'Relatórios', desc: 'Dados financeiros e vendas' },
                { key: 'settings', label: 'Configurações', desc: 'Configurações do sistema' },
                { key: 'admin', label: 'Administrativo', desc: 'Gerenciamento de usuários (apenas MASTER)' }
              ].map(perm => {
                const isAdmin = user?.role === 'admin';
                const isAdminPerm = perm.key === 'admin';
                const disabled = isAdmin || (isAdminPerm && user?.role !== 'admin');
                
                return (
                  <label key={perm.key} className={`flex items-start gap-2 p-1.5 rounded-lg hover:bg-gray-50 ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
                    <input
                      type="checkbox"
                      checked={isAdmin ? true : (formData.permissions[perm.key] || false)}
                      onChange={(e) => {
                        if (!disabled) {
                          setFormData({
                            ...formData, 
                            permissions: {
                              ...formData.permissions,
                              [perm.key]: e.target.checked
                            }
                          });
                        }
                      }}
                      disabled={disabled}
                      className="w-4 h-4 rounded border-gray-300 mt-0.5"
                    />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">{perm.label}</div>
                      <div className="text-xs text-gray-500">{perm.desc}</div>
                    </div>
                  </label>
                );
              })}
            </div>
            
            {user?.role === 'admin' && (
              <p className="text-xs text-amber-600 mt-1">
                ⚠️ Usuários MASTER têm acesso a todas as abas
              </p>
            )}
          </div>

          {user && (
            <div className="border-t pt-3 space-y-2">
              <Label className="text-sm font-semibold">Status</Label>
              
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="active"
                    checked={formData.active === true}
                    onChange={() => setFormData({...formData, active: true})}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Ativo</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="active"
                    checked={formData.active === false}
                    onChange={() => setFormData({...formData, active: false})}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">Inativo</span>
                </label>
              </div>
            </div>
          )}
          </div>

          <div className="modal-footer">
            <button 
              type="button" 
              onClick={onClose}
              className="btn-secondary"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              disabled={isSubmitting}
              className="btn-primary"
            >
              {isSubmitting ? 'Salvando...' : (user ? 'Salvar Alterações' : 'Enviar Convite')}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}