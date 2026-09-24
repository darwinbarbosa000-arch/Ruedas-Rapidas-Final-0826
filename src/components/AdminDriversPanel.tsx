import React, { useState, useEffect, useMemo } from 'react';
import { 
  getPendingDrivers, 
  subscribePendingDrivers,
  approveDriver, 
  rejectDriver, 
  PendingDriver 
} from '../services/adminDriverService';
import { 
  CheckCircle2, 
  XCircle, 
  FileText, 
  UserCheck, 
  ShieldCheck, 
  RefreshCw, 
  Eye, 
  X, 
  Car, 
  Phone, 
  MapPin, 
  AlertCircle,
  Search,
  MessageCircle,
  Sparkles,
  Maximize2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export interface AdminDriversPanelProps {
  adminUid?: string;
  onClose?: () => void;
  isModal?: boolean;
  isOpen?: boolean;
  onOpenModal?: () => void;
}

export const AdminDriversPanel: React.FC<AdminDriversPanelProps> = ({ 
  adminUid = 'admin',
  onClose,
  isModal = false,
  isOpen = true
}) => {
  const [pendingDrivers, setPendingDrivers] = useState<PendingDriver[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDriver, setSelectedDriver] = useState<PendingDriver | null>(null);
  const [showDocsModal, setShowDocsModal] = useState<boolean>(false);
  
  // Search and filter
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterType, setFilterType] = useState<'todos' | 'con_cedula' | 'carro' | 'moto' | 'taxi'>('todos');

  // Rejection modal
  const [rejectingDriver, setRejectingDriver] = useState<PendingDriver | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Zoomed Image preview
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // SUSCRIPCIÓN EN TIEMPO REAL: Se actualiza al milisegundo ante cualquier registro
  useEffect(() => {
    setLoading(true);

    // 1. Carga inicial
    getPendingDrivers().then((drivers) => {
      setPendingDrivers(drivers);
      setLoading(false);
    }).catch((err) => {
      console.warn('Initial fetch pending drivers notice:', err);
      setLoading(false);
    });

    // 2. Suscripción continua a Firestore
    const unsubscribe = subscribePendingDrivers((drivers) => {
      setPendingDrivers(drivers);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const fetchDrivers = async () => {
    setLoading(true);
    try {
      const drivers = await getPendingDrivers();
      setPendingDrivers(drivers);
      toast.success('Lista de solicitudes sincronizada');
    } catch (err) {
      console.error('Error al cargar conductores pendientes:', err);
      toast.error('Error al cargar la lista de conductores pendientes');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (driver: PendingDriver) => {
    const driverName = driver.name || driver.nombre || 'el conductor';
    setIsSubmitting(true);
    try {
      await approveDriver(driver.id, adminUid);
      toast.success(`¡Conductor ${driverName} activado y aprobado con éxito!`, {
        description: 'Ya puede ofertar y realizar viajes en la plataforma.',
        icon: '🎉',
      });
      // Optimistic update
      setPendingDrivers(prev => prev.filter(d => d.id !== driver.id));
      if (selectedDriver?.id === driver.id) {
        setShowDocsModal(false);
        setSelectedDriver(null);
      }
    } catch (err: any) {
      console.error('Error al aprobar conductor:', err);
      toast.error(err.message || 'Error al aprobar el conductor');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingDriver) return;
    if (!rejectReason.trim()) {
      toast.error('Por favor ingresa un motivo para el rechazo');
      return;
    }

    setIsSubmitting(true);
    try {
      await rejectDriver(rejectingDriver.id, rejectReason.trim(), adminUid);
      toast.success(`Solicitud de ${rejectingDriver.name || rejectingDriver.nombre} rechazada`);
      setPendingDrivers(prev => prev.filter(d => d.id !== rejectingDriver.id));
      setRejectingDriver(null);
      setRejectReason('');
      if (selectedDriver?.id === rejectingDriver.id) {
        setShowDocsModal(false);
        setSelectedDriver(null);
      }
    } catch (err: any) {
      console.error('Error al rechazar conductor:', err);
      toast.error(err.message || 'Error al rechazar el conductor');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtrado reactivo en memoria
  const filteredDrivers = useMemo(() => {
    return pendingDrivers.filter((driver) => {
      const term = searchTerm.toLowerCase().trim();
      const matchSearch =
        !term ||
        (driver.name || '').toLowerCase().includes(term) ||
        (driver.nombre || '').toLowerCase().includes(term) ||
        (driver.cedula || '').toLowerCase().includes(term) ||
        (driver.telefono || '').toLowerCase().includes(term) ||
        (driver.vehiculo?.placa || '').toLowerCase().includes(term);

      if (!matchSearch) return false;

      if (filterType === 'con_cedula') {
        const hasDoc = !!(driver.fotoCedulaUrl || driver.driverDocuments?.cedulaUrl);
        return hasDoc;
      }

      if (filterType === 'carro') {
        const t = (driver.vehiculo?.tipo || '').toLowerCase();
        return t.includes('carro') || t.includes('automovil') || t.includes('camioneta');
      }

      if (filterType === 'moto') {
        const t = (driver.vehiculo?.tipo || '').toLowerCase();
        return t.includes('moto');
      }

      if (filterType === 'taxi') {
        const t = (driver.vehiculo?.tipo || '').toLowerCase();
        return t.includes('taxi');
      }

      return true;
    });
  }, [pendingDrivers, searchTerm, filterType]);

  const cleanPhone = (phone?: string) => {
    if (!phone) return '';
    return phone.replace(/\D/g, '');
  };

  const getCedulaPhoto = (driver: PendingDriver) => {
    return (
      driver.fotoCedulaUrl ||
      driver.driverDocuments?.cedulaUrl ||
      'https://images.unsplash.com/photo-1544717305-2782549b5136?w=400'
    );
  };

  // Contenido interno del panel
  const panelContent = (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="bg-white p-6 sm:p-7 rounded-[2.5rem] shadow-sm border border-slate-200/90 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
            <UserCheck size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Activación de Conductores
              </h1>
              <span className="bg-amber-100 border border-amber-300 text-amber-900 text-xs px-3 py-1 rounded-full font-black animate-pulse flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                {pendingDrivers.length} pendientes
              </span>
              <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                Sincronización en vivo
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
              Verifica la documentación KYC de los conductores registrados y aprueba su ingreso a la flota.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={fetchDrivers}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-xl transition-all active:scale-95 cursor-pointer"
            title="Recargar datos de Firestore"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              title="Cerrar ventana"
            >
              <X size={22} />
            </button>
          )}
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda Rápida */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, placa, cédula o teléfono..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl py-2.5 pl-11 pr-4 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'con_cedula', label: 'Con Cédula' },
            { id: 'carro', label: 'Carros' },
            { id: 'moto', label: 'Motos' },
            { id: 'taxi', label: 'Taxis' },
          ].map((tab) => (
            <button
              key={`filter-pill-${tab.id}`}
              onClick={() => setFilterType(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase whitespace-nowrap transition-all cursor-pointer ${
                filterType === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido Principal: Lista / Tabla de Conductores */}
      {loading ? (
        <div className="bg-white p-16 rounded-[2.5rem] border border-slate-200 text-center space-y-4 shadow-sm">
          <RefreshCw size={36} className="animate-spin text-emerald-600 mx-auto" />
          <p className="text-sm font-bold text-slate-700">Verificando solicitudes de conductores en tiempo real...</p>
        </div>
      ) : filteredDrivers.length === 0 ? (
        <div className="bg-white p-14 rounded-[2.5rem] border border-slate-200 text-center space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto border border-emerald-100">
            <ShieldCheck size={36} />
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-lg font-black text-slate-800">
              {pendingDrivers.length === 0
                ? '¡Flota 100% al día!'
                : 'No se encontraron resultados'}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              {pendingDrivers.length === 0
                ? 'No hay solicitudes de conductores pendientes de validación. Cuando un conductor complete el registro, aparecerá aquí inmediatamente.'
                : 'Ningún conductor coincide con los filtros o el término de búsqueda actual.'}
            </p>
          </div>
          {pendingDrivers.length > 0 && (
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterType('todos');
              }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-[2.5rem] border border-slate-200/90 shadow-sm overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] uppercase font-black text-slate-500 tracking-wider">
                  <th className="py-4 px-6">Documento / Foto</th>
                  <th className="py-4 px-6">Conductor & Contacto</th>
                  <th className="py-4 px-6">Cédula</th>
                  <th className="py-4 px-6">Vehículo & Ciudad</th>
                  <th className="py-4 px-6 text-center">Expediente</th>
                  <th className="py-4 px-6 text-right">Acciones de Validación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredDrivers.map((driver, index) => {
                  const cedulaImg = getCedulaPhoto(driver);
                  const phoneNum = cleanPhone(driver.telefono);

                  return (
                    <tr key={`driver-row-${driver.id || index}`} className="hover:bg-slate-50/70 transition-colors">
                      {/* Foto Documento */}
                      <td className="py-4 px-6">
                        <div
                          onClick={() => setPreviewImage({ url: cedulaImg, title: `Cédula - ${driver.name || driver.nombre}` })}
                          className="relative group w-14 h-14 rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shadow-xs cursor-pointer"
                          title="Click para ampliar imagen"
                        >
                          <img
                            src={cedulaImg}
                            alt="Cédula conductor"
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <Maximize2 size={16} />
                          </div>
                        </div>
                      </td>

                      {/* Nombre & Contacto */}
                      <td className="py-4 px-6">
                        <div className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                          {driver.name || driver.nombre}
                          <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                          {driver.telefono && (
                            <span className="flex items-center gap-1 font-mono font-medium text-slate-700">
                              <Phone size={12} className="text-slate-400" />
                              {driver.telefono}
                            </span>
                          )}
                          {phoneNum && (
                            <a
                              href={`https://wa.me/${phoneNum}?text=Hola+${encodeURIComponent(driver.name || driver.nombre || '')},+te+contacto+desde+la+administración+de+Ruedas+Rápidas+para+validar+tu+solicitud+de+conductor.`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-0.5"
                              title="Contactar por WhatsApp"
                            >
                              <MessageCircle size={12} />
                              WhatsApp
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Cédula */}
                      <td className="py-4 px-6 font-mono font-black text-slate-800 text-xs">
                        {driver.cedula || 'No registrada'}
                      </td>

                      {/* Vehículo & Ubicación */}
                      <td className="py-4 px-6">
                        <div className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                          <Car size={13} className="text-emerald-600" />
                          <span className="uppercase">{driver.vehiculo?.tipo || 'Carro'}</span>
                          <span className="bg-amber-100 border border-amber-300 text-amber-900 font-mono px-2 py-0.5 rounded-md font-black text-[11px]">
                            {driver.vehiculo?.placa || 'SN-PLACA'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-1 font-medium">
                          <MapPin size={11} className="text-slate-400" />
                          {driver.ciudad || 'Fusagasugá'}, {driver.departamento || 'Cundinamarca'}
                        </div>
                      </td>

                      {/* Botón Ver Documentos */}
                      <td className="py-4 px-6 text-center">
                        <button
                          onClick={() => {
                            setSelectedDriver(driver);
                            setShowDocsModal(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-95"
                        >
                          <FileText size={14} />
                          Ver Documentos
                        </button>
                      </td>

                      {/* Acciones Aprobar / Rechazar */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleApprove(driver)}
                            disabled={isSubmitting}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                          >
                            <CheckCircle2 size={15} />
                            APROBAR
                          </button>

                          <button
                            onClick={() => {
                              setRejectingDriver(driver);
                              setRejectReason('');
                            }}
                            disabled={isSubmitting}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-black rounded-xl transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                            title="Rechazar solicitud con motivo"
                          >
                            <XCircle size={15} />
                            RECHAZAR
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile / Tablet Cards */}
          <div className="lg:hidden divide-y divide-slate-100">
            {filteredDrivers.map((driver, index) => {
              const cedulaImg = getCedulaPhoto(driver);
              const phoneNum = cleanPhone(driver.telefono);

              return (
                <div key={`pending-driver-mobile-${driver.id || index}`} className="p-5 space-y-4">
                  <div className="flex items-start gap-4">
                    <img
                      src={cedulaImg}
                      alt="Cédula conductor"
                      onClick={() => setPreviewImage({ url: cedulaImg, title: `Cédula - ${driver.name || driver.nombre}` })}
                      className="w-16 h-16 rounded-2xl object-cover border border-slate-200 bg-slate-100 shadow-xs cursor-pointer shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-slate-900 text-base truncate">{driver.name || driver.nombre}</h4>
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping shrink-0"></span>
                      </div>
                      <p className="text-xs text-slate-600 font-mono font-bold mt-0.5">
                        C.C. {driver.cedula || 'No registrada'}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="font-black text-amber-900 font-mono bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md text-[11px]">
                          {driver.vehiculo?.placa || 'SN-PLACA'}
                        </span>
                        <span className="font-bold text-slate-600 uppercase text-[10px] bg-slate-100 px-2 py-0.5 rounded-md">
                          {driver.vehiculo?.tipo || 'Carro'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-2xl text-xs space-y-1.5 border border-slate-100">
                    <div className="flex items-center justify-between">
                      <div className="text-slate-700 flex items-center gap-1.5 font-mono font-bold">
                        <Phone size={13} className="text-slate-400" />
                        <span>{driver.telefono || 'Sin teléfono'}</span>
                      </div>
                      {phoneNum && (
                        <a
                          href={`https://wa.me/${phoneNum}?text=Hola+${encodeURIComponent(driver.name || driver.nombre || '')},+te+contacto+desde+la+administración+de+Ruedas+Rápidas.`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-black flex items-center gap-1"
                        >
                          <MessageCircle size={11} /> WhatsApp
                        </a>
                      )}
                    </div>
                    <div className="text-slate-500 flex items-center gap-1.5 text-[11px]">
                      <MapPin size={12} className="text-slate-400" />
                      <span>{driver.ciudad || 'Fusagasugá'}, {driver.departamento || 'Cundinamarca'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => {
                        setSelectedDriver(driver);
                        setShowDocsModal(true);
                      }}
                      className="flex-1 py-2.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-black rounded-xl flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <FileText size={14} />
                      Documentos
                    </button>

                    <button
                      onClick={() => handleApprove(driver)}
                      disabled={isSubmitting}
                      className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20 active:scale-95 disabled:opacity-50"
                    >
                      <CheckCircle2 size={14} />
                      APROBAR
                    </button>

                    <button
                      onClick={() => {
                        setRejectingDriver(driver);
                        setRejectReason('');
                      }}
                      disabled={isSubmitting}
                      className="p-2.5 bg-rose-50 text-rose-700 border border-rose-200 text-xs font-black rounded-xl flex items-center justify-center cursor-pointer active:scale-95"
                      title="Rechazar"
                    >
                      <XCircle size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* MODAL 1: VER DOCUMENTOS Y EXPEDIENTE */}
      <AnimatePresence>
        {showDocsModal && selectedDriver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[2000] flex items-center justify-center p-4 sm:p-6"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] max-w-3xl w-full p-6 sm:p-8 shadow-2xl max-h-[92vh] overflow-y-auto space-y-6 border border-slate-200"
            >
              <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center font-bold">
                    <FileText size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900">Expediente de Conductor</h3>
                    <p className="text-xs text-slate-500 font-medium">
                      {selectedDriver.name || selectedDriver.nombre} • C.C. {selectedDriver.cedula || 'No registrada'} • Placa: {selectedDriver.vehiculo?.placa || 'SN-PLACA'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowDocsModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 cursor-pointer"
                >
                  <X size={22} />
                </button>
              </div>

              {/* Grid de Documentos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Cédula */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center text-xs font-black text-slate-800">
                    <span>1. Cédula de Ciudadanía</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md font-bold">
                      Subido en Registro
                    </span>
                  </div>
                  <div 
                    onClick={() => setPreviewImage({ 
                      url: getCedulaPhoto(selectedDriver), 
                      title: `Cédula - ${selectedDriver.name || selectedDriver.nombre}` 
                    })}
                    className="relative group h-44 rounded-xl overflow-hidden border border-slate-200 bg-slate-200 cursor-pointer"
                  >
                    <img 
                      src={getCedulaPhoto(selectedDriver)} 
                      alt="Cédula"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs gap-1.5">
                      <Eye size={16} /> CLIC PARA AMPLIAR
                    </div>
                  </div>
                </div>

                {/* 2. Licencia de Conducción */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center text-xs font-black text-slate-800">
                    <span>2. Licencia de Conducción</span>
                    <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-bold">
                      Documento
                    </span>
                  </div>
                  <div 
                    onClick={() => setPreviewImage({ 
                      url: selectedDriver.driverDocuments?.licenciaUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400', 
                      title: 'Licencia de Conducción' 
                    })}
                    className="relative group h-44 rounded-xl overflow-hidden border border-slate-200 bg-slate-200 cursor-pointer"
                  >
                    <img 
                      src={selectedDriver.driverDocuments?.licenciaUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400'} 
                      alt="Licencia"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs gap-1.5">
                      <Eye size={16} /> CLIC PARA AMPLIAR
                    </div>
                  </div>
                </div>

                {/* 3. Tarjeta de Propiedad */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center text-xs font-black text-slate-800">
                    <span>3. Tarjeta de Propiedad</span>
                    <span className="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-bold">
                      Vehículo
                    </span>
                  </div>
                  <div 
                    onClick={() => setPreviewImage({ 
                      url: selectedDriver.driverDocuments?.tarjetaUrl || 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=400', 
                      title: 'Tarjeta de Propiedad' 
                    })}
                    className="relative group h-44 rounded-xl overflow-hidden border border-slate-200 bg-slate-200 cursor-pointer"
                  >
                    <img 
                      src={selectedDriver.driverDocuments?.tarjetaUrl || 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=400'} 
                      alt="Tarjeta Propiedad"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs gap-1.5">
                      <Eye size={16} /> CLIC PARA AMPLIAR
                    </div>
                  </div>
                </div>

                {/* 4. Resumen de Datos */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex flex-col justify-between space-y-3">
                  <div className="space-y-2">
                    <p className="text-xs font-black uppercase text-slate-700 tracking-wider">Ficha Técnica</p>
                    <div className="text-xs space-y-1.5 text-slate-600">
                      <p><strong className="text-slate-800">Nombre:</strong> {selectedDriver.name || selectedDriver.nombre}</p>
                      <p><strong className="text-slate-800">Teléfono:</strong> {selectedDriver.telefono || 'N/A'}</p>
                      <p><strong className="text-slate-800">Cédula:</strong> {selectedDriver.cedula || 'N/A'}</p>
                      <p><strong className="text-slate-800">Tipo de Vehículo:</strong> {selectedDriver.vehiculo?.tipo || 'Carro'}</p>
                      <p><strong className="text-slate-800">Placa:</strong> {selectedDriver.vehiculo?.placa || 'SN-PLACA'}</p>
                      <p><strong className="text-slate-800">Ciudad:</strong> {selectedDriver.ciudad || 'Fusagasugá'}</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200 flex items-center gap-2">
                    {cleanPhone(selectedDriver.telefono) && (
                      <a
                        href={`https://wa.me/${cleanPhone(selectedDriver.telefono)}?text=Hola+${encodeURIComponent(selectedDriver.name || '')},+te+contacto+desde+Ruedas+Rápidas.`}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all"
                      >
                        <MessageCircle size={14} /> Chatear por WhatsApp
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Botones de Aprobación Final */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 flex-wrap">
                <button
                  onClick={() => setShowDocsModal(false)}
                  className="px-5 py-3 text-slate-600 bg-slate-100 hover:bg-slate-200 font-black text-xs rounded-2xl transition-all cursor-pointer"
                >
                  CERRAR
                </button>

                <button
                  onClick={() => {
                    setRejectingDriver(selectedDriver);
                    setRejectReason('');
                  }}
                  className="px-5 py-3 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 font-black text-xs rounded-2xl transition-all cursor-pointer"
                >
                  RECHAZAR SOLICITUD
                </button>

                <button
                  onClick={() => handleApprove(selectedDriver)}
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-2xl shadow-xl shadow-emerald-600/30 transition-all flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Sparkles size={16} />
                  VALIDAR Y APROBAR CONDUCTOR
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL 2: INGRESAR MOTIVO DE RECHAZO */}
      <AnimatePresence>
        {rejectingDriver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[2100] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-[2.5rem] max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-4 border border-slate-200"
            >
              <div className="flex items-center gap-3 text-rose-600">
                <AlertCircle size={28} />
                <h3 className="text-xl font-black text-slate-900">Rechazar Conductor</h3>
              </div>

              <p className="text-xs text-slate-600 font-medium">
                Indica el motivo del rechazo para <strong>{rejectingDriver.name || rejectingDriver.nombre}</strong>. Se le notificará esta razón para que pueda subsanarla.
              </p>

              {/* Botones sugeridos */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase text-slate-400">Motivos frecuentes:</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Foto de cédula borrosa o ilegible',
                    'Placa no coincide con el vehículo',
                    'Documentos vencidos',
                    'Número de teléfono no contesta'
                  ].map((sug, sIdx) => (
                    <button
                      key={`sug-reason-${sIdx}`}
                      type="button"
                      onClick={() => setRejectReason(sug)}
                      className="text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1 rounded-lg transition-all"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleRejectSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                    Motivo detallado:
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Describe el motivo específico del rechazo..."
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRejectingDriver(null)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    CANCELAR
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting || !rejectReason.trim()}
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl shadow-md transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? 'GUARDANDO...' : 'CONFIRMAR RECHAZO'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL 3: AMPLIACIÓN DE FOTO A PANTALLA COMPLETA */}
      <AnimatePresence>
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreviewImage(null)}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-[2200] flex items-center justify-center p-4 cursor-pointer"
          >
            <div className="relative max-w-4xl w-full p-2 space-y-2">
              <div className="flex justify-between items-center text-white px-2">
                <span className="text-sm font-black tracking-wide">{previewImage.title}</span>
                <button className="text-white hover:text-slate-300 p-1 bg-white/10 rounded-xl cursor-pointer">
                  <X size={22} />
                </button>
              </div>
              <img 
                src={previewImage.url} 
                alt={previewImage.title} 
                className="w-full max-h-[82vh] object-contain rounded-2xl shadow-2xl border border-white/20 bg-black/50" 
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  // Si está en modo Modal, lo montamos dentro de un overlay fijo con alta elevación
  if (isModal) {
    if (!isOpen) return null;

    return (
      <AnimatePresence>
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-md z-[1500] flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 15 }}
            className="w-full max-w-7xl max-h-[92vh] overflow-y-auto rounded-[2.5rem] bg-slate-50 p-4 sm:p-6 shadow-2xl border border-slate-200/80"
          >
            {panelContent}
          </motion.div>
        </div>
      </AnimatePresence>
    );
  }

  // Si no es modal, se renderiza integrado en el contenedor padre
  return panelContent;
};

export default AdminDriversPanel;
