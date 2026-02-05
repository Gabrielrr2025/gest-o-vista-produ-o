import React, { useState, useEffect } from 'react';
import { Link } from "react-router-dom";
import { createPageUrl } from "./utils";
import { Button } from "@/components/ui/button";
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
  Moon,
  Sun
} from "lucide-react";

const navigation = [
  { name: "Dashboard", page: "Dashboard", icon: LayoutDashboard },
  { name: "Produtos", page: "Products", icon: Package },
  { name: "Calendário", page: "Calendar", icon: CalendarDays },
  { name: "Relatórios", page: "Reports", icon: FileSpreadsheet },
  { name: "Histórico", page: "History", icon: History },
  { name: "Importar", page: "Import", icon: Upload },
  { name: "Configurações", page: "Settings", icon: Settings },
];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('darkMode', darkMode);
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <div className="min-h-screen bg-[hsl(var(--bg-primary))] transition-colors duration-200">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[hsl(var(--bg-tertiary))] border-b border-[hsl(var(--border-light))] z-50 flex items-center justify-between px-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <ChefHat className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-[hsl(var(--text-primary))]">Gestão à Vista</span>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setDarkMode(!darkMode)}
            className="text-[hsl(var(--text-secondary))] hover:text-[hsl(var(--text-primary))] hover:bg-[hsl(var(--bg-secondary))]"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
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
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-md">
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
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-orange-200' 
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                    }
                  `}
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-[hsl(var(--border-light))] space-y-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDarkMode(!darkMode)}
              className="w-full border-[hsl(var(--border-medium))] hover:bg-[hsl(var(--bg-secondary))]"
            >
              {darkMode ? (
                <>
                  <Sun className="w-4 h-4 mr-2" />
                  Modo Claro
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 mr-2" />
                  Modo Escuro
                </>
              )}
            </Button>
            <div className="bg-[hsl(var(--bg-secondary))] rounded-lg p-3.5 border border-[hsl(var(--border-light))]">
              <p className="text-xs text-[hsl(var(--text-tertiary))] mb-2 font-medium">Setores Ativos</p>
              <div className="flex flex-wrap gap-1.5">
                {["Padaria", "Salgados", "Confeitaria"].map(sector => (
                  <span key={sector} className="text-xs bg-[hsl(var(--bg-tertiary))] border border-[hsl(var(--border-light))] px-2.5 py-1 rounded-md text-[hsl(var(--text-secondary))] font-medium">
                    {sector}
                  </span>
                ))}
              </div>
            </div>
          </div>
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