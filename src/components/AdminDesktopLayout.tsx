import React, { useState } from 'react';
import { 
  Activity, 
  Compass, 
  Users, 
  UserCheck, 
  CreditCard, 
  Clock, 
  Trophy, 
  Headphones, 
  ShieldAlert, 
  Trash2, 
  Car, 
  FileText, 
  Store, 
  LogOut, 
  FileSpreadsheet, 
  Menu, 
  X,
  Radio,
  ChevronRight,
  ShieldCheck,
  Zap,
  Bell
} from 'lucide-react';

export interface AdminMenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badgeCount?: number;
  badgeColor?: string;
  isImportant?: boolean;
}

interface AdminDesktopLayoutProps {
  currentTab: string;
  onChangeTab: (tabId: any) => void;
  pendingDriversCount: number;
  recargasPendientesCount: number;
  unattendedTripsCount: number;
  alertasCount: number;
  spamCount: number;
  onExitAdmin: () => void;
  onExportExcel: () => void;
  userEmail?: string;
  userName?: string;
  children: React.ReactNode;
}

export const AdminDesktopLayout: React.FC<AdminDesktopLayoutProps> = ({
  currentTab,
  onChangeTab,
  pendingDriversCount,
  recargasPendientesCount,
  unattendedTripsCount,
  alertasCount,
  spamCount,
  onExitAdmin,
  onExportExcel,
  userEmail,
  userName,
  children,
}) => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Menú Vertical DiDi V2 Premium conforme a requerimientos estrictos
  const menuItems: AdminMenuItem[] = [
    {
      id: 'resumen',
      label: 'Dashboard (Centro de Control)',
      icon: Activity,
    },
    {
      id: 'mapa_global',
      label: 'Mapa en Vivo Global',
      icon: Compass,
      badgeColor: 'bg-emerald-500',
    },
    {
      id: 'usuarios',
      label: 'Usuarios',
      icon: Users,
    },
    {
      id: 'activacion',
      label: 'Activación Conductores',
      icon: UserCheck,
      badgeCount: pendingDriversCount,
      badgeColor: 'bg-amber-500',
      isImportant: pendingDriversCount > 0,
    },
    {
      id: 'recargas',
      label: 'Finanzas',
      icon: CreditCard,
      badgeCount: recargasPendientesCount,
      badgeColor: 'bg-indigo-500',
    },
    {
      id: 'espera',
      label: 'Monitor de Espera',
      icon: Clock,
      badgeCount: unattendedTripsCount,
      badgeColor: 'bg-rose-500',
      isImportant: unattendedTripsCount > 0,
    },
    {
      id: 'ranking',
      label: 'Ranking Elite',
      icon: Trophy,
    },
    {
      id: 'soporte',
      label: 'Soporte / Chats',
      icon: Headphones,
    },
    {
      id: 'alertas',
      label: 'Alertas / Sospechosos',
      icon: ShieldAlert,
      badgeCount: alertasCount,
      badgeColor: 'bg-rose-500',
    },
    {
      id: 'depuracion',
      label: 'Logs de Auditoría / Depuración',
      icon: Trash2,
      badgeCount: spamCount,
      badgeColor: 'bg-slate-600',
    },
    // Elementos secundarios
    {
      id: 'conductores',
      label: 'Flota de Conductores',
      icon: Car,
    },
    {
      id: 'historial',
      label: 'Historial de Servicios',
      icon: FileText,
    },
    {
      id: 'aliados',
      label: 'Aliados Comerciales',
      icon: Store,
    },
  ];

  const currentTabObj = menuItems.find(m => m.id === currentTab) || menuItems[0];

  return (
    <div className="min-h-screen w-full bg-[#f8fafc] flex antialiased text-slate-800 relative selection:bg-emerald-500 selection:text-white">
      {/* Mobile Backdrop */}
      {mobileSidebarOpen && (
        <div 
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      {/* SIDEBAR IZQUIERDO FIJO 260px, FONDO #0f172a */}
      <aside 
        className={`fixed lg:sticky top-0 left-0 h-screen w-[260px] min-w-[260px] bg-[#0f172a] text-white flex flex-col justify-between z-50 transition-transform duration-300 border-r border-slate-800/90 shadow-2xl ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Top Header & Logo */}
        <div className="p-5 border-b border-slate-800/80">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                <Car size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-base font-black tracking-tight leading-none text-white">
                  Ruedas Rápidas
                </h2>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400">
                    ADMIN V2 PREMIUM
                  </span>
                </div>
              </div>
            </div>

            <button 
              onClick={() => setMobileSidebarOpen(false)}
              className="lg:hidden p-1.5 text-slate-400 hover:text-white rounded-lg"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Vertical Navigation Menu */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-thin scrollbar-thumb-slate-800">
          <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">
            Operaciones Central
          </p>

          {menuItems.map((item) => {
            const isActive = currentTab === item.id;
            const Icon = item.icon;

            return (
              <button
                key={`sidebar-nav-${item.id}`}
                onClick={() => {
                  onChangeTab(item.id);
                  setMobileSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all text-left group cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-950/40 font-black'
                    : 'text-slate-200 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon 
                    size={17} 
                    className={`shrink-0 transition-colors ${
                      isActive 
                        ? 'text-white' 
                        : item.isImportant 
                        ? 'text-amber-400 animate-pulse' 
                        : 'text-slate-400 group-hover:text-emerald-400'
                    }`} 
                  />
                  <span className="truncate">{item.label}</span>
                </div>

                {/* Badge de conteo si aplica */}
                {typeof item.badgeCount === 'number' && item.badgeCount > 0 && (
                  <span 
                    className={`ml-2 px-1.5 py-0.5 min-w-[20px] text-center text-[10px] font-black text-white rounded-full shrink-0 shadow-sm ${
                      item.badgeColor || 'bg-slate-700'
                    } ${item.isImportant ? 'animate-pulse' : ''}`}
                  >
                    {item.badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Sidebar Footer: Admin Profile & Quick Actions */}
        <div className="p-4 border-t border-slate-800/80 space-y-3 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center text-slate-300 border border-slate-700 font-black text-xs">
              AD
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-white truncate">
                {userName || 'Administrador Central'}
              </p>
              <p className="text-[10px] text-slate-400 truncate">
                {userEmail || 'admin@ruedasrapidas.co'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={onExportExcel}
              className="py-2 px-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-xl text-[10px] font-black flex items-center justify-center gap-1.5 border border-slate-700/80 transition-all cursor-pointer"
              title="Descargar base de datos en Excel"
            >
              <FileSpreadsheet size={13} />
              EXCEL
            </button>
            <button
              onClick={onExitAdmin}
              className="py-2 px-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl text-[10px] font-black flex items-center justify-center gap-1.5 border border-rose-500/20 transition-all cursor-pointer"
              title="Volver a la interfaz de Pasajero"
            >
              <LogOut size={13} />
              SALIR
            </button>
          </div>
        </div>
      </aside>

      {/* CONTENIDO DERECHO: width calc(100% - 260px), background #f8fafc, padding 32px */}
      <div className="flex-1 w-full lg:w-[calc(100%-260px)] min-h-screen bg-[#f8fafc] flex flex-col overflow-y-auto">
        {/* Top Desktop Bar */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-xl bg-slate-100"
            >
              <Menu size={20} />
            </button>

            <div>
              <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400">
                <span>Central de Control</span>
                <ChevronRight size={12} />
                <span className="text-slate-700">{currentTabObj.label}</span>
              </div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                {currentTabObj.label}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onExportExcel}
              className="hidden sm:flex items-center gap-2 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-black rounded-xl transition-all cursor-pointer"
            >
              <FileSpreadsheet size={15} />
              Exportar Todo
            </button>

            <button
              onClick={onExitAdmin}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-black text-white text-xs font-black rounded-xl shadow-sm transition-all cursor-pointer"
            >
              <LogOut size={14} />
              <span>Modo Pasajero</span>
            </button>
          </div>
        </header>

        {/* Main Content Area (padding 32px) */}
        <main className="flex-1 p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminDesktopLayout;
