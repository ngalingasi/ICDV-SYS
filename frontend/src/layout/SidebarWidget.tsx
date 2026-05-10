export default function SidebarWidget() {
  return (
    <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100 dark:border-gray-800">
      <div className="flex items-center gap-3">
        <img src="/logo-64.png" alt="TPFCS" className="w-8 h-8 object-contain flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">TPFCS</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 truncate">Project Management</p>
        </div>
      </div>
    </div>
  );
}
