import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { MainContent } from "./components/MainContent";

export default function App() {
  return (
    <div className="flex flex-col h-screen w-full bg-[#f9f9f9] overflow-hidden text-sm font-sans selection:bg-blue-200 selection:text-black">
      {/* Top Bar spanning full width */}
      <TopBar />
      
      {/* Lower section with Sidebar and Main Content */}
      <div className="flex flex-1 overflow-hidden relative z-0">
        <Sidebar />
        <MainContent />
      </div>
    </div>
  );
}
