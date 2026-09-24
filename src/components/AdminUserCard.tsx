import React, { useState, useRef, useEffect } from 'react';
import { 
  User as UserIcon, 
  Car, 
  Bike, 
  Shield, 
  MapPin, 
  Copy, 
  MoreVertical, 
  MessageCircle, 
  History, 
  Gift, 
  Lock, 
  Unlock, 
  UserPlus, 
  Trash2, 
  Check, 
  Clock, 
  Plane, 
  CheckCircle2, 
  AlertTriangle 
} from 'lucide-react';
import { toast } from 'sonner';

export const formatTimeAgo = (dateVal: any): string => {
  if (!dateVal) return 'Reciente';
  let date: Date;
  if (dateVal.toDate && typeof dateVal.toDate === 'function') {
    date = dateVal.toDate();
  } else if (dateVal.seconds) {
    date = new Date(dateVal.seconds * 1000);
  } else {
    date = new Date(dateVal);
  }
  if (isNaN(date.getTime())) return 'Reciente';

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return 'Hace un momento';

  const mins = Math.floor(diffMs / (1000 * 60));
  if (mins < 1) return 'Hace un momento';
  if (mins < 60) return `Hace ${mins}h`; // Prompt specifies 'Hace 2h' format

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `Hace ${days}d`;

  const months = Math.floor(days / 30);
  if (months < 12) return `Hace ${months}m`;

  return `Hace ${Math.floor(months / 12)}a`;
};

export interface AdminUserCardProps {
  user: any;
  currentAdminUid?: string;
  onAssignBonus: (user: any) => void;
  onSendMessage: (user: any) => void;
  onViewHistory: (user: any) => void;
  onToggleBlock: (user: any) => void;
  onToggleSuplente: (user: any) => void;
  onConvertToDriver: (user: any) => void;
  onDeleteUser?: (user: any) => void;
}

export const AdminUserCard: React.FC<AdminUserCardProps> = ({
  user,
  currentAdminUid,
  onAssignBonus,
  onSendMessage,
  onViewHistory,
  onToggleBlock,
  onToggleSuplente,
  onConvertToDriver,
  onDeleteUser,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showDriverConfirmModal, setShowDriverConfirmModal] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  const rawPhone = user.celular || user.telefono || '';
  const cleanDigits = rawPhone.replace(/\D/g, '');
  const displayPhone = rawPhone || 'Sin teléfono';

  const handleCopyPhone = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!cleanDigits) {
      toast.info('Este usuario no tiene teléfono registrado');
      return;
    }
    navigator.clipboard.writeText(cleanDigits);
    setCopiedPhone(true);
    toast.success(`Teléfono copiado: ${cleanDigits}`);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDropdownOpen(false);
    if (!cleanDigits) {
      toast.error(`No hay número de WhatsApp registrado para ${user.nombre || 'este usuario'}`);
      return;
    }
    let fullPhone = cleanDigits;
    if (fullPhone.length === 10) fullPhone = '57' + fullPhone;
    const msg = encodeURIComponent(`Hola ${user.nombre || ''}, te escribo de Ruedas Rápidas.`);
    window.open(`https://wa.me/${fullPhone}?text=${msg}`, '_blank');
  };

  // Stats calculation
  const totalExitosos = Number(user.servicios_count || 0);
  const totalPerdidos = Number(user.servicios_perdidos || 0);
  const totalServices = totalExitosos + totalPerdidos;
  const successRate = totalServices > 0 
    ? Math.round((totalExitosos / totalServices) * 100) 
    : 100;

  const initialLetter = (user.nombre || user.email || 'U').charAt(0).toUpperCase();
  const timeAgoStr = formatTimeAgo(user.createdAt || user.fecha || user.fecha_registro);
  const hasBonus = Number(user.saldo_promo || 0) > 0;
  const isDriver = user.rol === 'conductor' || user.rol === 'ambos';
  const isSuperAdmin = user.email === 'darwin.barbosa000@gmail.com' || user.email === 'ruedasrapidasviajaseguro@gmail.com';

  return (
    <div className="bg-white rounded-2xl shadow-xs border border-slate-100 p-4 mb-3 hover:shadow-md transition-all relative group">
      {/* HEADER: Avatar inicial + Nombre bold 16px + Badge Rol + Badge Bono gris suave + 3 puntitos ⋮ */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar inicial */}
          <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-700 font-black text-sm flex items-center justify-center border border-slate-200 shrink-0">
            {initialLetter}
          </div>

          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <h4 className="text-[16px] font-bold text-slate-900 truncate">
              {user.nombre || 'Usuario sin nombre'}
            </h4>

            {/* Badge Rol (Conductor azul / Pasajero verde) */}
            {isDriver ? (
              <span className="bg-blue-50 text-blue-700 border border-blue-200 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 shrink-0">
                <Car size={11} />
                <span>Conductor</span>
              </span>
            ) : user.rol === 'admin' ? (
              <span className="bg-purple-50 text-purple-700 border border-purple-200 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 shrink-0">
                <Shield size={11} />
                <span>Admin</span>
              </span>
            ) : user.rol === 'admin_suplente' ? (
              <span className="bg-amber-50 text-amber-700 border border-amber-200 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 shrink-0">
                <Shield size={11} />
                <span>Suplente</span>
              </span>
            ) : (
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 shrink-0">
                <UserIcon size={11} />
                <span>Pasajero</span>
              </span>
            )}

            {/* Badge Bono gris suave (NO amarillo chillón) */}
            <span className="bg-slate-100 text-slate-600 border border-slate-200 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
              {hasBonus ? (
                <>
                  <Gift size={11} className="text-slate-500" />
                  <span>Bono: ${(user.saldo_promo || 0).toLocaleString()} COP</span>
                </>
              ) : (
                <>
                  <Gift size={11} className="text-slate-400" />
                  <span>Sin Bono</span>
                </>
              )}
            </span>

            {user.bloqueado && (
              <span className="bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold px-2 py-0.5 rounded-full shrink-0">
                Bloqueado
              </span>
            )}
          </div>
        </div>

        {/* 3 Puntitos ⋮ Menú Dropdown */}
        <div className="relative shrink-0" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer"
            title="Opciones"
          >
            <MoreVertical size={18} />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-9 w-60 bg-white rounded-2xl shadow-xl border border-slate-100 py-1.5 z-50 text-xs font-medium divide-y divide-slate-100">
              <div className="py-1">
                <button
                  onClick={handleWhatsApp}
                  className="w-full px-4 py-2 text-left hover:bg-emerald-50 text-emerald-700 flex items-center gap-2.5 cursor-pointer font-bold"
                >
                  <MessageCircle size={15} className="text-emerald-500" />
                  <span>Enviar WhatsApp</span>
                </button>
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    onSendMessage(user);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-slate-50 text-slate-700 flex items-center gap-2.5 cursor-pointer"
                >
                  <MessageCircle size={15} className="text-indigo-500" />
                  <span>Mensaje Interno</span>
                </button>
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    onViewHistory(user);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-slate-50 text-slate-700 flex items-center gap-2.5 cursor-pointer"
                >
                  <History size={15} className="text-amber-500" />
                  <span>Ver Historial de Viajes</span>
                </button>
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    onAssignBonus(user);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-slate-50 text-slate-700 flex items-center gap-2.5 cursor-pointer"
                >
                  <Gift size={15} className="text-emerald-500" />
                  <span>{hasBonus ? 'Editar Bono Promo' : 'Asignar Bono Promo'}</span>
                </button>
              </div>

              <div className="py-1">
                {/* Hacer Suplente */}
                {user.rol !== 'admin' && (
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      onToggleSuplente(user);
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-amber-50 text-amber-800 flex items-center gap-2.5 cursor-pointer"
                  >
                    <Shield size={15} className="text-amber-500" />
                    <span>{user.rol === 'admin_suplente' ? 'Quitar Suplente' : 'Hacer Suplente'}</span>
                  </button>
                )}

                {/* Hacer Conductor con confirmación */}
                {!isDriver && (
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      setShowDriverConfirmModal(true);
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-blue-50 text-blue-700 flex items-center gap-2.5 cursor-pointer"
                  >
                    <UserPlus size={15} className="text-blue-500" />
                    <span>Hacer Conductor</span>
                  </button>
                )}

                {/* Bloquear con confirmación roja */}
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    onToggleBlock(user);
                  }}
                  className={`w-full px-4 py-2 text-left flex items-center gap-2.5 cursor-pointer font-bold ${
                    user.bloqueado 
                      ? 'hover:bg-emerald-50 text-emerald-700' 
                      : 'hover:bg-rose-50 text-rose-600'
                  }`}
                >
                  {user.bloqueado ? (
                    <>
                      <Unlock size={15} className="text-emerald-500" />
                      <span>Desbloquear Usuario</span>
                    </>
                  ) : (
                    <>
                      <Lock size={15} className="text-rose-500" />
                      <span>Bloquear Usuario</span>
                    </>
                  )}
                </button>

                {/* Eliminar usuario si aplica */}
                {onDeleteUser && !isSuperAdmin && user.rol !== 'admin' && user.id !== currentAdminUid && (
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      onDeleteUser(user);
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-rose-50 text-rose-600 flex items-center gap-2.5 cursor-pointer"
                  >
                    <Trash2 size={15} />
                    <span>Eliminar Registro</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FILA CONTACTO: email gris 12px · teléfono con icono copiar */}
      <div className="flex items-center gap-2 text-xs text-slate-500 mt-2 flex-wrap">
        <span className="text-slate-500 truncate">{user.email || 'Sin correo registrado'}</span>
        <span className="text-slate-300">·</span>
        <button
          onClick={handleCopyPhone}
          className="flex items-center gap-1.5 text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer group font-medium"
          title="Clic para copiar teléfono"
        >
          <span>{displayPhone}</span>
          {copiedPhone ? (
            <Check size={13} className="text-emerald-600" />
          ) : (
            <Copy size={13} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
          )}
        </button>
      </div>

      {/* FILA STATS + BOTÓN: [📍 Ciudad] [✈️ 27 viajes] [✅ 96% éxito] [Hace 2h] en una sola línea */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-50">
        <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
          <span className="flex items-center gap-1 font-semibold text-slate-700 bg-slate-50 px-2 py-0.5 rounded-md">
            <span>📍</span>
            <span>{user.ciudad || 'Fusagasugá'}</span>
          </span>
          <span className="flex items-center gap-1 font-medium text-slate-600 bg-slate-50 px-2 py-0.5 rounded-md">
            <span>✈️</span>
            <span>{totalExitosos} viajes</span>
          </span>
          <span className="flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
            <span>✅</span>
            <span>{successRate}% éxito</span>
          </span>
          <span className="flex items-center gap-1 text-slate-400 text-[11px]" title="Fecha de registro">
            <span>🕒</span>
            <span>{timeAgoStr}</span>
          </span>
        </div>

        {/* Solo 1 botón principal si no tiene bono: "Asignar Bono" outline verde. Si ya tiene, ningún botón. */}
        {!hasBonus && (
          <button
            onClick={() => onAssignBonus(user)}
            className="border-2 border-emerald-500 text-emerald-700 hover:bg-emerald-50 text-xs font-black px-3.5 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shrink-0 self-start sm:self-auto active:scale-95 shadow-xs"
          >
            <Gift size={13} className="text-emerald-600" />
            <span>Asignar Bono</span>
          </button>
        )}
      </div>

      {/* Modal de Doble Confirmación para "Hacer Conductor" */}
      {showDriverConfirmModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-100 space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <Car size={24} />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base font-bold text-slate-900">
                ¿Convertir a Conductor?
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                ¿Seguro que quieres convertir a <strong className="text-slate-900 font-bold">{user.nombre || 'este usuario'}</strong> en conductor? Esto quedará registrado.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowDriverConfirmModal(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setShowDriverConfirmModal(false);
                  onConvertToDriver(user);
                }}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer active:scale-95"
              >
                Sí, Convertir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUserCard;
