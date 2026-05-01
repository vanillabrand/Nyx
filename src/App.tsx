import React from 'react';
import { GlobeScene } from './components/GlobeScene';
import { DashboardPanel } from './components/DashboardPanel';
import { Plane, AlertTriangle, Search, Activity, Wind, Database } from 'lucide-react';

function App() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 text-slate-200">
      {/* Background Globe */}
      <div className="absolute inset-0 z-0">
        <GlobeScene />
      </div>

      {/* Overlays */}
      <div className="absolute inset-0 pointer-events-none z-10">
        <div className="scanline" />
      </div>

      {/* Navigation / Header */}
      <header className="absolute top-0 left-0 right-0 p-4 z-20 flex justify-between items-center bg-gradient-to-b from-slate-950/80 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-cyan-500 rounded-sm flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.3)]">
            <Plane className="text-slate-950 w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tighter glow-cyan italic">FIE // FLIGHT INTELLIGENCE ENGINE</h1>
            <p className="text-[10px] font-mono text-cyan-500/70 tracking-[0.2em]">VERSION 1.0.4-BETA // WORLDWIDE SURVEILLANCE</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-mono text-slate-500 uppercase">System Status</span>
            <span className="text-xs font-bold text-green-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              OPERATIONAL
            </span>
          </div>
          <div className="flex flex-col items-end border-l border-slate-800 pl-6">
            <span className="text-[10px] font-mono text-slate-500 uppercase">Live Connections</span>
            <span className="text-xs font-bold text-cyan-400">14,292 FLIGHTS</span>
          </div>
        </div>
      </header>

      {/* Draggable Panels Container */}
      <main className="absolute inset-0 p-6 pt-24 z-20 pointer-events-none">
        <div className="relative w-full h-full pointer-events-auto">
          
          {/* Natural Language Query Panel */}
          <DashboardPanel 
            title="Intelligence Query (NLQ)" 
            icon={<Search className="w-3 h-3 text-cyan-400" />}
            className="absolute top-0 left-0 w-[450px]"
          >
            <div className="space-y-4">
              <div className="relative">
                <textarea 
                  className="w-full bg-slate-900/50 border border-slate-700/50 rounded p-3 text-sm font-mono placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors"
                  placeholder="Ask a flight intelligence question..."
                  rows={3}
                />
                <div className="absolute bottom-2 right-2 flex gap-2">
                  <button className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-[10px] font-bold py-1 px-3 rounded border border-cyan-500/30 transition-all uppercase tracking-wider">
                    Analyse
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                <Activity className="w-3 h-3" />
                <span>WebLLM: Gemma-2b-it (Local) // Ready</span>
              </div>
            </div>
          </DashboardPanel>

          {/* Real-time Alerts Panel */}
          <DashboardPanel 
            title="Live Incident Feed" 
            icon={<AlertTriangle className="w-3 h-3 text-red-400" />}
            className="absolute bottom-10 left-0 w-[400px]"
          >
            <div className="space-y-3">
              {[
                { type: 'SEVERE', text: 'Boeing 737-800 // Engine Failure // EDDF', time: '2m ago' },
                { type: 'WARNING', text: 'Airbus A321 // Bird Strike // KJFK', time: '14m ago' },
                { type: 'INFO', text: 'Pattern Detected: Unstable approach trends at VHHH', time: '45m ago' },
              ].map((alert, i) => (
                <div key={i} className={`p-2 border-l-2 flex justify-between items-start ${
                  alert.type === 'SEVERE' ? 'border-red-500 bg-red-500/5' : 
                  alert.type === 'WARNING' ? 'border-amber-500 bg-amber-500/5' : 'border-cyan-500 bg-cyan-500/5'
                }`}>
                  <div>
                    <span className={`text-[9px] font-bold uppercase tracking-wider ${
                      alert.type === 'SEVERE' ? 'text-red-400' : 
                      alert.type === 'WARNING' ? 'text-amber-400' : 'text-cyan-400'
                    }`}>{alert.type}</span>
                    <p className="text-xs text-slate-300 mt-0.5">{alert.text}</p>
                  </div>
                  <span className="text-[10px] font-mono text-slate-600">{alert.time}</span>
                </div>
              ))}
            </div>
          </DashboardPanel>

          {/* Metrics / Readouts */}
          <DashboardPanel 
            title="Fleet Telemetry" 
            icon={<Activity className="w-3 h-3 text-green-400" />}
            className="absolute top-0 right-0 w-[300px]"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-500 uppercase font-mono">Avg Altitude</span>
                <span className="text-xl font-bold text-slate-200">34,200<span className="text-[10px] ml-1 text-slate-500">FT</span></span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-500 uppercase font-mono">Avg Speed</span>
                <span className="text-xl font-bold text-slate-200">462<span className="text-[10px] ml-1 text-slate-500">KTS</span></span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-500 uppercase font-mono">Anomaly Score</span>
                <span className="text-xl font-bold text-amber-400">0.14</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-500 uppercase font-mono">Risk Index</span>
                <span className="text-xl font-bold text-green-400">LOW</span>
              </div>
            </div>
          </DashboardPanel>

          {/* Database Info */}
          <div className="absolute bottom-10 right-0 flex gap-4">
            <div className="glass-panel p-2 flex items-center gap-3 px-4">
              <Database className="w-4 h-4 text-cyan-500" />
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-500 uppercase font-mono">Neo4j Nodes</span>
                <span className="text-xs font-bold font-mono">1.2M ENTITIES</span>
              </div>
            </div>
            <div className="glass-panel p-2 flex items-center gap-3 px-4 border-cyan-500/30">
              <Wind className="w-4 h-4 text-cyan-500" />
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-500 uppercase font-mono">Active Analysis</span>
                <span className="text-xs font-bold font-mono">PATTERN MATCHING...</span>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Footer / Status Bar */}
      <footer className="absolute bottom-0 left-0 right-0 h-6 bg-slate-900/80 border-t border-slate-800 flex items-center justify-between px-4 z-30">
        <div className="flex items-center gap-4 text-[9px] font-mono text-slate-500">
          <span>LAT: 51.5074</span>
          <span>LNG: -0.1278</span>
          <span>UTC: {new Date().toISOString()}</span>
        </div>
        <div className="flex items-center gap-4 text-[9px] font-mono text-cyan-500/50">
          <span>SOURCE: ADS-B EXCHANGE + ASN + AVH</span>
          <span className="text-slate-700">|</span>
          <span>SECURE_ENCRYPTION: AES-256</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
