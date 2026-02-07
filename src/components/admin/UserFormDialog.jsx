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
    reports_access: false,
    active: true
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name || '',
        email: user.email || '',
        position: user.position || '',
        reports_access: user.reports_access || false,
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
        await base44.entities.User.update(user.id, {
          full_name: formData.full_name,
          position: formData.position,
          reports_access: formData.reports_access,
          active: formData.active
        });
        toast.success("Usuário atualizado com sucesso");
      } else {
        // Convidar novo usuário
        await base44.users.inviteUser(formData.email, "user");
        
        // Atualizar dados do usuário após convite
        // Precisamos buscar o usuário recém-criado para atualizar
        setTimeout(async () => {
          try {
            const users = await base44.entities.User.list();
            const newUser = users.find(u => u.email === formData.email);
            if (newUser) {
              await base44.entities.User.update(newUser.id, {
                full_name: formData.full_name,
                position: formData.position,
                reports_access: formData.reports_access
              });
            }
          } catch (err) {
            console.error("Erro ao atualizar dados do usuário:", err);
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{user ? 'Editar Usuário' : 'Adicionar Novo Usuário'}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
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

          <div className="border-t pt-4 space-y-3">
            <Label className="text-sm font-semibold">Permissões</Label>
            
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.reports_access}
                onChange={(e) => setFormData({...formData, reports_access: e.target.checked})}
                className="w-4 h-4 rounded border-slate-300"
              />
              <span className="text-sm">Acesso a Relatórios (valores financeiros)</span>
            </label>
          </div>

          {user && (
            <div className="border-t pt-4 space-y-3">
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

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSubmitting ? 'Salvando...' : (user ? 'Salvar Alterações' : 'Enviar Convite')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}