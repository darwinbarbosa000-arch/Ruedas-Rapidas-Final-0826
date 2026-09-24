import React, { useState, useMemo } from 'react';
import { 
  Search, 
  X, 
  MapPin, 
  User as UserIcon, 
  Gift, 
  Clock, 
  Building2, 
  Star, 
  Users, 
  Filter 
} from 'lucide-react';
import { AdminUserCard } from './AdminUserCard';

interface AdminUsersModuleProps {
  allUsers: any[];
  currentAdminUid?: string;
  onAssignBonus: (user: any) => void;
  onSendMessage: (user: any) => void;
  onViewHistory: (user: any) => void;
  onToggleBlock: (user: any) => void;
  onToggleSuplente: (user: any) => void;
  onConvertToDriver: (user: any) => void;
  onDeleteUser?: (user: any) => void;
}

type SortOption = 'recientes' | 'antiguos' | 'ciudad' | 'viajes';
type RoleFilter = 'todos' | 'conductor' | 'pasajero';
type BonusFilter = 'todos' | 'con_bono' | 'sin_bono';

export const AdminUsersModule: React.FC<AdminUsersModuleProps> = ({
  allUsers = [],
  currentAdminUid,
  onAssignBonus,
  onSendMessage,
  onViewHistory,
  onToggleBlock,
  onToggleSuplente,
  onConvertToDriver,
  onDeleteUser,
}) => {
  // Filtros de estado
  const [selectedCity, setSelectedCity] = useState<string>('todas');
  const [selectedRole, setSelectedRole] = useState<RoleFilter>('todos');
  const [selectedBonus, setSelectedBonus] = useState<BonusFilter>('todos');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortOption>('recientes');

  // Filtrar fuera marcas aliadas para la base de usuarios
  const baseUsers = useMemo(() => {
    return allUsers.filter(u => u.rol !== 'marca_aliada');
  }, [allUsers]);

  // Extraer ciudades dinámicas y conteos
  const cityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    baseUsers.forEach(u => {
      const city = (u.ciudad || 'Fusagasugá').trim();
      counts[city] = (counts[city] || 0) + 1;
    });
    return counts;
  }, [baseUsers]);

  // Lista de ciudades conocidas para ordenar el dropdown
  const knownCities = ['Fusagasugá', 'Bogotá', 'Apartadó', 'Icononzo'];
  const allAvailableCities = useMemo(() => {
    const dynamicCities = Object.keys(cityCounts).filter(c => !knownCities.includes(c));
    return [...knownCities, ...dynamicCities];
  }, [cityCounts]);

  // Filtrado de usuarios
  const filteredUsers = useMemo(() => {
    return baseUsers.filter(u => {
      // 1. Filtro de ciudad
      if (selectedCity !== 'todas') {
        const uCity = (u.ciudad || 'Fusagasugá').trim().toLowerCase();
        if (uCity !== selectedCity.toLowerCase()) return false;
      }

      // 2. Filtro de rol
      if (selectedRole === 'conductor') {
        if (u.rol !== 'conductor' && u.rol !== 'ambos') return false;
      } else if (selectedRole === 'pasajero') {
        if (u.rol === 'conductor') return false;
      }

      // 3. Filtro de bono
      const userBonus = Number(u.saldo_promo || 0);
      if (selectedBonus === 'con_bono' && userBonus <= 0) return false;
      if (selectedBonus === 'sin_bono' && userBonus > 0) return false;

      // 4. Búsqueda por nombre, email, teléfono
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchesName = (u.nombre || '').toLowerCase().includes(term);
        const matchesEmail = (u.email || '').toLowerCase().includes(term);
        const matchesPhone = (u.celular || u.telefono || '').replace(/\D/g, '').includes(term.replace(/\D/g, ''));
        if (!matchesName && !matchesEmail && !matchesPhone) return false;
      }

      return true;
    });
  }, [baseUsers, selectedCity, selectedRole, selectedBonus, searchTerm]);

  // Ordenamiento
  const sortedUsers = useMemo(() => {
    const copy = [...filteredUsers];

    const getTimestamp = (val: any) => {
      if (!val) return 0;
      if (val.toDate && typeof val.toDate === 'function') return val.toDate().getTime();
      if (val.seconds) return val.seconds * 1000;
      const d = new Date(val).getTime();
      return isNaN(d) ? 0 : d;
    };

    if (sortBy === 'recientes') {
      return copy.sort((a, b) => {
        const tA = getTimestamp(a.createdAt || a.fecha || a.fecha_registro);
        const tB = getTimestamp(b.createdAt || b.fecha || b.fecha_registro);
        return tB - tA; // Más reciente arriba
      });
    }

    if (sortBy === 'antiguos') {
      return copy.sort((a, b) => {
        const tA = getTimestamp(a.createdAt || a.fecha || a.fecha_registro);
        const tB = getTimestamp(b.createdAt || b.fecha || b.fecha_registro);
        return tA - tB; // Más antiguo arriba
      });
    }

    if (sortBy === 'viajes') {
      return copy.sort((a, b) => {
        const vA = Number(a.servicios_count || 0);
        const vB = Number(b.servicios_count || 0);
        return vB - vA;
      });
    }

    if (sortBy === 'ciudad') {
      return copy.sort((a, b) => {
        const cA = (a.ciudad || 'Fusagasugá').toLowerCase();
        const cB = (b.ciudad || 'Fusagasugá').toLowerCase();
        return cA.localeCompare(cB);
      });
    }

    return copy;
  }, [filteredUsers, sortBy]);

  // Agrupación por ciudad para cuando sortBy === 'ciudad'
  const groupedByCity = useMemo(() => {
    if (sortBy !== 'ciudad') return null;

    const groups: Record<string, any[]> = {};
    sortedUsers.forEach(u => {
      const city = (u.ciudad || 'Fusagasugá').trim();
      if (!groups[city]) groups[city] = [];
      groups[city].push(u);
    });
    return groups;
  }, [sortedUsers, sortBy]);

  return (
    <div className="space-y-4">
      {/* BARRA SUPERIOR STICKY */}
      <div className="sticky top-0 z-30 bg-slate-50/95 backdrop-blur-md pb-4 pt-1 border-b border-slate-200/80 space-y-3">
        {/* FILA 1: DROPDOWNS [Ciudad] [Rol] [Bono] */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Dropdown Ciudad: Todas (con conteo) / Fusagasugá / Bogotá / Apartadó / Icononzo */}
          <div className="relative">
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none cursor-pointer pr-8"
            >
              <option value="todas">
                🏙️ Todas las ciudades ({baseUsers.length})
              </option>
              {allAvailableCities.map(city => {
                const count = cityCounts[city] || 0;
                return (
                  <option key={city} value={city}>
                    📍 {city} ({count})
                  </option>
                );
              })}
            </select>
            <div className="absolute right-3 top-3 pointer-events-none text-slate-400 text-[10px]">
              ▼
            </div>
          </div>

          {/* Dropdown Rol: Todos / Conductor / Pasajero */}
          <div className="relative">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as RoleFilter)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none cursor-pointer pr-8"
            >
              <option value="todos">👥 Todos los roles</option>
              <option value="conductor">🚗 Solo Conductores</option>
              <option value="pasajero">👤 Solo Pasajeros</option>
            </select>
            <div className="absolute right-3 top-3 pointer-events-none text-slate-400 text-[10px]">
              ▼
            </div>
          </div>

          {/* Dropdown Bono: Todos / Con Bono / Sin Bono */}
          <div className="relative">
            <select
              value={selectedBonus}
              onChange={(e) => setSelectedBonus(e.target.value as BonusFilter)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-800 shadow-2xs hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all appearance-none cursor-pointer pr-8"
            >
              <option value="todos">🎁 Todos los bonos</option>
              <option value="con_bono">⚡ Con Bono Asignado</option>
              <option value="sin_bono">🎁 Sin Bono ($0 COP)</option>
            </select>
            <div className="absolute right-3 top-3 pointer-events-none text-slate-400 text-[10px]">
              ▼
            </div>
          </div>
        </div>

        {/* FILA 2: INPUT BÚSQUEDA 🔍 + BOTONES ORDEN */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Input Búsqueda por nombre, email, teléfono con icono */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-slate-400">
              <Search size={16} />
            </div>
            <input
              type="text"
              placeholder="Buscar por nombre, email, teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-9 text-xs font-medium text-slate-800 placeholder-slate-400 shadow-2xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Botones Orden: 🕒 Más recientes (default ACTIVO) / 🕒 Más antiguos / 🏙️ Por Ciudad A-Z / ⭐ Más viajes */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 shrink-0">
            <button
              onClick={() => setSortBy('recientes')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap border ${
                sortBy === 'recientes'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>🕒</span>
              <span>Más recientes</span>
            </button>

            <button
              onClick={() => setSortBy('antiguos')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap border ${
                sortBy === 'antiguos'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>🕒</span>
              <span>Más antiguos</span>
            </button>

            <button
              onClick={() => setSortBy('ciudad')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap border ${
                sortBy === 'ciudad'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>🏙️</span>
              <span>Por Ciudad A-Z</span>
            </button>

            <button
              onClick={() => setSortBy('viajes')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap border ${
                sortBy === 'viajes'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>⭐</span>
              <span>Más viajes</span>
            </button>
          </div>
        </div>

        {/* Resumen de resultados */}
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 px-1 pt-0.5">
          <span>Mostrando <strong className="text-slate-900">{sortedUsers.length}</strong> de {baseUsers.length} usuarios</span>
          {(selectedCity !== 'todas' || selectedRole !== 'todos' || selectedBonus !== 'todos' || searchTerm) && (
            <button
              onClick={() => {
                setSelectedCity('todas');
                setSelectedRole('todos');
                setSelectedBonus('todos');
                setSearchTerm('');
              }}
              className="text-emerald-700 hover:text-emerald-800 font-bold cursor-pointer"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* LISTADO DE USUARIOS */}
      <div className="pt-1">
        {/* Caso 1: Agrupado por Ciudad con Separadores: --- Fusagasugá (45) --- */}
        {groupedByCity ? (
          Object.keys(groupedByCity).length > 0 ? (
            Object.entries(groupedByCity).map(([ciudad, usersInCity]) => (
              <div key={ciudad} className="space-y-3 mb-6">
                {/* Separador de Ciudad visual */}
                <div className="flex items-center gap-3 my-4">
                  <div className="h-[1px] bg-slate-200 flex-1" />
                  <div className="flex items-center gap-1.5 text-xs font-black text-slate-700 uppercase tracking-widest bg-white px-4 py-1.5 rounded-full border border-slate-200 shadow-xs">
                    <span>📍</span>
                    <span>{ciudad}</span>
                    <span className="text-emerald-700 font-mono">({usersInCity.length})</span>
                  </div>
                  <div className="h-[1px] bg-slate-200 flex-1" />
                </div>

                {usersInCity.map(u => (
                  <AdminUserCard
                    key={`user-card-${u.id}`}
                    user={u}
                    currentAdminUid={currentAdminUid}
                    onAssignBonus={onAssignBonus}
                    onSendMessage={onSendMessage}
                    onViewHistory={onViewHistory}
                    onToggleBlock={onToggleBlock}
                    onToggleSuplente={onToggleSuplente}
                    onConvertToDriver={onConvertToDriver}
                    onDeleteUser={onDeleteUser}
                  />
                ))}
              </div>
            ))
          ) : (
            <div className="py-16 text-center bg-white rounded-3xl border border-slate-100 p-8 space-y-3">
              <Users size={36} className="mx-auto text-slate-300" />
              <p className="text-sm font-bold text-slate-700">No se encontraron usuarios</p>
              <p className="text-xs text-slate-400">Intenta cambiar los filtros o el término de búsqueda.</p>
            </div>
          )
        ) : (
          /* Caso 2: Orden Regular (Recientes, Antiguos, Más Viajes) */
          sortedUsers.length > 0 ? (
            sortedUsers.map(u => (
              <AdminUserCard
                key={`user-card-${u.id}`}
                user={u}
                currentAdminUid={currentAdminUid}
                onAssignBonus={onAssignBonus}
                onSendMessage={onSendMessage}
                onViewHistory={onViewHistory}
                onToggleBlock={onToggleBlock}
                onToggleSuplente={onToggleSuplente}
                onConvertToDriver={onConvertToDriver}
                onDeleteUser={onDeleteUser}
              />
            ))
          ) : (
            <div className="py-16 text-center bg-white rounded-3xl border border-slate-100 p-8 space-y-3">
              <Users size={36} className="mx-auto text-slate-300" />
              <p className="text-sm font-bold text-slate-700">No se encontraron usuarios</p>
              <p className="text-xs text-slate-400">Intenta cambiar los filtros o el término de búsqueda.</p>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default AdminUsersModule;
