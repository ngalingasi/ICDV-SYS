import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { useSidebar } from "../context/SidebarContext";
import { useAuth }    from "../store/authStore";

const BoltIcon = () => (
  <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

const Icon = {
  Dashboard: () => <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  Vessel:    () => <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4M17 8v8m0 4l4-4m-4 4l-4-4M3 20h18" /></svg>,
  Manifest:  () => <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  Vehicle:   () => <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="1" y="8" width="22" height="10" rx="2" strokeLinecap="round" strokeLinejoin="round"/><path strokeLinecap="round" strokeLinejoin="round" d="M5 8V6a2 2 0 012-2h10a2 2 0 012 2v2M7 18v2m10-2v2"/><circle cx="7" cy="17" r="1.5" fill="currentColor"/><circle cx="17" cy="17" r="1.5" fill="currentColor"/></svg>,
  Driver:    () => <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  Operation: () => <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>,
  Delivery:  () => <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>,
  Users:     () => <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  Lookups:   () => <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>,
  Profile:   () => <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  Icdv:      () => <svg className="w-[18px] h-[18px] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  Chevron:   ({ open }: { open: boolean }) => <svg className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>,
};

type SubItem = { name: string; path: string };
type NavItem = { name: string; icon: React.ReactNode; path?: string; subItems?: SubItem[] };

const TENANT_NAV: NavItem[] = [
  { name: "Dashboard", icon: <Icon.Dashboard />, path: "/" },
  {
    name: "Vessels", icon: <Icon.Vessel />, subItems: [
      { name: "All Vessels", path: "/vessels" },
      { name: "Add Vessel",  path: "/vessels/new" },
    ],
  },
  {
    name: "Manifests", icon: <Icon.Manifest />, subItems: [
      { name: "All Manifests", path: "/manifests" },
      { name: "New Manifest",  path: "/manifests/new" },
    ],
  },
  {
    name: "Vehicles", icon: <Icon.Vehicle />, subItems: [
      { name: "All Vehicles", path: "/vehicles" },
      { name: "Search",       path: "/vehicles/search" },
    ],
  },
  {
    name: "Drivers", icon: <Icon.Driver />, subItems: [
      { name: "All Drivers", path: "/drivers" },
      { name: "Add Driver",  path: "/drivers/new" },
    ],
  },
  {
    name: "Operations", icon: <Icon.Operation />, subItems: [
      { name: "1. Discharge",    path: "/operations/discharge" },
      { name: "2. Batch",        path: "/operations/batch" },
      { name: "3. Fuel",          path: "/operations/fuel" },
      { name: "4. TPA Transfer", path: "/operations/transfer" },
      { name: "5. Yard Receive", path: "/operations/receive" },
      { name: "Batches",         path: "/operations/batches" },
      { name: "Chassis Search",  path: "/operations/search" },
    ],
  },
];

// discharge_officer — getVessels, getManifests, getVehicles, getDrivers, dischargeVehicles
const DISCHARGE_OFFICER_NAV: NavItem[] = [
  { name: "Dashboard",  icon: <Icon.Dashboard />, path: "/" },
  { name: "Vessels",    icon: <Icon.Vessel />,    path: "/vessels" },
  { name: "Manifests",  icon: <Icon.Manifest />,  path: "/manifests" },
  { name: "Vehicles",   icon: <Icon.Vehicle />,   path: "/vehicles" },
  { name: "Drivers",    icon: <Icon.Driver />,    path: "/drivers" },
  {
    name: "Operations", icon: <Icon.Operation />, subItems: [
      { name: "1. Discharge",   path: "/operations/discharge" },
      { name: "2. Batch",       path: "/operations/batch" },
      { name: "Batches",        path: "/operations/batches" },
      { name: "Chassis Search", path: "/operations/search" },
    ],
  },
];

// backoffice_officer — getVessels, getManifests, getVehicles, getDrivers, getOperations
//                      updateOperations, updateBatchStatus, printBatches, printDeliverySheet
const BACKOFFICE_OFFICER_NAV: NavItem[] = [
  { name: "Dashboard",  icon: <Icon.Dashboard />, path: "/" },
  { name: "Vessels",    icon: <Icon.Vessel />,    path: "/vessels" },
  { name: "Manifests",  icon: <Icon.Manifest />,  path: "/manifests" },
  { name: "Vehicles",   icon: <Icon.Vehicle />,   path: "/vehicles" },
  { name: "Drivers",    icon: <Icon.Driver />,    path: "/drivers" },
  {
    name: "Operations", icon: <Icon.Operation />, subItems: [
      { name: "Batches",        path: "/operations/batches" },
      { name: "Chassis Search", path: "/operations/search" },
    ],
  },
];

// transfer_officer — getVehicles, getDrivers, transferVehicles, viewTpaStats
const TRANSFER_OFFICER_NAV: NavItem[] = [
  { name: "Dashboard", icon: <Icon.Dashboard />, path: "/" },
  { name: "Vehicles",  icon: <Icon.Vehicle />,   path: "/vehicles" },
  { name: "Drivers",   icon: <Icon.Driver />,    path: "/drivers" },
  {
    name: "Operations", icon: <Icon.Operation />, subItems: [
      { name: "3. TPA Transfer", path: "/operations/transfer" },
      { name: "Chassis Search",  path: "/operations/search" },
    ],
  },
];

// yard_officer — getVehicles, getManifests, getDrivers, receiveVehicles, printDeliverySheet
const YARD_OFFICER_NAV: NavItem[] = [
  { name: "Dashboard", icon: <Icon.Dashboard />, path: "/" },
  { name: "Vehicles",  icon: <Icon.Vehicle />,   path: "/vehicles" },
  { name: "Manifests", icon: <Icon.Manifest />,  path: "/manifests" },
  { name: "Drivers",   icon: <Icon.Driver />,    path: "/drivers" },
  {
    name: "Operations", icon: <Icon.Operation />, subItems: [
      { name: "4. Yard Receive", path: "/operations/receive" },
      { name: "Chassis Search",  path: "/operations/search" },
    ],
  },
];

const TENANT_BOTTOM_NAV: NavItem[] = [
  { name: "Users",   icon: <Icon.Users />,   path: "/users" },
  { name: "Lookups", icon: <Icon.Lookups />, path: "/lookups" },
  { name: "Profile", icon: <Icon.Profile />, path: "/profile" },
];

const SUPER_ADMIN_NAV: NavItem[] = [
  { name: "Dashboard",    icon: <Icon.Dashboard />, path: "/" },
  { name: "ICDVs",        icon: <Icon.Icdv />,      path: "/super-admin/icdvs" },
  { name: "All Vessels",  icon: <Icon.Vessel />,    path: "/vessels" },
  { name: "All Manifests",icon: <Icon.Manifest />,  path: "/manifests" },
  { name: "All Vehicles", icon: <Icon.Vehicle />,   path: "/vehicles" },
  {
    name: "Drivers", icon: <Icon.Driver />, subItems: [
      { name: "All Drivers", path: "/drivers" },
      { name: "Add Driver",  path: "/drivers/new" },
    ],
  },
  {
    name: "Operations", icon: <Icon.Operation />, subItems: [
      { name: "1. Discharge",    path: "/operations/discharge" },
      { name: "2. Batch",        path: "/operations/batch" },
      { name: "3. Fuel",          path: "/operations/fuel" },
      { name: "4. TPA Transfer", path: "/operations/transfer" },
      { name: "5. Yard Receive", path: "/operations/receive" },
      { name: "Batches",         path: "/operations/batches" },
      { name: "Chassis Search",  path: "/operations/search" },
    ],
  },
];

const SUPER_ADMIN_BOTTOM_NAV: NavItem[] = [
  { name: "Users",   icon: <Icon.Users />,   path: "/users" },
  { name: "Lookups", icon: <Icon.Lookups />, path: "/lookups" },
  { name: "Profile", icon: <Icon.Profile />, path: "/profile" },
];


// fuel_officer — can create orders + dispense fuel
const fuelOfficerNav = [
  { name: "Manifests",  icon: <Icon.Manifest />,  path: "/manifests" },
  {
    name: "Operations", icon: <Icon.Operation />, subItems: [
      { name: "Fuel Dispense", path: "/operations/fuel" },
    ],
  },
];

export default function AppSidebar() {
  const { isOpen, isExpanded, isMobileOpen, toggleMobileSidebar } = useSidebar();
  const { isSuperAdmin, isSystemAdmin, isDischargeOfficer, isBackofficeOfficer, isTransferOfficer, isYardOfficer, isFuelOfficer, icdvName, user } = useAuth();
  const isCrossTenant = isSuperAdmin || (isSystemAdmin ?? false);
  const location = useLocation();
  const expanded = isOpen || isExpanded || isMobileOpen;

  // Pick nav based on role (most-specific first)
  let NAV: NavItem[];
  let BOTTOM_NAV: NavItem[];
  if (isCrossTenant) {
    NAV        = SUPER_ADMIN_NAV;
    BOTTOM_NAV = SUPER_ADMIN_BOTTOM_NAV;
  } else if (isDischargeOfficer) {
    NAV        = DISCHARGE_OFFICER_NAV;
    BOTTOM_NAV = [{ name: "Profile", icon: <Icon.Profile />, path: "/profile" }];
  } else if (isBackofficeOfficer) {
    NAV        = BACKOFFICE_OFFICER_NAV;
    BOTTOM_NAV = [{ name: "Profile", icon: <Icon.Profile />, path: "/profile" }];
  } else if (isTransferOfficer) {
    NAV        = TRANSFER_OFFICER_NAV;
    BOTTOM_NAV = [{ name: "Profile", icon: <Icon.Profile />, path: "/profile" }];
  } else if (isYardOfficer) {
    NAV        = YARD_OFFICER_NAV;
    BOTTOM_NAV = [{ name: "Profile", icon: <Icon.Profile />, path: "/profile" }];
  } else if (isFuelOfficer) {
    NAV        = fuelOfficerNav;
    BOTTOM_NAV = [{ name: "Profile", icon: <Icon.Profile />, path: "/profile" }];
  } else {
    NAV        = TENANT_NAV;
    BOTTOM_NAV = TENANT_BOTTOM_NAV;
  }

  const topLabel    = isCrossTenant ? "ICDV System" : (icdvName ?? "ICDV System");
  const topSubLabel = isSuperAdmin        ? "Platform Admin"
    : isSystemAdmin       ? "System Operations"
    : isDischargeOfficer  ? "Discharge Officer"
    : isBackofficeOfficer ? "Backoffice Officer"
    : isTransferOfficer   ? "Transfer Officer"
    : isYardOfficer       ? "Yard Officer"
    : isFuelOfficer       ? "Fuel Officer"
    : user?.role === 'admin'      ? "Administrator"
    : user?.role === 'supervisor' ? "Supervisor"
    : "Vehicle Import & Delivery";

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const current = location.pathname;
    NAV.forEach(item => {
      if (item.subItems?.some(s => current.startsWith(s.path))) {
        setOpenGroups(g => ({ ...g, [item.name]: true }));
      }
    });
  }, [location.pathname]); // eslint-disable-line

  const toggleGroup = (name: string) => setOpenGroups(g => ({ ...g, [name]: !g[name] }));

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const linkCls = (active: boolean) =>
    `flex items-center gap-3 w-full px-3 py-2 rounded-lg text-[13px] transition-colors ${
      expanded ? "" : "justify-center px-0"
    } ${
      active
        ? "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 font-medium"
        : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-gray-200"
    }`;

  const renderItem = (item: NavItem) => {
    if (item.subItems) {
      const anyActive = item.subItems.some(s => isActive(s.path));
      const open = openGroups[item.name] ?? anyActive;
      return (
        <li key={item.name}>
          <button onClick={() => toggleGroup(item.name)} className={`w-full ${linkCls(anyActive)}`}>
            {item.icon}
            {expanded && <><span className="flex-1 text-left">{item.name}</span><Icon.Chevron open={open} /></>}
          </button>
          {expanded && open && (
            <ul className="mt-1 ml-7 space-y-0.5 border-l border-gray-200 dark:border-gray-700 pl-3">
              {item.subItems.map(s => (
                <li key={s.path}>
                  <Link to={s.path}
                    onClick={() => { if (isMobileOpen) toggleMobileSidebar(); }}
                    className={`block px-2 py-1.5 rounded text-xs transition-colors ${
                    isActive(s.path)
                      ? "text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-500/10 font-medium"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}>{s.name}</Link>
                </li>
              ))}
            </ul>
          )}
        </li>
      );
    }
    return (
      <li key={item.name}>
        <Link to={item.path!}
          onClick={() => { if (isMobileOpen) toggleMobileSidebar(); }}
          className={linkCls(isActive(item.path!))}>
          {item.icon}
          {expanded && <span>{item.name}</span>}
        </Link>
      </li>
    );
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">

      {/* Brand / Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-gray-200 dark:border-gray-700 ${expanded ? "justify-start" : "justify-center"}`}>
        <img
          src="/images/logo/logo.png"
          alt="Logo"
          className="h-8 w-8 rounded object-contain flex-shrink-0"
        />
        {expanded && (
          <div className="overflow-hidden min-w-0">
            <p className="text-[13px] font-bold text-gray-800 dark:text-white leading-tight truncate" title={topLabel}>
              {topLabel}
            </p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
              {topSubLabel}
            </p>
          </div>
        )}
      </div>

      {/* Super admin badge — SVG bolt icon instead of emoji */}
      {expanded && isCrossTenant && (
        <div className="px-3 pt-2">
          <div className="px-3 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-500/10 text-xs font-bold text-purple-600 dark:text-purple-400 flex items-center justify-center gap-1.5">
            <BoltIcon />
            Super Admin
          </div>
        </div>
      )}

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-0.5">
          {NAV.map(renderItem)}
        </ul>
      </nav>

      {/* Bottom nav */}
      <div className="px-3 py-3 border-t border-gray-200 dark:border-gray-700">
        <ul className="space-y-0.5">
          {BOTTOM_NAV.map(renderItem)}
        </ul>
      </div>

    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className={`hidden lg:flex flex-col fixed inset-y-0 left-0 z-40 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ${expanded ? "w-64" : "w-[72px]"}`}>
        {sidebarContent}
      </aside>

      {/* Mobile */}
      {isMobileOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={toggleMobileSidebar} />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col lg:hidden">
            {sidebarContent}
          </aside>
        </>
      )}
    </>
  );
}
