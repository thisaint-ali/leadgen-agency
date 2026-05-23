export default function StatusDot({ status }) {
  const config = {
    idle:    { color: 'bg-slate-300',    animate: false, label: 'idle',    text: 'text-slate-400' },
    running: { color: 'bg-[#F97316]',   animate: true,  label: 'running', text: 'text-[#F97316]' },
    done:    { color: 'bg-emerald-500',  animate: false, label: 'done',    text: 'text-emerald-600' },
    error:   { color: 'bg-red-500',      animate: false, label: 'error',   text: 'text-red-500' },
  }[status] || { color: 'bg-slate-300', animate: false, label: 'idle', text: 'text-slate-400' };

  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${config.color} ${config.animate ? 'animate-pulse' : ''}`} />
      <span className={`text-xs font-medium ${config.text}`}>{config.label}</span>
    </div>
  );
}
