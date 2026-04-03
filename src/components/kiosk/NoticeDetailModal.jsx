import { Bell, User, Calendar, FileText, X } from "lucide-react";

export default function NoticeDetailModal({ notice, onClose }) {
  if (!notice) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-backdrop">
      <div className="bg-bg-primary rounded-2xl shadow-2xl max-w-2xl w-full relative border border-border-subtle animate-zoom-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-text-tertiary hover:text-text-primary hover:bg-bg-secondary rounded-lg p-2 transition-all z-10"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Modal Header/Top section: Author and Date */}
        <div className="p-10 pb-0">
          <div className="flex items-center justify-between mb-8 pr-12">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-accent/10 rounded-2xl flex items-center justify-center ring-1 ring-accent/20">
                <User className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-accent uppercase tracking-widest leading-none mb-1.5">Autor</p>
                <p className="text-base font-bold text-text-primary">{notice.author}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest leading-none mb-1.5">Fecha y Hora</p>
              <p className="text-sm font-medium text-text-secondary">{notice.date} • {notice.time}</p>
            </div>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-border-subtle to-transparent mb-8 opacity-50" />

          {/* Title section */}
          <div className="mb-6 w-full overflow-hidden">
            <h3 className="text-3xl font-black text-text-primary leading-tight tracking-tight break-words">
              {notice.subject}
            </h3>
          </div>

          {/* Body/Detail section */}
          <div className="bg-bg-secondary/40 rounded-2xl p-8 border border-border-subtle/50 mb-8 w-full overflow-hidden">
            <p className="text-text-primary leading-relaxed whitespace-pre-wrap text-lg opacity-90 text-justify break-words">
              {notice.detail}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}