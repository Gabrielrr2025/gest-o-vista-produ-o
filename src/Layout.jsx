import React, { useState, useEffect } from 'react';
import { Link } from "react-router-dom";
import { createPageUrl } from "./utils";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { 
  Package, 
  CalendarDays, 
  ClipboardList, 
  FileSpreadsheet,
  Menu,
  X,
  ChefHat,
  Settings,
  Shield,
  Zap,
  Activity,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const navigation = [
  { name: "Produtos", page: "Products", icon: Package },
  { name: "Planejamento", page: "Planning", icon: ClipboardList },
  { name: "Calendário", page: "Calendar", icon: CalendarDays },
  { name: "Relatórios", page: "Reports", icon: FileSpreadsheet },
  { name: "Configurações", page: "Settings", icon: Settings },
];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarMinimized, setSidebarMinimized] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        console.log("🔐 Usuário carregado:", user);
        console.log("📋 Permissões salvas no banco:", user.permissions);
        
        if (!user.permissions) {
          console.log("⚠️ Usuário sem permissões definidas, criando padrão...");
          
          const defaultPermissions = user?.role === 'admin' ? {
            products: true,
            planning: true,
            calendar: true,
            reports: true,
            settings: true,
            admin: true
          } : {
            products: true,
            planning: true,
            calendar: true,
            reports: user.reports_access || false,
            settings: false,
            admin: false
          };
          
          user.permissions = defaultPermissions;
        }
        
        console.log("✅ Permissões finais do usuário:", user.permissions);
        setCurrentUser(user);
      } catch (error) {
        console.error("Erro ao carregar usuário:", error);
      }
    };
    loadUser();

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
    <div className="min-h-screen gradient-bg cyber-grid">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 glass-strong z-50 flex items-center justify-between px-4 border-b border-[hsl(var(--border-subtle))]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[hsl(var(--accent-neon))] to-[hsl(var(--accent-purple))] flex items-center justify-center glow-cyan">
            <Zap className="w-5 h-5 text-[hsl(var(--bg-void))]" strokeWidth={2.5} />
          </div>
          <div>
            <span className="font-bold text-[hsl(var(--text-primary))] text-gradient">Gestão à Vista</span>
            <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--text-tertiary))]">
              <Activity className="w-3 h-3" />
              <span>Sistema Ativo</span>
            </div>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="btn-ghost-futuristic"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar Futuristic */}
      <aside 
        className={`
          group/sidebar
          fixed top-0 left-0 h-full glass-strong border-r border-[hsl(var(--border-medium))] z-50
          transform transition-all duration-300 ease-in-out
          lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          ${sidebarMinimized ? 'w-20' : 'w-72'}
        `}
        style={{
          boxShadow: '0 0 40px rgba(0, 255, 255, 0.1)'
        }}
      >
        <div className="flex flex-col h-full relative">
          {/* Decorative line at top */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[hsl(var(--accent-neon))] to-transparent opacity-50"></div>
          
          {/* Logo Section */}
          <div className="h-20 flex items-center gap-3 px-5 border-b border-[hsl(var(--border-subtle))] relative">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[hsl(var(--accent-neon))] to-[hsl(var(--accent-purple))] flex items-center justify-center glow-cyan flex-shrink-0 relative">
              <Zap className="w-6 h-6 text-[hsl(var(--bg-void))]" strokeWidth={2.5} />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-[hsl(var(--success-neon))] rounded-full border-2 border-[hsl(var(--bg-surface))] pulse-glow"></div>
            </div>
            {!sidebarMinimized && (
              <div className="transition-opacity duration-300 flex-1">
                <h1 className="font-bold text-[hsl(var(--text-primary))] leading-tight text-lg">
                  Gestão à Vista
                </h1>
                <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--text-tertiary))]">
                  <Activity className="w-3 h-3" />
                  <span>Sistema Ativo</span>
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <TooltipProvider delayDuration={300}>
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto scrollbar-thin">
              {navigation.map((item) => {
                if (currentUser && currentUser.role !== 'admin') {
                  const permissions = currentUser.permissions || {};
                  const pagePermissionMap = {
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
                      group flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium
                      transition-all duration-200 relative overflow-hidden
                      ${sidebarMinimized ? 'justify-center' : ''}
                      ${isActive 
                        ? 'bg-gradient-to-r from-[hsl(var(--accent-neon))] to-[hsl(var(--accent-purple))] text-[hsl(var(--bg-void))] shadow-lg glow-cyan' 
                        : 'text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--bg-elevated))]'
                      }
                    `}
                  >
                    {/* Hover effect background */}
                    {!isActive && (
                      <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--accent-neon))]/10 to-[hsl(var(--accent-purple))]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                    )}
                    
                    <item.icon className={`w-5 h-5 flex-shrink-0 relative z-10 ${isActive ? 'animate-pulse' : ''}`} strokeWidth={2} />
                    {!sidebarMinimized && (
                      <span className="transition-opacity duration-200 relative z-10 whitespace-nowrap">{item.name}</span>
                    )}
                    
                    {/* Active indicator */}
                    {isActive && !sidebarMinimized && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white"></div>
                    )}
                  </Link>
                );

                // Só mostra tooltip quando minimizado
                return sidebarMinimized ? (
                  <Tooltip key={item.page}>
                    <TooltipTrigger asChild>
                      {linkContent}
                    </TooltipTrigger>
                    <TooltipContent 
                      side="right" 
                      sideOffset={10}
                      className="glass-strong text-[hsl(var(--text-primary))] border-[hsl(var(--border-medium))] z-[60]"
                    >
                      {item.name}
                    </TooltipContent>
                  </Tooltip>
                ) : linkContent;
              })}

              {/* Admin Section */}
              {(currentUser?.role === 'admin' || currentUser?.permissions?.admin) && (
                <>
                  <div className="my-4 border-t border-[hsl(var(--border-subtle))]"></div>
                  {(() => {
                    const isActive = currentPageName === "Admin";
                    const linkContent = (
                      <Link
                        to={createPageUrl("Admin")}
                        onClick={() => setSidebarOpen(false)}
                        className={`
                          group flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium
                          transition-all duration-300 relative overflow-hidden
                          ${sidebarMinimized ? 'justify-center' : ''}
                          ${isActive
                            ? 'bg-gradient-to-r from-[hsl(var(--accent-neon))] to-[hsl(var(--accent-purple))] text-[hsl(var(--bg-void))] shadow-lg glow-purple' 
                            : 'text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--bg-elevated))]'
                          }
                        `}
                      >
                        {!isActive && (
                          <div className="absolute inset-0 bg-gradient-to-r from-[hsl(var(--accent-purple))]/10 to-[hsl(var(--accent-neon))]/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        )}
                        
                        <Shield className={`w-5 h-5 flex-shrink-0 relative z-10 ${isActive ? 'animate-pulse' : ''}`} strokeWidth={2} />
                        {!sidebarMinimized && (
                          <span className="transition-opacity duration-300 relative z-10">Administrativo</span>
                        )}
                        
                        {isActive && !sidebarMinimized && (
                          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white"></div>
                        )}
                      </Link>
                    );

                    return sidebarMinimized ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          {linkContent}
                        </TooltipTrigger>
                        <TooltipContent 
                          side="right" 
                          className="glass-strong text-[hsl(var(--text-primary))] border-[hsl(var(--border-medium))]"
                        >
                          Administrativo
                        </TooltipContent>
                      </Tooltip>
                    ) : linkContent;
                  })()}
                </>
              )}
            </nav>
          </TooltipProvider>

          {/* Toggle Button - Desktop Only */}
          <button
            onClick={toggleSidebar}
            className={`
              hidden lg:flex
              absolute -right-3 top-24
              w-6 h-6
              items-center justify-center
              glass-strong hover:glass
              border border-[hsl(var(--border-medium))]
              rounded-full
              transition-all duration-300
              opacity-0 group-hover/sidebar:opacity-100
              hover:scale-110
              glow-cyan
            `}
            title={sidebarMinimized ? "Expandir menu" : "Minimizar menu"}
          >
            {sidebarMinimized ? (
              <ChevronRight className="w-3 h-3 text-[hsl(var(--accent-neon))]" strokeWidth={2.5} />
            ) : (
              <ChevronLeft className="w-3 h-3 text-[hsl(var(--accent-neon))]" strokeWidth={2.5} />
            )}
          </button>

          {/* Bottom Decoration */}
          <div className="h-16 border-t border-[hsl(var(--border-subtle))] flex items-center justify-center">
            {!sidebarMinimized ? (
              <div className="text-xs text-[hsl(var(--text-tertiary))] flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[hsl(var(--success-neon))] animate-pulse"></div>
                <span>Sistema Online</span>
              </div>
            ) : (
              <div className="w-2 h-2 rounded-full bg-[hsl(var(--success-neon))] animate-pulse"></div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`pt-16 lg:pt-0 transition-all duration-300 ${sidebarMinimized ? 'lg:ml-20' : 'lg:ml-72'}`}>
        <div className="p-4 lg:p-8 max-w-[1600px] mx-auto fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
