import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Sparkles,
  Calendar,
  CalendarDays,
  PanelRightClose,
} from "lucide-react";
import { OpenTasks } from "./OpenTasks";

export function MainContent() {
  return (
    <div className="flex-1 h-full overflow-hidden bg-[#f9f9f9] flex flex-col relative z-0 pl-1 pr-1 pb-1">
      {/* 
        The main card is slightly inset to give the "window" feel. 
      */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 shadow-[0_4px_24px_rgba(0,0,0,0.02)] flex relative overflow-hidden">
        {/* Scrollable area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-10 lg:px-20 xl:px-28 relative text-[#555]">
          
          <div className="flex justify-between items-start w-full gap-8">
            {/* Left Content Area */}
            <div className="flex-1 max-w-[760px]">
              {/* Top Breadcrumb row */}
              <div className="flex items-center text-[#888] text-[13px] mb-8 w-full justify-between">
                <div className="flex items-center space-x-2">
                  <button className="hover:bg-gray-100 p-1 rounded-md transition-colors text-[#888]">
                    <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.5} />
                  </button>
                  
                  <div className="flex items-center space-x-1.5 cursor-pointer hover:bg-gray-100 px-1.5 py-1 rounded-md transition-colors">
                    <div className="w-[18px] h-[18px] rounded-full bg-gradient-to-tr from-green-400 to-blue-500 overflow-hidden flex items-center justify-center">
                      <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=64&h=64" className="w-full h-full object-cover opacity-80 mix-blend-overlay" />
                    </div>
                    <span className="text-[#ccc]">/</span>
                    <span className="text-[#666] hover:text-[#111] transition-colors">Daily notes</span>
                  </div>
                  
                  <span className="text-[#ccc]">/</span>
                  <span className="cursor-pointer hover:text-[#111] transition-colors text-[#666] px-1.5 py-1 hover:bg-gray-100 rounded-md">2026</span>
                  <span className="text-[#ccc]">/</span>
                  <span className="cursor-pointer hover:text-[#111] transition-colors text-[#666] px-1.5 py-1 hover:bg-gray-100 rounded-md">Week 11</span>
                </div>
                
                {/* Tiny right aligned icon in breadcrumb row */}
                <div className="flex items-center text-[#888] cursor-pointer hover:text-[#111] transition-colors">
                  <PanelRightClose className="w-4 h-4" strokeWidth={1.5} />
                </div>
              </div>

              {/* Header */}
              <h1 className="text-[34px] font-bold text-[#111] tracking-tight mb-4">
                Today, Tue, 10 Mar
              </h1>

              {/* Tags and Right Actions Row */}
              <div className="flex items-center justify-between mt-4 mb-4">
                {/* # Day tag */}
                

                {/* Right actions: Sparkles & More */}
                <div className="flex items-center space-x-2">
                  
                  
                </div>
              </div>

              {/* Tools row */}
              <div className="flex items-center space-x-[2px] mb-8">
                <div className="flex items-center bg-white border border-gray-200 rounded-md p-[2px] shadow-sm text-[13px]">
                  <button className="w-7 h-6 flex items-center justify-center hover:bg-gray-100 rounded-[4px] transition-colors">
                    <ChevronLeft className="w-3.5 h-3.5 text-[#888]" strokeWidth={2.5} />
                  </button>
                  <button className="w-7 h-6 flex items-center justify-center hover:bg-gray-100 rounded-[4px] transition-colors">
                    <ChevronRight className="w-3.5 h-3.5 text-[#888]" strokeWidth={2.5} />
                  </button>
                  <div className="w-[1px] h-3 bg-gray-200 mx-1"></div>
                  <button className="px-2.5 h-6 flex items-center justify-center hover:bg-gray-100 rounded-[4px] transition-colors font-medium text-[#333]">
                    Today
                  </button>
                  
                  <button className="w-7 h-6 flex items-center justify-center rounded-[4px] transition-colors bg-blue-50 text-blue-600 relative border border-blue-200 ml-[2px]">
                    <CalendarDays className="w-3.5 h-3.5" strokeWidth={2} />
                  </button>
                </div>
              </div>

              {/* Editor content placeholder */}
              <div className="flex items-start space-x-3 text-[15px] mt-6 group cursor-text">
                {/* Bullet point */}
                <div className="w-[6px] h-[6px] rounded-full bg-gray-300 group-hover:bg-gray-500 transition-colors cursor-pointer mt-2 ml-1 flex-shrink-0"></div>
                <div className="text-[#111] font-medium w-full outline-none leading-relaxed tracking-wide"><span className="font-bold">这是一条新笔记</span></div>
              </div>
            </div>

            {/* Right Widget Area */}
            <div className="w-[320px] hidden lg:block mt-8 flex-shrink-0 relative">
              <OpenTasks />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
