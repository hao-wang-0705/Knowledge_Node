import {
  Hash,
  Plus,
} from "lucide-react";

export function OpenTasks() {
  const tasks = [
    { id: "1231231231", color: "pink" },
    { id: "12312312", color: "pink" },
  ];

  return (
    <div className="w-full bg-white rounded-[10px] border border-gray-200 p-[14px] shadow-[0_2px_12px_rgba(0,0,0,0.04)] select-none">
      <div className="flex items-center justify-between mb-[12px]">
        <h3 className="text-[13px] font-bold text-[#111]">Open tasks</h3>
        <button className="flex items-center justify-center w-[22px] h-[22px] rounded hover:bg-gray-100 text-[#888] hover:text-[#111] transition-colors cursor-pointer" title="Add new task">
          <Plus className="w-4 h-4" strokeWidth={2} />
        </button>
      </div>
      <div className="space-y-[10px]">
        {tasks.map((task, index) => (
          <div key={index} className="flex items-center space-x-[10px] group">
            {/* The pink target-like icon */}
            <div className="flex items-center justify-center w-[18px] h-[18px] rounded-full border-[2px] border-[#db2777] opacity-90 group-hover:opacity-100 transition-opacity">
               <div className="w-[6px] h-[6px] rounded-full bg-[#db2777]" />
            </div>
            
            {/* The gray checkbox square */}
            <div className="w-[14px] h-[14px] rounded-[3px] bg-white border border-gray-300 group-hover:border-gray-500 transition-colors cursor-pointer flex-shrink-0">
            </div>
            
            <span className="text-[13px] text-[#333] font-medium tracking-tight">
              {task.id}
            </span>
            
            {/* The pink hash tag */}
            <div className="flex items-center justify-center bg-pink-50 text-pink-500 border border-pink-100 w-[16px] h-[16px] rounded-[3px] ml-1">
              <Hash className="w-3 h-3" strokeWidth={3} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
