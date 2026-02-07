import React, { useState, useEffect } from 'react';
import { Link } from "react-router-dom";
import { createPageUrl } from "./utils";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { 
  LayoutDashboard, 
  Package, 
  CalendarDays, 
  ClipboardList, 
  FileSpreadsheet,
  Menu,
  X,
  ChefHat,
  Settings,
  Shield,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const navigation = [
  { name: "Dashboard", page: "Dashboard", icon: LayoutDashboard },
  { name: "Produtos", page: "Products", icon: Package },
  { name: "Planejamento", page: "Planning", icon: ClipboardList },
  { name: "Calendário", page: "Calendar", icon: CalendarDays },
  { name: "Relatórios", page: "Reports", icon: FileSpreadsheet },
  { name: "Configurações", page: "Settings", icon: Settings },
];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarMinimized, setSidebarMinimized] = useState(false);
  const [showToggleButton, setShowToggleButton] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        console.log("🔐 Usuário carregado:", user);
        
        // Criar permissões padrão baseado no role
        const permissions = user?.role === 'admin' ? {
          dashboard: true,
          products: true,
          planning: true,
          calendar: true,
          reports: true,
          settings: true,
          admin: true
        } : {
          dashboard: true,
          products: true,
          planning: true,
          calendar: true,
          reports: false,
          settings: false,
          admin: false
        };
        
        // Adicionar permissões ao usuário
        user.permissions = permissions;
        console.log("📋 Permissões do usuário:", user.permissions);
        setCurrentUser(user);
      } catch (error) {
        console.error("Erro ao carregar usuário:", error);
      }
    };
    loadUser();

    // Carregar preferência do menu do localStorage
    const savedMinimized = localStorage.getItem('sidebarMinimized');
    if (savedMinimized !== null) {
      setSidebarMinimized(savedMinimized === 'true');
    }
  }, []);

  const toggleSidebar = () => {
    const newState = !sidebarMinimized;
    setSidebarMinimized(newState);
    localStorage.setItem('sidebarMinimized', newState.toString());
  };


  return (
    <div className="min-h-screen bg-[#F9FAFB] transition-colors duration-200">
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
      <aside 
        className={`
          fixed top-0 left-0 h-full bg-[hsl(var(--bg-tertiary))] border-r border-[hsl(var(--border-light))] z-50 shadow-lg
          transform transition-all duration-300 ease-in-out
          lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          ${sidebarMinimized ? 'w-20' : 'w-64'}
        `}
        onMouseEnter={() => setShowToggleButton(true)}
        onMouseLeave={() => setShowToggleButton(false)}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="h-16 flex items-center gap-3 px-5 border-b border-[hsl(var(--border-light))]">
            <div className="w-10 h-10 rounded-xl bg-[#4E342E] flex items-center justify-center shadow-md flex-shrink-0">
              <ChefHat className="w-6 h-6 text-white" />
            </div>
            {!sidebarMinimized && (
              <div className="transition-opacity duration-300">
                <h1 className="font-bold text-[hsl(var(--text-primary))] leading-tight">Gestão à Vista</h1>
                <p className="text-xs text-[hsl(var(--text-tertiary))]">Produção</p>
              </div>
            )}
          </div>

          {/* Navigation */}
          <TooltipProvider delayDuration={300}>
            <nav className="flex-1 p-4 space-y-1">
              {navigation.map((item) => {
                // Verificar permissões do usuário
                if (currentUser && currentUser.role !== 'admin') {
                  const permissions = currentUser.permissions || {};
                  const pagePermissionMap = {
                    'Dashboard': 'dashboard',
                    'Products': 'products',
                    'Planning': 'planning',
                    'Calendar': 'calendar',
                    'Reports': 'reports',
                    'Settings': 'settings'
                  };
                  
                  const permKey = pagePermissionMap[item.page];
                  console.log(`🔍 Verificando ${item.page}: permissão '${permKey}' = ${permissions[permKey]}`);
                  if (permKey && !permissions[permKey]) {
                    console.log(`❌ ${item.page} bloqueado - usuário não tem permissão`);
                    return null;
                  }
                }

                const isActive = currentPageName === item.page;
                const linkContent = (
                  <Link
                    key={item.page}
                    to={createPageUrl(item.page)}
                    onClick={() => setSidebarOpen(false)}
                    className={`
                      flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
                      transition-all duration-200
                      ${sidebarMinimized ? 'justify-center' : ''}
                      ${isActive 
                        ? 'bg-[#F59E0B] text-white shadow-md' 
                        : 'text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--bg-secondary))] hover:text-[hsl(var(--text-primary))]'
                      }
                    `}
                  >
                    <item.icon className="w-5 h-5 flex-shrink-0" />
                    {!sidebarMinimized && <span className="transition-opacity duration-300">{item.name}</span>}
                  </Link>
                );

                return sidebarMinimized ? (
                  <Tooltip key={item.page}>
                    <TooltipTrigger asChild>
                      {linkContent}
                    </TooltipTrigger>
                    <TooltipContent side="right" className="bg-slate-900 text-white">
                      {item.name}
                    </TooltipContent>
                  </Tooltip>
                ) : linkContent;
              })}

              {/* Admin - Apenas para MASTER ou usuários com permissão */}
              {(currentUser?.role === 'admin' || currentUser?.permissions?.admin) && (
                <>
                  <div className="my-2 border-t border-[hsl(var(--border-light))]"></div>
                  {(() => {
                    const isActive = currentPageName === "Admin";
                    const linkContent = (
                      <Link
                        to={createPageUrl("Admin")}
                        onClick={() => setSidebarOpen(false)}
                        className={`
                          flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
                          transition-all duration-200
                          ${sidebarMinimized ? 'justify-center' : ''}
                          ${isActive
                            ? 'bg-[#F59E0B] text-white shadow-md' 
                            : 'text-[hsl(var(--text-secondary))] hover:bg-[hsl(var(--bg-secondary))] hover:text-[hsl(var(--text-primary))]'
                          }
                        `}
                      >
                        <Shield className="w-5 h-5 flex-shrink-0" />
                        {!sidebarMinimized && <span className="transition-opacity duration-300">Administrativo</span>}
                      </Link>
                    );

                    return sidebarMinimized ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {linkContent}
                        </TooltipTrigger>
                        <TooltipContent side="right" className="bg-slate-900 text-white">
                          Administrativo
                        </TooltipContent>
                      </Tooltip>
                    ) : linkContent;
                  })()}
                </>
              )}
            </nav>
          </TooltipProvider>

          {/* Toggle Button - Borda Direita (Desktop Only) */}
          <button
            onClick={toggleSidebar}
            className={`
              hidden lg:block
              absolute top-1/2 -translate-y-1/2 -right-3
              w-6 h-10
              bg-slate-200/80 hover:bg-slate-300/90
              border border-[hsl(var(--border-light))]
              rounded-r-lg
              shadow-md
              flex items-center justify-center
              transition-all duration-200
              ${showToggleButton ? 'opacity-100' : 'opacity-0 pointer-events-none'}
            `}
            title={sidebarMinimized ? "Expandir menu" : "Minimizar menu"}
          >
            {sidebarMinimized ? (
              <ChevronRight className="w-4 h-4 text-slate-700" />
            ) : (
              <ChevronLeft className="w-4 h-4 text-slate-700" />
            )}
          </button>


        </div>
      </aside>

      {/* Main Content */}
      <main className={`pt-16 lg:pt-0 transition-all duration-300 ${sidebarMinimized ? 'lg:ml-20' : 'lg:ml-64'}`}>
        <div className="p-4 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}