import React from 'react';
import { 
  Trash2, User as UserIcon, Car, Store, Search, CheckCheck, 
  AlertTriangle, CheckCircle2 
} from 'lucide-react';

interface AdminDepuracionTabProps {
  allUsers: any[];
  allDrivers: any[];
  marcasAliadas: any[];
  user: any;
  depuracionEntityType: 'usuarios' | 'conductores' | 'aliados';
  setDepuracionEntityType: (type: 'usuarios' | 'conductores' | 'aliados') => void;
  depuracionFilter: 'todos' | 'spam' | 'inactivos';
  setDepuracionFilter: (filter: 'todos' | 'spam' | 'inactivos') => void;
  depuracionSearchTerm: string;
  setDepuracionSearchTerm: (term: string) => void;
  selectedDepuracionIds: string[];
  setSelectedDepuracionIds: React.Dispatch<React.SetStateAction<string[]>>;
  checkUserStatus: (u: any) => { isProtected: boolean; isSpam: boolean; isInactive: boolean };
  checkDriverStatus: (d: any) => { isProtected: boolean; isSpam: boolean; isInactive: boolean };
  checkAliadoStatus: (m: any) => { isProtected: boolean; isSpam: boolean; isInactive: boolean };
  abrirModalEliminar: (target: {
    id: string;
    tipo: 'usuario' | 'conductor' | 'aliado';
    nombre: string;
    email?: string;
    telefono?: string;
    motivoSugerido?: string;
    detalles?: string;
  }) => void;
  abrirModalEliminarLote: (items: {
    id: string;
    tipo: 'usuario' | 'conductor' | 'aliado';
    nombre: string;
    email?: string;
    telefono?: string;
    detalles?: string;
  }[]) => void;
}

export const AdminDepuracionTab: React.FC<AdminDepuracionTabProps> = ({
  allUsers,
  allDrivers,
  marcasAliadas,
  depuracionEntityType,
  setDepuracionEntityType,
  depuracionFilter,
  setDepuracionFilter,
  depuracionSearchTerm,
  setDepuracionSearchTerm,
  selectedDepuracionIds,
  setSelectedDepuracionIds,
  checkUserStatus,
  checkDriverStatus,
  checkAliadoStatus,
  abrirModalEliminar,
  abrirModalEliminarLote
}) => {
  const depuracionUsuarios = allUsers.filter(u => {
    if (u.rol === 'marca_aliada') return false;
    const status = checkUserStatus(u);
    if (depuracionFilter === 'spam' && !status.isSpam) return false;
    if (depuracionFilter === 'inactivos' && !status.isInactive) return false;
    if (depuracionSearchTerm.trim()) {
      const term = depuracionSearchTerm.toLowerCase();
      const matchName = (u.nombre || '').toLowerCase().includes(term);
      const matchEmail = (u.email || '').toLowerCase().includes(term);
      const matchTel = String(u.telefono || u.celular || '').includes(term);
      const matchCiudad = (u.ciudad || '').toLowerCase().includes(term);
      if (!matchName && !matchEmail && !matchTel && !matchCiudad) return false;
    }
    return true;
  });

  const depuracionConductores = allDrivers.filter(d => {
    const status = checkDriverStatus(d);
    if (depuracionFilter === 'spam' && !status.isSpam) return false;
    if (depuracionFilter === 'inactivos' && !status.isInactive) return false;
    if (depuracionSearchTerm.trim()) {
      const term = depuracionSearchTerm.toLowerCase();
      const matchName = (d.nombre || '').toLowerCase().includes(term);
      const matchPlaca = (d.vehiculo?.placa || '').toLowerCase().includes(term);
      const matchTel = String(d.telefono || d.celular || '').includes(term);
      const matchCiudad = (d.ciudad || '').toLowerCase().includes(term);
      if (!matchName && !matchPlaca && !matchTel && !matchCiudad) return false;
    }
    return true;
  });

  const depuracionAliados = marcasAliadas.filter(m => {
    const status = checkAliadoStatus(m);
    if (depuracionFilter === 'spam' && !status.isSpam) return false;
    if (depuracionFilter === 'inactivos' && !status.isInactive) return false;
    if (depuracionSearchTerm.trim()) {
      const term = depuracionSearchTerm.toLowerCase();
      const matchName = (m.nombre || '').toLowerCase().includes(term);
      const matchDir = (m.direccion || '').toLowerCase().includes(term);
      const matchTel = String(m.whatsapp || '').includes(term);
      const matchCiudad = (m.ciudad || '').toLowerCase().includes(term);
      if (!matchName && !matchDir && !matchTel && !matchCiudad) return false;
    }
    return true;
  });

  const currentItems = depuracionEntityType === 'usuarios' 
    ? depuracionUsuarios 
    : depuracionEntityType === 'conductores' 
      ? depuracionConductores 
      : depuracionAliados;

  const selectableIds = currentItems
    .filter(item => {
      if (depuracionEntityType === 'usuarios') return !checkUserStatus(item).isProtected;
      if (depuracionEntityType === 'conductores') return !checkDriverStatus(item).isProtected;
      return true;
    })
    .map(it => it.id);

  const allVisibleSelected = selectableIds.length > 0 && selectableIds.every(id => selectedDepuracionIds.includes(id));

  const toggleSelectId = (id: string) => {
    setSelectedDepuracionIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedDepuracionIds(prev => prev.filter(id => !selectableIds.includes(id)));
    } else {
      setSelectedDepuracionIds(prev => Array.from(new Set([...prev, ...selectableIds])));
    }
  };

  const handleEliminarSeleccionados = () => {
    const itemsToDelete: {
      id: string;
      tipo: 'usuario' | 'conductor' | 'aliado';
      nombre: string;
      email?: string;
      telefono?: string;
      detalles?: string;
    }[] = [];

    if (depuracionEntityType === 'usuarios') {
      selectedDepuracionIds.forEach(id => {
        const u = allUsers.find(x => x.id === id);
        if (u && !checkUserStatus(u).isProtected) {
          itemsToDelete.push({
            id: u.id,
            tipo: 'usuario',
            nombre: u.nombre || 'Usuario',
            email: u.email,
            telefono: u.celular || u.telefono,
            detalles: `Viajes: ${u.servicios_count || 0} • Ciudad: ${u.ciudad || 'N/A'}`
          });
        }
      });
    } else if (depuracionEntityType === 'conductores') {
      selectedDepuracionIds.forEach(id => {
        const d = allDrivers.find(x => x.id === id);
        if (d && !checkDriverStatus(d).isProtected) {
          itemsToDelete.push({
            id: d.id,
            tipo: 'conductor',
            nombre: d.nombre || 'Conductor',
            telefono: d.telefono || d.celular,
            detalles: `Placa: ${d.vehiculo?.placa || 'N/A'} • Viajes: ${d.servicios_completados || 0}`
          });
        }
      });
    } else if (depuracionEntityType === 'aliados') {
      selectedDepuracionIds.forEach(id => {
        const m = marcasAliadas.find(x => x.id === id);
        if (m) {
          itemsToDelete.push({
            id: m.id,
            tipo: 'aliado',
            nombre: m.nombre || 'Aliado',
            telefono: m.whatsapp,
            detalles: `Ciudad: ${m.ciudad || 'N/A'}`
          });
        }
      });
    }

    abrirModalEliminarLote(itemsToDelete);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 rounded-[2.5rem] p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-rose-500/20 border border-rose-500/30 rounded-full text-rose-300 text-[10px] font-black uppercase tracking-wider">
              <Trash2 size={13} className="text-rose-400" />
              Módulo de Depuración & Control Anti-Spam
            </div>
            <h2 className="text-2xl font-black tracking-tight">Depuración y Limpieza del Sistema</h2>
            <p className="text-slate-300 text-xs max-w-2xl leading-relaxed">
              Elimina usuarios, conductores y marcas aliadas inactivas o sospechosas a tu criterio como administrador. Garantiza una base de datos limpia, ágil y de alto rendimiento.
            </p>
          </div>

          {/* Counter Badges */}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="bg-white/10 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-white/10 text-center min-w-[90px]">
              <span className="block text-xl font-black text-rose-400 leading-tight">
                {allUsers.filter(u => checkUserStatus(u).isSpam || checkUserStatus(u).isInactive).length}
              </span>
              <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wider">Usuarios</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-white/10 text-center min-w-[90px]">
              <span className="block text-xl font-black text-amber-400 leading-tight">
                {allDrivers.filter(d => checkDriverStatus(d).isSpam || checkDriverStatus(d).isInactive).length}
              </span>
              <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wider">Conductores</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-white/10 text-center min-w-[90px]">
              <span className="block text-xl font-black text-indigo-400 leading-tight">
                {marcasAliadas.filter(m => checkAliadoStatus(m).isSpam || checkAliadoStatus(m).isInactive).length}
              </span>
              <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wider">Aliados</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Depuración Panel */}
      <div className="bg-white rounded-[2.5rem] p-6 border border-slate-200/80 shadow-sm space-y-6">
        {/* Entity Selector Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-2xl border border-slate-200/60 overflow-x-auto">
            <button
              onClick={() => {
                setDepuracionEntityType('usuarios');
                setSelectedDepuracionIds([]);
              }}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                depuracionEntityType === 'usuarios'
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/80'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <UserIcon size={15} />
              Usuarios ({depuracionUsuarios.length})
            </button>
            <button
              onClick={() => {
                setDepuracionEntityType('conductores');
                setSelectedDepuracionIds([]);
              }}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                depuracionEntityType === 'conductores'
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/80'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Car size={15} />
              Conductores ({depuracionConductores.length})
            </button>
            <button
              onClick={() => {
                setDepuracionEntityType('aliados');
                setSelectedDepuracionIds([]);
              }}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                depuracionEntityType === 'aliados'
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/80'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Store size={15} />
              Aliados ({depuracionAliados.length})
            </button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-1 bg-slate-100/60 p-1 rounded-2xl border border-slate-200/50">
            {(['todos', 'spam', 'inactivos'] as const).map(flt => (
              <button
                key={flt}
                onClick={() => {
                  setDepuracionFilter(flt);
                  setSelectedDepuracionIds([]);
                }}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase transition-all cursor-pointer ${
                  depuracionFilter === flt
                    ? 'bg-white text-slate-800 shadow-xs border border-slate-200'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {flt === 'todos' && 'Todos'}
                {flt === 'spam' && '🚨 Spam / Bloqueados'}
                {flt === 'inactivos' && '💤 Inactivos'}
              </button>
            ))}
          </div>
        </div>

        {/* Search & Bulk Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder={`Buscar ${depuracionEntityType} por nombre, teléfono, ciudad, placa o email...`}
              value={depuracionSearchTerm}
              onChange={(e) => setDepuracionSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {selectableIds.length > 0 && (
              <button
                onClick={handleSelectAllVisible}
                className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <CheckCheck size={14} className={allVisibleSelected ? "text-indigo-600" : "text-slate-400"} />
                {allVisibleSelected ? "Deseleccionar todos" : `Seleccionar visibles (${selectableIds.length})`}
              </button>
            )}

            {selectedDepuracionIds.length > 0 && (
              <button
                onClick={handleEliminarSeleccionados}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-rose-600/20"
              >
                <Trash2 size={14} />
                Eliminar ({selectedDepuracionIds.length})
              </button>
            )}
          </div>
        </div>

        {/* Items List */}
        <div className="space-y-3">
          {currentItems.length === 0 ? (
            <div className="p-12 text-center bg-slate-50/60 rounded-3xl border border-dashed border-slate-200">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-inner">
                <CheckCircle2 size={28} />
              </div>
              <h4 className="text-sm font-bold text-slate-800">No hay registros para este filtro</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                No se encontraron {depuracionEntityType} que coincidan con la búsqueda y filtro seleccionados.
              </p>
            </div>
          ) : (
            currentItems.map((item: any) => {
              const isSelected = selectedDepuracionIds.includes(item.id);
              let statusInfo = { isProtected: false, isSpam: false, isInactive: false };
              if (depuracionEntityType === 'usuarios') statusInfo = checkUserStatus(item);
              if (depuracionEntityType === 'conductores') statusInfo = checkDriverStatus(item);
              if (depuracionEntityType === 'aliados') statusInfo = checkAliadoStatus(item);

              return (
                <div
                  key={`depuracion-item-${item.id}`}
                  className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                    isSelected
                      ? 'bg-rose-50/50 border-rose-200 shadow-sm'
                      : statusInfo.isSpam
                        ? 'bg-rose-50/20 border-rose-100 hover:border-rose-200'
                        : statusInfo.isInactive
                          ? 'bg-slate-50/40 border-slate-200/80 hover:border-slate-300'
                          : 'bg-white border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    {/* Selection Checkbox */}
                    <input
                      type="checkbox"
                      disabled={statusInfo.isProtected}
                      checked={isSelected}
                      onChange={() => toggleSelectId(item.id)}
                      className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                    />

                    {/* Avatar Icon */}
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 font-black text-sm shadow-2xs ${
                      statusInfo.isSpam
                        ? 'bg-rose-100 text-rose-600'
                        : statusInfo.isInactive
                          ? 'bg-slate-100 text-slate-500'
                          : 'bg-indigo-50 text-indigo-600'
                    }`}>
                      {depuracionEntityType === 'usuarios' && <UserIcon size={20} />}
                      {depuracionEntityType === 'conductores' && <Car size={20} />}
                      {depuracionEntityType === 'aliados' && <Store size={20} />}
                    </div>

                    {/* Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-xs font-black text-slate-900 truncate">
                          {item.nombre || (depuracionEntityType === 'aliados' ? 'Comercio Aliado' : 'Sin Nombre')}
                        </h4>
                        {statusInfo.isProtected && (
                          <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[9px] font-black rounded-md">
                            PROTEGIDO
                          </span>
                        )}
                        {statusInfo.isSpam && (
                          <span className="px-2 py-0.5 bg-rose-100 border border-rose-200 text-rose-700 text-[9px] font-black rounded-md flex items-center gap-1">
                            <AlertTriangle size={10} />
                            SPAM / BLOQUEADO
                          </span>
                        )}
                        {statusInfo.isInactive && (
                          <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-black rounded-md">
                            INACTIVO (0 VIAJES)
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-[10px] text-slate-500 font-medium">
                        {depuracionEntityType === 'usuarios' && (
                          <>
                            {item.email && <span>✉️ {item.email}</span>}
                            {item.telefono && <span>📞 {item.telefono}</span>}
                            {item.ciudad && <span>📍 {item.ciudad}</span>}
                            <span>🚕 {item.servicios_count || 0} viajes</span>
                            <span>🎁 Bono: ${(item.saldo_promo || 0).toLocaleString()} COP</span>
                          </>
                        )}

                        {depuracionEntityType === 'conductores' && (
                          <>
                            <span>🚗 Placa: <strong className="font-mono text-slate-700">{item.vehiculo?.placa || 'N/A'}</strong></span>
                            {item.telefono && <span>📞 {item.telefono}</span>}
                            {item.ciudad && <span>📍 {item.ciudad}</span>}
                            <span>🏁 {item.servicios_completados || 0} completados</span>
                            <span>💳 ${(item.tarjeta_virtual || 0).toLocaleString()} COP</span>
                          </>
                        )}

                        {depuracionEntityType === 'aliados' && (
                          <>
                            {item.categoria && <span className="capitalize">🏷️ {item.categoria}</span>}
                            {item.ciudad && <span>📍 {item.ciudad}</span>}
                            {item.whatsapp && <span>💬 {item.whatsapp}</span>}
                            {item.direccion && <span className="truncate max-w-[200px]">🏠 {item.direccion}</span>}
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Row Actions */}
                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    {!statusInfo.isProtected ? (
                      <button
                        onClick={() => {
                          if (depuracionEntityType === 'usuarios') {
                            abrirModalEliminar({
                              id: item.id,
                              tipo: 'usuario',
                              nombre: item.nombre || 'Usuario sin nombre',
                              email: item.email,
                              telefono: item.celular || item.telefono,
                              motivoSugerido: statusInfo.isSpam ? 'Cuenta de spam / bloqueada' : 'Cuenta inactiva (0 servicios)',
                              detalles: `Email: ${item.email || 'N/A'} • Servicios: ${item.servicios_count || 0} • Ciudad: ${item.ciudad || 'N/A'}`
                            });
                          } else if (depuracionEntityType === 'conductores') {
                            abrirModalEliminar({
                              id: item.id,
                              tipo: 'conductor',
                              nombre: item.nombre || 'Conductor sin nombre',
                              telefono: item.telefono || item.celular,
                              motivoSugerido: statusInfo.isSpam ? 'Conductor spam / bloqueado' : 'Conductor inactivo sin servicios',
                              detalles: `Placa: ${item.vehiculo?.placa || 'N/A'} • Servicios: ${item.servicios_completados || 0} • Ciudad: ${item.ciudad || 'N/A'}`
                            });
                          } else if (depuracionEntityType === 'aliados') {
                            abrirModalEliminar({
                              id: item.id,
                              tipo: 'aliado',
                              nombre: item.nombre || 'Comercio Aliado',
                              telefono: item.whatsapp,
                              motivoSugerido: statusInfo.isSpam ? 'Comercio sospechoso o rechazado' : 'Comercio inactivo sin datos',
                              detalles: `Categoría: ${item.categoria || 'N/A'} • Ciudad: ${item.ciudad || 'N/A'}`
                            });
                          }
                        }}
                        className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 border border-rose-200/80 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs"
                        title="Eliminar de la plataforma"
                      >
                        <Trash2 size={13} />
                        Eliminar
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-bold px-3 py-1.5 bg-slate-100 rounded-xl">
                        Inmune
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
