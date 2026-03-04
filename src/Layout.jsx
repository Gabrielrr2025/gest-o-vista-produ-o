import React, { useState, useEffect } from 'react';
import { Link } from "react-router-dom";
import { createPageUrl } from "./utils";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { ThemeProvider } from "./components/common/ThemeProvider";
import ThemeToggle from "./components/common/ThemeToggle";
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

// Página inicial ao abrir o app
const DEFAULT_PAGE = "Products";

function AppLayout({ children, currentPageName }) {
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
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)', color: 'var(--text)' }}>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-slate-900 z-50 flex items-center justify-between px-4 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <span className="font-bold text-white text-sm">Gestão à Vista</span>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="text-slate-300 hover:text-white hover:bg-slate-700"
        >
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

      {/* Sidebar Futuristic */}
      <aside 
        className={`
          group/sidebar
          fixed top-0 left-0 h-full z-50
          transform transition-all duration-300 ease-in-out
          lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          ${sidebarMinimized ? 'w-20' : 'w-64'}
        `}
        style={{
          background: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
          borderRight: '1px solid rgba(148,163,184,0.15)',
          boxShadow: '4px 0 20px rgba(0,0,0,0.3)'
        }}
      >
        <div className="flex flex-col h-full relative">
          {/* Decorative line at top */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-60"></div>
          
          {/* Logo Section */}
          <div className="h-16 flex items-center gap-3 px-4 border-b border-slate-700/60 relative">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center flex-shrink-0">
              <Zap className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            {!sidebarMinimized && (
              <div className="transition-opacity duration-300 flex-1 min-w-0">
                <h1 className="font-bold text-white leading-tight text-sm truncate">
                  Gestão à Vista
                </h1>
                <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400"></div>
                  <span>Sistema Online</span>
                </div>
              </div>
            )}
            <ThemeToggle className="text-slate-400 hover:text-white hover:bg-slate-700/60 ml-auto flex-shrink-0" />
          </div>

          {/* Navigation */}
          <TooltipProvider delayDuration={300}>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
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
                  if (permKey && !permissions[permKey]) return null;
                }

                const isActive = currentPageName === item.page;
                const linkContent = (
                  <Link
                    key={item.page}
                    to={createPageUrl(item.page)}
                    onClick={() => setSidebarOpen(false)}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                      transition-all duration-200
                      ${sidebarMinimized ? 'justify-center px-0' : ''}
                      ${isActive 
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' 
                        : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
                      }
                    `}
                  >
                    <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-cyan-400' : ''}`} strokeWidth={1.75} />
                    {!sidebarMinimized && (
                      <span className="whitespace-nowrap">{item.name}</span>
                    )}
                    {isActive && !sidebarMinimized && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-cyan-400"></div>
                    )}
                  </Link>
                );

                return sidebarMinimized ? (
                  <Tooltip key={item.page}>
                    <TooltipTrigger asChild>
                      {linkContent}
                    </TooltipTrigger>
                    <TooltipContent 
                      side="right" 
                      sideOffset={10}
                      className="bg-slate-800 text-white border-slate-600 shadow-lg z-[60]"
                    >
                      {item.name}
                    </TooltipContent>
                  </Tooltip>
                ) : linkContent;
              })}

              {/* Admin Section */}
              {(currentUser?.role === 'admin' || currentUser?.permissions?.admin) && (
                <>
                  <div className="my-3 border-t border-slate-700/60"></div>
                  {(() => {
                    const isActive = currentPageName === "Admin";
                    const linkContent = (
                      <Link
                        to={createPageUrl("Admin")}
                        onClick={() => setSidebarOpen(false)}
                        className={`
                          flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                          transition-all duration-200
                          ${sidebarMinimized ? 'justify-center px-0' : ''}
                          ${isActive
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                            : 'text-slate-400 hover:text-white hover:bg-slate-700/60'
                          }
                        `}
                      >
                        <Shield className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-purple-400' : ''}`} strokeWidth={1.75} />
                        {!sidebarMinimized && (
                          <span className="whitespace-nowrap">Administrativo</span>
                        )}
                        {isActive && !sidebarMinimized && (
                          <div className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-400"></div>
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
                          sideOffset={10}
                          className="bg-slate-800 text-white border-slate-600 shadow-lg z-[60]"
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
              absolute -right-3 top-20
              w-6 h-6
              items-center justify-center
              bg-slate-700 hover:bg-slate-600
              border border-slate-600
              rounded-full
              transition-all duration-300
              opacity-0 group-hover/sidebar:opacity-100
              hover:scale-110
              shadow-md
            `}
            title={sidebarMinimized ? "Expandir menu" : "Minimizar menu"}
          >
            {sidebarMinimized ? (
              <ChevronRight className="w-3 h-3 text-slate-300" strokeWidth={2.5} />
            ) : (
              <ChevronLeft className="w-3 h-3 text-slate-300" strokeWidth={2.5} />
            )}
          </button>

          {/* Bottom Decoration */}
          <div className="h-14 border-t border-slate-700/60 flex items-center px-4">
            {!sidebarMinimized ? (
              <div className="text-xs text-slate-500 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></div>
                <span>v1.0.0</span>
              </div>
            ) : (
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse mx-auto"></div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`pt-14 lg:pt-0 transition-all duration-300 ${sidebarMinimized ? 'lg:ml-20' : 'lg:ml-64'}`}>
        <div className="p-4 lg:p-6 max-w-[1600px] mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

export default function Layout({ children, currentPageName }) {
  return (
    <ThemeProvider>
      <AppLayout currentPageName={currentPageName}>{children}</AppLayout>
    </ThemeProvider>
  );
}