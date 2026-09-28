export default function Loading() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6 font-mono">
      <div className="flex flex-col items-center space-y-4">
        {/* Cyber Spinning Ring with Glow */}
        <div className="w-12 h-12 border-2 border-zinc-800 border-t-cyan-500 rounded-full animate-spin shadow-[0_0_20px_rgba(6,182,212,0.5)]"></div>
        
        {/* Terminal Loading Status */}
        <div className="text-xs text-cyan-400 tracking-widest animate-pulse flex items-center gap-2">
          <span className="inline-block w-2 h-2 bg-cyan-500 rounded-full"></span>
          ESTABLISHING_SECURE_LINK...
        </div>
      </div>
    </div>
  );
}