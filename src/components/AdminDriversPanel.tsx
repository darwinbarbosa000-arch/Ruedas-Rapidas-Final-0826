import React, { useState, useEffect } from 'react';
import { 
  getPendingDrivers, 
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
  Image as ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface AdminDriversPanelProps {
  adminUid?: string;
  onClose?: () => void;
}

export const AdminDriversPanel: React.FC<AdminDriversPanelProps> = ({ 
  adminUid = 'admin',
  onClose 
}) => {
  const [pendingDrivers, setPendingDrivers] = useState<PendingDriver[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDriver, setSelectedDriver] = useState<PendingDriver | null>(null);
  const [showDocsModal, setShowDocsModal] = useState<boolean>(false);
  
  // Rejection modal
  const [rejectingDriver, setRejectingDriver] = useState<PendingDriver | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Zoomed Image preview
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  const fetchDrivers = async () => {
    setLoading(true);
    try {
      const drivers = await getPendingDrivers();
      setPendingDrivers(drivers);
    } catch (err) {
      console.error('Error al cargar conductores pendientes:', err);
      toast.error('Error al cargar la lista de conductores pendientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, []);

  const handleApprove = async (driver: PendingDriver) => {
    if (!confirm(`¿Estás seguro de aprobar y activar a ${driver.name || driver.nombre}?`)) {
      return;
    }

    setIsSubmitting(true);
    try {
      await approveDriver(driver.id, adminUid);
      toast.success(`¡Conductor ${driver.name || driver.nombre} activado exitosamente!`);
      // Update local state
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
      await rejectDriver(rejectingDriver.id, rejectReason.trim());
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

  return (
    <div className="bg-slate-50 min-h-screen p-4 sm:p-6 md:p-8">
      {/* Header Panel */}
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center border border-emerald-100 shadow-xs">
              <UserCheck size={26} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                Activación de Conductores
                <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
                  {pendingDrivers.length} pendientes
                </span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Verifica la documentación y aprueba o rechaza solicitudes de nuevos conductores en Ruedas Rápidas.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchDrivers}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all active:scale-95 cursor-pointer"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Actualizar
            </button>

            {onClose && (
              <button
                onClick={onClose}
                className="p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Content Table / Grid */}
        {loading ? (
          <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3">
            <RefreshCw size={32} className="animate-spin text-emerald-600 mx-auto" />
            <p className="text-sm font-bold text-slate-600">Cargando solicitudes de conductores pendientes...</p>
          </div>
        ) : pendingDrivers.length === 0 ? (
          <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3">
            <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto border border-emerald-100">
              <ShieldCheck size={36} />
            </div>
            <h3 className="text-lg font-black text-slate-800">¡Todo al día!</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto font-medium">
              No hay nuevos conductores pendientes por verificación. Todas las solicitudes han sido procesadas.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] uppercase font-black text-slate-500 tracking-wider">
                    <th className="py-4 px-6">Foto</th>
                    <th className="py-4 px-6">Nombre & Contacto</th>
                    <th className="py-4 px-6">Cédula</th>
                    <th className="py-4 px-6">Vehículo & Ubicación</th>
                    <th className="py-4 px-6 text-center">Documentos</th>
                    <th className="py-4 px-6 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {pendingDrivers.map((driver, index) => {
                    const docs = driver.driverDocuments || {};
                    const selfie = docs.selfieUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400';

                    return (
                      <tr key={`pending-driver-row-${driver.id || index}-${index}`} className="hover:bg-slate-50/60 transition-colors">
                        {/* Foto / Selfie */}
                        <td className="py-4 px-6">
                          <div 
                            onClick={() => setPreviewImage({ url: selfie, title: `Selfie - ${driver.name || driver.nombre}` })}
                            className="relative group w-12 h-12 rounded-2xl overflow-hidden border border-slate-200 shadow-xs cursor-pointer"
                          >
                            <img 
                              src={selfie} 
                              alt="Selfie conductor" 
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                            />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <Eye size={14} />
                            </div>
                          </div>
                        </td>

                        {/* Nombre & Contacto */}
                        <td className="py-4 px-6">
                          <div className="font-bold text-slate-900">{driver.name || driver.nombre}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                            {driver.telefono && (
                              <span className="flex items-center gap-1">
                                <Phone size={12} className="text-slate-400" />
                                {driver.telefono}
                              </span>
                            )}
                            {driver.email && <span className="text-slate-400">({driver.email})</span>}
                          </div>
                        </td>

                        {/* Cédula */}
                        <td className="py-4 px-6 font-mono font-bold text-slate-700">
                          {driver.cedula || 'No registrada'}
                        </td>

                        {/* Vehículo & Ubicación */}
                        <td className="py-4 px-6">
                          <div className="text-xs font-bold text-slate-800 flex items-center gap-1">
                            <Car size={13} className="text-emerald-600" />
                            <span className="uppercase">{driver.vehiculo?.tipo || 'Carro'}</span> - 
                            <span className="font-mono text-emerald-700 font-black">{driver.vehiculo?.placa || 'SN-PLACA'}</span>
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                            <MapPin size={12} className="text-slate-400" />
                            {driver.ciudad || 'Colombia'}, {driver.departamento || 'Nacional'}
                          </div>
                        </td>

                        {/* Botón Ver Documentos */}
                        <td className="py-4 px-6 text-center">
                          <button
                            onClick={() => {
                              setSelectedDriver(driver);
                              setShowDocsModal(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl transition-all cursor-pointer"
                          >
                            <FileText size={14} />
                            VER DOCUMENTOS
                          </button>
                        </td>

                        {/* Acciones Aprobar / Rechazar */}
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleApprove(driver)}
                              disabled={isSubmitting}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
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
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-black rounded-xl transition-all cursor-pointer active:scale-95"
                            >
                              <XCircle size={14} />
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
              {pendingDrivers.map((driver, index) => {
                const docs = driver.driverDocuments || {};
                const selfie = docs.selfieUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400';

                return (
                  <div key={`pending-driver-card-${driver.id || index}-${index}`} className="p-4 sm:p-6 space-y-4">
                    <div className="flex items-start gap-4">
                      <img 
                        src={selfie} 
                        alt="Selfie conductor" 
                        onClick={() => setPreviewImage({ url: selfie, title: `Selfie - ${driver.name || driver.nombre}` })}
                        className="w-14 h-14 rounded-2xl object-cover border border-slate-200 shadow-xs cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-black text-slate-900 text-base truncate">{driver.name || driver.nombre}</h4>
                        <p className="text-xs text-slate-500 font-mono font-bold mt-0.5">C.C. {driver.cedula || 'No registrada'}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-slate-600">
                          <span className="font-bold text-emerald-700 uppercase bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                            {driver.vehiculo?.tipo || 'Carro'} • {driver.vehiculo?.placa || 'Placa N/A'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-2xl text-xs space-y-1">
                      <div className="text-slate-600 flex items-center gap-1">
                        <Phone size={12} className="text-slate-400" />
                        <span>{driver.telefono || 'Sin teléfono'}</span>
                      </div>
                      <div className="text-slate-600 flex items-center gap-1">
                        <MapPin size={12} className="text-slate-400" />
                        <span>{driver.ciudad || 'Yopal'}, {driver.departamento || 'Casanare'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                      <button
                        onClick={() => {
                          setSelectedDriver(driver);
                          setShowDocsModal(true);
                        }}
                        className="flex-1 py-2.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <FileText size={14} />
                        VER DOCUMENTOS
                      </button>

                      <button
                        onClick={() => handleApprove(driver)}
                        disabled={isSubmitting}
                        className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl flex items-center justify-center gap-1 cursor-pointer active:scale-95"
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
                        className="py-2.5 px-3 bg-rose-50 text-rose-700 border border-rose-200 text-xs font-black rounded-xl flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                      >
                        <XCircle size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* MODAL 1: VER DOCUMENTOS */}
      <AnimatePresence>
        {showDocsModal && selectedDriver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 sm:p-6"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto space-y-6"
            >
              <div className="flex justify-between items-center pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-xl font-black text-slate-900">Documentación del Conductor</h3>
                  <p className="text-xs text-slate-500 font-medium">{selectedDriver.name || selectedDriver.nombre} - C.C. {selectedDriver.cedula}</p>
                </div>
                <button
                  onClick={() => setShowDocsModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Grid de 4 Documentos Requeridos */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Cédula */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                    <span>1. Cédula de Ciudadanía</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">Obligatorio</span>
                  </div>
                  <div 
                    onClick={() => setPreviewImage({ 
                      url: selectedDriver.driverDocuments?.cedulaUrl || 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=400', 
                      title: 'Cédula de Ciudadanía' 
                    })}
                    className="relative group h-36 rounded-xl overflow-hidden border border-slate-200 bg-slate-200 cursor-pointer"
                  >
                    <img 
                      src={selectedDriver.driverDocuments?.cedulaUrl || 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=400'} 
                      alt="Cédula"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs gap-1">
                      <Eye size={16} /> AMPLIAR FOTO
                    </div>
                  </div>
                </div>

                {/* 2. Licencia de Conducción */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                    <span>2. Licencia de Conducción</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">Vigente</span>
                  </div>
                  <div 
                    onClick={() => setPreviewImage({ 
                      url: selectedDriver.driverDocuments?.licenciaUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400', 
                      title: 'Licencia de Conducción' 
                    })}
                    className="relative group h-36 rounded-xl overflow-hidden border border-slate-200 bg-slate-200 cursor-pointer"
                  >
                    <img 
                      src={selectedDriver.driverDocuments?.licenciaUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400'} 
                      alt="Licencia"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs gap-1">
                      <Eye size={16} /> AMPLIAR FOTO
                    </div>
                  </div>
                </div>

                {/* 3. Tarjeta de Propiedad */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                    <span>3. Tarjeta de Propiedad</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">Vehículo</span>
                  </div>
                  <div 
                    onClick={() => setPreviewImage({ 
                      url: selectedDriver.driverDocuments?.tarjetaUrl || 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=400', 
                      title: 'Tarjeta de Propiedad' 
                    })}
                    className="relative group h-36 rounded-xl overflow-hidden border border-slate-200 bg-slate-200 cursor-pointer"
                  >
                    <img 
                      src={selectedDriver.driverDocuments?.tarjetaUrl || 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=400'} 
                      alt="Tarjeta Propiedad"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs gap-1">
                      <Eye size={16} /> AMPLIAR FOTO
                    </div>
                  </div>
                </div>

                {/* 4. Selfie */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                    <span>4. Selfie Conductor</span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md">Perfil</span>
                  </div>
                  <div 
                    onClick={() => setPreviewImage({ 
                      url: selectedDriver.driverDocuments?.selfieUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400', 
                      title: 'Selfie del Conductor' 
                    })}
                    className="relative group h-36 rounded-xl overflow-hidden border border-slate-200 bg-slate-200 cursor-pointer"
                  >
                    <img 
                      src={selectedDriver.driverDocuments?.selfieUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=400'} 
                      alt="Selfie"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-xs gap-1">
                      <Eye size={16} /> AMPLIAR FOTO
                    </div>
                  </div>
                </div>
              </div>

              {/* Botones de Aprobación Final */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  onClick={() => setShowDocsModal(false)}
                  className="px-5 py-3 text-slate-600 bg-slate-100 hover:bg-slate-200 font-bold text-xs rounded-2xl transition-all"
                >
                  CERRAR
                </button>

                <button
                  onClick={() => {
                    setRejectingDriver(selectedDriver);
                    setRejectReason('');
                  }}
                  className="px-5 py-3 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 font-black text-xs rounded-2xl transition-all"
                >
                  RECHAZAR SOLICITUD
                </button>

                <button
                  onClick={() => handleApprove(selectedDriver)}
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-2xl shadow-lg shadow-emerald-200 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                >
                  <CheckCircle2 size={16} />
                  APROBAR CONDUCTOR
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
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 text-rose-600">
                <AlertCircle size={28} />
                <h3 className="text-xl font-black text-slate-900">Rechazar Conductor</h3>
              </div>

              <p className="text-xs text-slate-600 font-medium">
                Indica el motivo del rechazo para <strong>{rejectingDriver.name || rejectingDriver.nombre}</strong>. Se le enviará una notificación con esta razón.
              </p>

              <form onSubmit={handleRejectSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Motivo del rechazo</label>
                  <textarea
                    required
                    rows={3}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Ej: Licencia de conducción no legibles o vencida, foto borrosa de la tarjeta de propiedad."
                    className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setRejectingDriver(null)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
                  >
                    CANCELAR
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting || !rejectReason.trim()}
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black rounded-xl shadow-md transition-all active:scale-95 cursor-pointer"
                  >
                    {isSubmitting ? 'GUARDANDO...' : 'CONFIRMAR RECHAZO'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL 3: AMPLIACIÓN DE FOTO/DOCUMENTO */}
      <AnimatePresence>
        {previewImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreviewImage(null)}
            className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 cursor-pointer"
          >
            <div className="relative max-w-4xl w-full p-2 space-y-2">
              <div className="flex justify-between items-center text-white px-2">
                <span className="text-sm font-bold">{previewImage.title}</span>
                <button className="text-white hover:text-slate-300 p-1">
                  <X size={24} />
                </button>
              </div>
              <img 
                src={previewImage.url} 
                alt={previewImage.title} 
                className="w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl border border-white/20" 
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
