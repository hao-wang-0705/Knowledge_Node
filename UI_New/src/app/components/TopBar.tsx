import {
  ChevronLeft,
  ChevronRight,
  Plus,
  HelpCircle,
  Keyboard,
  Database,
  User,
} from "lucide-react";

export function TopBar() {
  return (
    <div className="flex items-center justify-between px-4 h-[44px] w-full select-none text-[#666] bg-[#f9f9f9] flex-shrink-0 relative z-10">
      {/* Left side: Mac Controls & Arrows */}
      <div className="flex items-center">
        {/* Mac Controls */}
        <div className="flex items-center space-x-2 w-16 group mr-4">
          <div className="w-3 h-3 rounded-full bg-[#ff5f56] border border-black/10 flex items-center justify-center relative overflow-hidden" />
          <div className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-black/10 flex items-center justify-center relative overflow-hidden" />
          <div className="w-3 h-3 rounded-full bg-[#27c93f] border border-black/10 flex items-center justify-center relative overflow-hidden" />
        </div>
        
        <div className="flex items-center space-x-3">
          
          
          {/* Tab */}
          
          
          <button className="flex items-center justify-center w-[26px] h-[26px] hover:bg-black/5 rounded-md text-[#888] hover:text-[#333] transition-colors ml-1">
            
          </button>
        </div>
      </div>

      {/* Right side icons */}
      <div className="flex items-center space-x-4 text-xs">
        <button className="hover:text-[#111] transition-colors text-[#666]">
          <HelpCircle className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <button className="hover:text-[#111] transition-colors text-[#666]">
          <Keyboard className="w-4 h-4" strokeWidth={1.5} />
        </button>
        <button className="flex items-center space-x-1.5 hover:text-[#111] transition-colors text-[#666]">
          <Database className="w-4 h-4" strokeWidth={1.5} />
          <span className="font-medium text-[13px]">499</span>
        </button>
        <button className="hover:text-[#111] transition-colors text-[#666] ml-1">
          <User className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}
