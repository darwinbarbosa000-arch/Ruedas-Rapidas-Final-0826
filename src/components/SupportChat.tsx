import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, X, MessageCircle, ShieldCheck, Headphones } from 'lucide-react';
import { enviarMensajeSoporte, escucharMensajesSoporte, marcarComoLeidoSoporte, SoporteMensaje } from '../services/supportService';

interface SupportChatProps {
  conductorId: string;
  conductorNombre: string;
  senderId: string;
  senderName: string;
  isAdmin: boolean;
  isOpen: boolean;
  onClose: () => void;
}

export const SupportChat: React.FC<SupportChatProps> = ({ 
  conductorId, 
  conductorNombre, 
  senderId, 
  senderName, 
  isAdmin, 
  isOpen, 
  onClose 
}) => {
  const [mensajes, setMensajes] = useState<SoporteMensaje[]>([]);
  const [nuevoMensaje, setNuevoMensaje] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (conductorId && isOpen) {
      const unsubscribe = escucharMensajesSoporte(conductorId, (msgs) => {
        setMensajes(msgs);
        marcarComoLeidoSoporte(conductorId, isAdmin);
      });
      return () => unsubscribe();
    }
  }, [conductorId, isOpen, isAdmin]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensajes, isOpen]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoMensaje.trim()) return;

    try {
      await enviarMensajeSoporte(
        conductorId,
        conductorNombre,
        senderId,
        senderName,
        nuevoMensaje.trim(),
        isAdmin
      );
      setNuevoMensaje('');
    } catch (error) {
      console.error("Error enviando mensaje de soporte:", error);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 100, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 100, scale: 0.9 }}
          className="fixed bottom-20 right-4 w-[calc(100%-2rem)] sm:w-96 h-[500px] bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col overflow-hidden z-[110]"
        >
          {/* Header */}
          <div className="bg-slate-900 p-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500 rounded-2xl flex items-center justify-center text-white">
                <Headphones size={20} />
              </div>
              <div>
                <h4 className="text-white font-bold text-sm leading-tight">
                  {isAdmin ? `Soporte: ${conductorNombre}` : "Soporte Técnico"}
                </h4>
                <p className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">
                  {isAdmin ? "Atendiendo conductor" : "Estamos para ayudarte"}
                </p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Messages Area */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50"
          >
            {mensajes.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-3 opacity-40">
                <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center">
                  <Headphones size={24} />
                </div>
                <p className="text-xs font-medium text-slate-500">
                  {isAdmin ? "No hay mensajes previos" : "Cuéntanos tu problema o duda"}
                </p>
              </div>
            ) : (
              mensajes.map((msg, index) => {
                const isMe = msg.senderId === senderId;
                return (
                  <motion.div
                    initial={{ opacity: 0, x: isMe ? 20 : -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={msg.id || index}
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[80%] space-y-1`}>
                      <div className={`p-3 rounded-2xl text-sm ${
                        isMe 
                          ? 'bg-blue-600 text-white rounded-tr-none' 
                          : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none shadow-sm'
                      }`}>
                        {msg.text}
                      </div>
                      <div className={`flex items-center gap-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        {msg.isAdmin && !isMe && <ShieldCheck size={10} className="text-blue-500" />}
                        <p className={`text-[8px] font-bold uppercase tracking-tighter text-slate-400`}>
                          {msg.timestamp?.toDate ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '...'}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* Input Area */}
          <form 
            onSubmit={handleSend}
            className="p-4 bg-white border-t border-slate-100 flex gap-2"
          >
            <input
              type="text"
              value={nuevoMensaje}
              onChange={(e) => setNuevoMensaje(e.target.value)}
              placeholder="Escribe tu mensaje..."
              className="flex-1 bg-slate-50 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            />
            <button
              type="submit"
              disabled={!nuevoMensaje.trim()}
              className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 disabled:shadow-none"
            >
              <Send size={20} />
            </button>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
