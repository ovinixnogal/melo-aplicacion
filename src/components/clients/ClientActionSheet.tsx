import React, { useState, useRef } from 'react';
import { 
  Phone, 
  Eye, 
  Edit2, 
  Trash2, 
  X,
  User
} from 'lucide-react';
import type { Client } from '../../hooks/useClients';

interface ClientActionSheetProps {
  isOpen: boolean;
  onClose: () => void;
  client: Client | null;
  onView: (client: Client) => void;
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
}

const ClientActionSheet: React.FC<ClientActionSheetProps> = ({
  isOpen,
  onClose,
  client,
  onView,
  onEdit,
  onDelete
}) => {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [translateY, setTranslateY] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  if (!client) return null;

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  };

  // GESTOS TÁCTILES: Swipe to Close
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const currentTouch = e.targetTouches[0].clientY;
    const diff = currentTouch - touchStart;
    
    // Solo permitir deslizar hacia abajo
    if (diff > 0) {
      setTranslateY(diff);
    }
  };

  const handleTouchEnd = () => {
    // Si se deslizó más de 100px, cerrar. Si no, resetear posición.
    if (translateY > 100) {
      onClose();
    }
    setTranslateY(0);
    setTouchStart(null);
  };

  return (
    <div className={`
      fixed inset-0 z-[110] transition-opacity duration-300 flex items-end md:items-center justify-center
      ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
    `}>
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-[#1A1A1A]/80 backdrop-blur-sm" 
        onClick={onClose}
      />

      {/* Sheet Content / Modal Content */}
      <div 
        ref={sheetRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ 
          transform: isOpen 
            ? (window.innerWidth < 768 ? `translateY(${translateY}px)` : 'scale(1)') 
            : (window.innerWidth < 768 ? 'translateY(100%)' : 'scale(0.95)'),
          transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
        className="absolute bottom-0 md:relative md:bottom-auto left-0 right-0 md:left-auto md:right-auto w-full md:max-w-md bg-white rounded-t-[40px] md:rounded-[48px] p-8 pb-12 md:pb-10 space-y-4 shadow-[0_-20px_60px_-15px_rgba(0,0,0,0.15)] md:shadow-2xl"
      >
         {/* Drawer Handle - Visual cue for swiping */}
         <div className="w-12 h-1.5 bg-gray-100 rounded-full mx-auto mb-8 active:scale-x-125 transition-transform"></div>

         {/* Client Brief */}
         <div className="flex items-center gap-4 mb-8 pb-6 border-b border-gray-50">
            <div className="w-14 h-14 bg-[#1A1A1A] text-[#E2FF3B] rounded-2xl flex items-center justify-center font-black text-lg shadow-xl">
               {getInitials(client.name)}
            </div>
            <div className="flex-1 min-w-0">
               <h3 className="text-xl font-black italic uppercase leading-none truncate text-[#1A1A1A]">{client.name}</h3>
               <p className="text-[10px] font-black text-gray-400 tracking-[0.2em] mt-2 uppercase flex items-center gap-2">
                 <User size={12} className="text-[#E2FF3B]" /> Gestión de Cliente
               </p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 text-gray-300 hover:text-gray-500"
            >
              <X size={20} />
            </button>
         </div>

         {/* Action Buttons */}
         <div className="grid grid-cols-1 gap-3">
            <a 
              href={`tel:${client.phone}`}
              className="flex items-center gap-4 w-full p-5 bg-emerald-50 text-emerald-700 rounded-[24px] font-black text-xs uppercase tracking-widest active:scale-[0.98] transition-all"
            >
              <div className="p-2.5 bg-emerald-100 rounded-xl"><Phone size={20} /></div> 
              Llamar Cliente
            </a>
            
            <button 
              onClick={() => onView(client)}
              className="flex items-center gap-4 w-full p-5 bg-indigo-50 text-indigo-700 rounded-[24px] font-black text-xs uppercase tracking-widest active:scale-[0.98] transition-all"
            >
              <div className="p-2.5 bg-indigo-100 rounded-xl"><Eye size={20} /></div> 
              Ver Detalles
            </button>

            <button 
              onClick={() => onEdit(client)}
              className="flex items-center gap-4 w-full p-5 bg-gray-50 text-gray-600 rounded-[24px] font-black text-xs uppercase tracking-widest active:scale-[0.98] transition-all"
            >
              <div className="p-2.5 bg-gray-200/50 rounded-xl"><Edit2 size={20} /></div> 
              Editar Ficha
            </button>

            <button 
              onClick={() => onDelete(client)}
              className="flex items-center gap-4 w-full p-5 bg-rose-50 text-rose-600 rounded-[24px] font-black text-xs uppercase tracking-widest active:scale-[0.98] transition-all"
            >
              <div className="p-2.5 bg-rose-100 rounded-xl"><Trash2 size={20} /></div> 
              Eliminar Cliente
            </button>
         </div>

         <button 
          onClick={onClose} 
          className="w-full pt-4 py-2 text-[10px] font-black uppercase text-gray-400 tracking-[0.5em]"
         >
           Cancelar
         </button>
      </div>
    </div>
  );
};

export default ClientActionSheet;
