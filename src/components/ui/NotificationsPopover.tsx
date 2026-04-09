import React, { useState, useRef, useEffect } from 'react';
import { Bell, CheckCircle2, Circle, Clock, DollarSign, X } from 'lucide-react';
import { useNotifications } from '../../hooks/useNotifications';

const NotificationsPopover: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <CheckCircle2 className="text-emerald-500" size={20} />;
      case 'warning': return <Clock className="text-rose-500" size={20} />;
      case 'info': return <DollarSign className="text-indigo-500" size={20} />;
      default: return <Bell className="text-gray-400" size={20} />;
    }
  };

  const formatTime = (time: any) => {
    if (!time) return '';
    try {
      const date = time.toDate ? time.toDate() : new Date(time);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (days > 0) return `Hace ${days} d`;
      if (hours > 0) return `Hace ${hours} h`;
      if (minutes > 0) return `Hace ${minutes} min`;
      return 'Hace un momento';
    } catch {
      return '';
    }
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-3.5 transition-all rounded-2xl md:rounded-none group 
          ${isOpen ? 'text-slate bg-gray-50 md:bg-transparent' : 'text-slate/30 hover:text-slate bg-white md:bg-transparent border md:border-0 border-slate/5 shadow-xl md:shadow-none shadow-slate/5'}`}
      >
        <Bell size={22} className={unreadCount > 0 ? 'animate-wiggle group-hover:rotate-6 transition-transform' : 'group-hover:rotate-6 transition-transform'} />
        
        {unreadCount > 0 && (
          <span className="absolute top-3.5 right-3.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-vanilla shadow-lg"></span>
        )}
      </button>

      {/* RENDER POPOVER */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-4 w-[340px] md:w-[400px] bg-white rounded-[32px] border border-slate/5 shadow-[0_20px_60px_rgba(0,0,0,0.1)] z-50 overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
           {/* Header */}
           <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-vanilla/30">
              <div className="flex items-center gap-3">
                 <h3 className="font-black mt-1 text-slate text-lg uppercase tracking-tight italic leading-none">Notificaciones</h3>
                 {unreadCount > 0 && (
                    <span className="px-2 py-0.5 bg-rose-50 text-rose-500 rounded-lg text-[10px] font-black">{unreadCount} nuevas</span>
                 )}
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2 text-gray-300 hover:text-rose-500 transition-colors rounded-xl hover:bg-white"><X size={18} /></button>
           </div>

           {/* Actions */}
           {unreadCount > 0 && (
             <div className="px-6 py-3 border-b border-gray-50 bg-white flex justify-end">
               <button 
                  onClick={markAllAsRead} 
                  className="text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-slate transition-colors"
               >
                 Marcar todas como leídas
               </button>
             </div>
           )}

           {/* Notifications List */}
           <div className="max-h-[400px] overflow-y-auto w-full smooth-scroll">
              {notifications.length === 0 ? (
                <div className="p-12 flex flex-col items-center justify-center text-center opacity-40">
                   <Bell size={40} className="text-gray-300 mb-4" />
                   <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">Estás al día</p>
                </div>
              ) : (
                <div className="flex flex-col">
                  {notifications.map((notif) => (
                    <div 
                       key={notif.id} 
                       onClick={() => !notif.read && markAsRead(notif.id)}
                       className={`flex gap-4 p-5 border-b border-gray-50 transition-colors max-w-full cursor-pointer hover:bg-gray-50 
                         ${!notif.read ? 'bg-vanilla/10' : 'bg-white opacity-60'}`}
                    >
                       <div className="shrink-0 mt-1">
                         {getIcon(notif.type)}
                       </div>
                       <div className="flex flex-col min-w-0 flex-1">
                          <div className="flex justify-between items-start gap-2">
                             <h4 className={`text-[13px] tracking-tight uppercase truncate ${!notif.read ? 'font-black text-slate italic' : 'font-bold text-gray-500'}`}>
                               {notif.title}
                             </h4>
                             <span className="text-[9px] font-bold text-gray-400 whitespace-nowrap">{formatTime(notif.createdAt)}</span>
                          </div>
                          <p className={`text-[11px] mt-1 leading-relaxed ${!notif.read ? 'font-medium text-gray-600' : 'font-medium text-gray-400'}`}>
                             {notif.message}
                          </p>
                       </div>
                       <div className="shrink-0 w-2 flex justify-center mt-2.5">
                          {!notif.read && <Circle className="text-pear fill-pear animate-pulse" size={8} />}
                       </div>
                    </div>
                  ))}
                </div>
              )}
           </div>
        </div>
      )}
    </div>
  );
};

export default NotificationsPopover;
