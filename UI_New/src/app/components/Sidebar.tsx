import {
  CalendarDays,
  Hash,
  History,
  Sparkles,
  Search,
  Plus,
} from "lucide-react";

const navItems = [
  { icon: CalendarDays, label: "今日笔记", active: true },
  { icon: Hash, label: "超级标签" },
  { icon: History, label: "历史笔记" },
  { icon: Sparkles, label: "AI chats" },
];

const pinnedItems = [
  { label: "Idea", color: "text-green-500" },
  { label: "Question", color: "text-purple-500" },
  { label: "To discuss", color: "text-purple-500" },
  { label: "Weekly reflection", color: "text-yellow-500" },
  { label: "Meeting", color: "text-blue-500" },
  { label: "Memo", color: "text-yellow-500" },
];

export function Sidebar() {
  return (
    <div className="w-[240px] flex-shrink-0 flex flex-col h-full bg-[#f9f9f9] text-[#666] text-sm overflow-y-auto custom-scrollbar border-r border-gray-200/50">
      {/* Top Nav */}
      <div className="px-3 py-2 space-y-0.5 mt-2">
        {navItems.map((item) => (
          <div
            key={item.label}
            className={`flex items-center space-x-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
              item.active
                ? "bg-black/5 text-[#111] font-medium"
                : "hover:bg-black/5 hover:text-[#111]"
            }`}
          >
            <item.icon className="w-[15px] h-[15px]" strokeWidth={2} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      {/* Create New */}
      <div className="px-3 mt-4">
        <div className="flex items-center justify-between px-2.5 py-1.5 bg-white border border-gray-200 rounded-md text-[#666] shadow-sm hover:border-gray-300 hover:text-[#111] cursor-pointer transition-all">
          <div className="flex items-center space-x-2">
            <Search className="w-3.5 h-3.5" />
            <span className="text-[13px]">新建笔记</span>
          </div>
        </div>
      </div>

      {/* Pinned */}
      <div className="px-3 mt-8">
        <h3 className="px-2 text-xs font-semibold text-[#888] mb-2 uppercase tracking-wider">聚焦</h3>
        <div className="space-y-0.5">
          {pinnedItems.map((item, index) => (
            <div
              key={index}
              className="flex items-center space-x-2 px-2 py-1 rounded-md cursor-pointer hover:bg-black/5 hover:text-[#111] transition-colors text-[#666]"
            >
              <Hash className={`w-3.5 h-3.5 ${item.color}`} strokeWidth={3} />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Workspace / Profile */}
      <div className="px-3 mt-8 mb-4">
        <div className="flex items-center justify-between px-2 py-1.5 cursor-pointer hover:bg-black/5 rounded-md transition-colors group">
          <div className="flex items-center space-x-2">
            <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-green-400 to-blue-500 overflow-hidden flex items-center justify-center">
               <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=64&h=64" className="w-full h-full object-cover opacity-80 mix-blend-overlay" />
            </div>
            <span className="text-[13px] font-medium text-[#333] group-hover:text-[#111]">HAO WANG</span>
          </div>
          <Plus className="w-3.5 h-3.5 text-[#888] opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <div className="space-y-0.5 mt-1 ml-1">
          <div className="px-2 py-1 text-[13px] text-[#666] hover:text-[#111] hover:bg-black/5 rounded-md cursor-pointer transition-colors">
            Daily notes
          </div>
          <div className="px-2 py-1 text-[13px] text-[#666] hover:text-[#111] hover:bg-black/5 rounded-md cursor-pointer transition-colors">
            个人旅行笔记
          </div>
          
        </div>
      </div>
    </div>
  );
}
