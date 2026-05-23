export default function StatusDot({ status }) {

  const config = {

    idle:    { color: 'bg-gray-300', animate: false, label: 'idle' },

    running: { color: 'bg-amber-400', animate: true,  label: 'running' },

    done:    { color: 'bg-emerald-500', animate: false, label: 'done' },

    error:   { color: 'bg-red-500', animate: false, label: 'error' },

  }[status] || { color: 'bg-gray-300', animate: false, label: 'idle' };

  return (

    <div className="flex items-center gap-2">

      <span className={`w-2 h-2 rounded-full ${config.color} ${config.animate ? 'animate-pulse' : ''}`} />

      <span className="text-xs text-gray-500 font-mono">{config.label}</span>

    </div>

  );

}
