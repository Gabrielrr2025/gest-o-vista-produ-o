import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Shield, UserPlus, Edit, Power, Key } from "lucide-react";
import { toast } from "sonner";
import UserFormDialog from "../components/admin/UserFormDialog";

export default function Admin() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const queryClient = useQueryClient();

  // Verificar permissão
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await base44.auth.me();
        if (user.role !== 'admin') {
          window.location.href = '/';
          return;
        }
        setCurrentUser(user);
      } catch (error) {
        window.location.href = '/';
      }
    };
    checkAuth();
  }, []);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!currentUser
  });

  const handleToggleStatus = async (user) => {
    if (user.role === 'admin' && users.filter(u => u.role === 'admin' && u.active !== false).length === 1) {
      toast.error("Não é possível desativar o último administrador");
      return;
    }

    try {
      await base44.entities.User.update(user.id, {
        active: user.active === false ? true : false
      });
      queryClient.invalidateQueries(['users']);
      toast.success(user.active === false ? "Usuário ativado" : "Usuário desativado");
    } catch (error) {
      toast.error("Erro ao alterar status do usuário");
    }
  };

  const handleInviteUser = (userData) => {
    setShowDialog(false);
    setSelectedUser(null);
    // O convite é feito no dialog
    queryClient.invalidateQueries(['users']);
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-500">Verificando permissões...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* CABEÇALHO */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Shield className="w-6 h-6 text-amber-600" />
            Administrativo
          </h1>
          <p className="text-sm text-slate-500 mt-1">Gerenciamento de usuários e permissões</p>
        </div>
        <Button 
          onClick={() => {
            setSelectedUser(null);
            setShowDialog(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all duration-200"
          style={{ padding: '10px 20px', fontSize: '14px', fontWeight: 500, borderRadius: '6px' }}
        >
          <UserPlus className="w-4 h-4 mr-2" />
          Adicionar Usuário
        </Button>
      </div>

      {/* TABELA DE USUÁRIOS */}
      <Card>
        <CardHeader>
          <CardTitle>Usuários do Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-slate-500">Carregando usuários...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Permissões</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map(user => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.full_name}</TableCell>
                    <TableCell className="text-slate-600">{user.email}</TableCell>
                    <TableCell className="text-slate-600">{user.position || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                        {user.role === 'admin' ? 'MASTER' : 'Usuário'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {user.role === 'admin' ? (
                        <Badge className="bg-green-100 text-green-700">Todas as abas</Badge>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setShowDialog(true);
                          }}
                          className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {(() => {
                            const perms = user.permissions || {};
                            const total = 7;
                            const enabled = Object.values(perms).filter(Boolean).length;
                            return `${enabled} de ${total} abas`;
                          })()}
                        </button>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.active === false ? 'destructive' : 'default'}>
                        {user.active === false ? 'Inativo' : 'Ativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedUser(user);
                            setShowDialog(true);
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleStatus(user)}
                          disabled={user.id === currentUser.id}
                        >
                          <Power className={`w-4 h-4 ${user.active === false ? 'text-green-600' : 'text-red-600'}`} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                      Nenhum usuário encontrado
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* DIALOG */}
      {showDialog && (
        <UserFormDialog
          user={selectedUser}
          onClose={() => {
            setShowDialog(false);
            setSelectedUser(null);
          }}
          onSave={handleInviteUser}
        />
      )}
    </div>
  );
}