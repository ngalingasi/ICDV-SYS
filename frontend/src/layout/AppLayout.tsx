import { SidebarProvider, useSidebar } from "../context/SidebarContext";
import { Outlet } from "react-router";
import AppHeader from "./AppHeader";
import Backdrop from "./Backdrop";
import AppSidebar from "./AppSidebar";

const LayoutContent: React.FC = () => {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();

  return (
    <div className="min-h-screen xl:flex">
      <AppSidebar />
      <Backdrop />
      {/* Main content — offset matches sidebar width exactly */}
      <div
        className={`flex-1 transition-all duration-300 ease-in-out ${
          isExpanded || isHovered ? "xl:ml-[260px]" : "xl:ml-[68px]"
        } ${isMobileOpen ? "ml-0" : ""}`}
      >
        <AppHeader />
        {/* Centered, max-width constrained content area */}
        <main className="px-4 py-5 md:px-6 md:py-6 pb-20 w-full max-w-screen-xl mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

const AppLayout: React.FC = () => (
  <SidebarProvider>
    <LayoutContent />
  </SidebarProvider>
);

export default AppLayout;
