import React, { useState, useEffect } from 'react';
import { Link } from "react-router-dom";
import { createPageUrl } from "./utils";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { 
  LayoutDashboard, 
  Upload, 
  Package, 
  CalendarDays, 
  ClipboardList, 
  FileSpreadsheet,
  Menu,
  X,
  ChefHat,
  History,
  Settings,
  Shield
} from "lucide-react";

const navigation = [
  { name: "Dashboard", page: "Dashboard", icon: LayoutDashboard },
  { name: "Produtos", page: "Products", icon: Package },
  { name: "Planejamento", page: "Planning", icon: ClipboardList },
  { name: "Calendário", page: "Calendar", icon: CalendarDays },
  { name: "Relatórios", page: "Reports", icon: FileSpreadsheet },
  { name: "Histórico", page: "History", icon: History },
  { name: "Importar", page: "Import", icon: Upload },
  { name: "Configurações", page: "Settings", icon: Settings },
];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {
        console.error("Erro ao carregar usuário:", error);
      }
    };
    loadUser();
  }, []);


  return (
    <div className="min-h-screen bg-[hsl(var(--bg-primary))] transition-colors duration-200">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[hsl(var(--bg-tertiary))] border-b border-[hsl(var(--border-light))] z-50 flex items-center justify-between px-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#4E342E] flex items-center justify-center">
            <ChefHat className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-[hsl(var(--text-primary))]">Gestão à Vista</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-[hsl(var(--bg-tertiary))] border-r border-[hsl(var(--border-light))] z-50 shadow-lg
        transform transition-transform duration-300 ease-in-out
        lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-16 flex items-center gap-3 px-5 border-b border-[hsl(var(--border-light))]">
            <div className="w-10 h-10 rounded-xl bg-[#4E342E] flex items-center justify-center shadow-md">
              <ChefHat className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-[hsl(var(--text-primary))] leading-tight">Gestão à Vista</h1>
              <p className="text-xs text-[hsl(var(--text-tertiary))]">Produção</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {navigation.map((item) => {
              const isActive = currentPageName === item.page;
              return (
                <Link
                  key={item.page}
                  to={createPageUrl(item.page)}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
                    transition-all duration-200
                    ${isActive 
                      ? 'bg-[#F59E0B] text-white shadow-md' 
                      : 'text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--bg-secondary))] hover:text-[hsl(var(--text-primary))]'
                    }
                  `}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}

            {/* Admin - Apenas para MASTER */}
            {currentUser?.role === 'admin' && (
              <>
                <div className="my-2 border-t border-[hsl(var(--border-light))]"></div>
                <Link
                  to={createPageUrl("Admin")}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
                    transition-all duration-200
                    ${currentPageName === "Admin"
                      ? 'bg-[#F59E0B] text-white shadow-md' 
                      : 'text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--bg-secondary))] hover:text-[hsl(var(--text-primary))]'
                    }
                  `}
                >
                  <Shield className="w-5 h-5" />
                  Administrativo
                </Link>
              </>
            )}
          </nav>


        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 pt-16 lg:pt-0">
        <div className="p-4 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}