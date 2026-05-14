import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from "react-router";
import { ScrollToTop }   from "./components/common/ScrollToTop";
import { AuthProvider }  from "./context/AuthContext";
import { useAuth }       from "./store/authStore";
import ProtectedRoute    from "./components/tpfcs/ProtectedRoute";
import AppLayout         from "./layout/AppLayout";
import { ToastContainer } from "./components/tpfcs/Toast";

// ── Auth ──────────────────────────────────────────────────────────────────────
import SignIn          from "./pages/AuthPages/SignIn";
import ResetPassword   from "./pages/AuthPages/ResetPassword";
import ChangePassword  from "./pages/AuthPages/ChangePassword";

// ── Dashboard ─────────────────────────────────────────────────────────────────
import IcdvDashboard   from "./pages/Dashboard/IcdvDashboard";

// ── Vessels ───────────────────────────────────────────────────────────────────
import VesselsPage     from "./pages/Vessels/VesselsPage";
import VesselForm      from "./pages/Vessels/VesselForm";
import VesselDetail    from "./pages/Vessels/VesselDetail";

// ── Manifests ─────────────────────────────────────────────────────────────────
import ManifestsPage   from "./pages/Manifests/ManifestsPage";
import ManifestForm    from "./pages/Manifests/ManifestForm";
import ManifestDetail  from "./pages/Manifests/ManifestDetail";

// ── Vehicles ──────────────────────────────────────────────────────────────────
import VehiclesPage    from "./pages/Vehicles/VehiclesPage";
import VehicleForm     from "./pages/Vehicles/VehicleForm";
import VehicleDetail   from "./pages/Vehicles/VehicleDetail";
import VehicleSearch   from "./pages/Vehicles/VehicleSearch";

// ── Drivers ───────────────────────────────────────────────────────────────────
import DriversPage     from "./pages/Drivers/DriversPage";
import DriverForm      from "./pages/Drivers/DriverForm";
import DriverDetail    from "./pages/Drivers/DriverDetail";

// ── Operations (general) ──────────────────────────────────────────────────────
import OperationsPage  from "./pages/Operations/OperationsPage";
import OperationForm   from "./pages/Operations/OperationForm";
import OperationDetail from "./pages/Operations/OperationDetail";

// ── Workflow (5-step operational flow) ────────────────────────────────────────
import DischargePage     from "./pages/Operations/DischargePage";
import BatchPage         from "./pages/Operations/BatchPage";
import { BatchListPage, BatchDetailPage } from "./pages/Operations/BatchListPage";
import TransferPage      from "./pages/Operations/TransferPage";
import ReceivePage       from "./pages/Operations/ReceivePage";
import ChassisSearchPage from "./pages/Operations/ChassisSearchPage";

// ── Deliveries ────────────────────────────────────────────────────────────────
import DeliveriesPage  from "./pages/Deliveries/DeliveriesPage";
import DeliveryForm    from "./pages/Deliveries/DeliveryForm";
import DeliveryDetail  from "./pages/Deliveries/DeliveryDetail";

// ── Admin / System ────────────────────────────────────────────────────────────
import UsersPage       from "./pages/Users/UsersPage";
import LookupsPage     from "./pages/Lookups/LookupsPage";
import UserProfiles    from "./pages/UserProfiles";

// ── Super Admin ───────────────────────────────────────────────────────────────
import IcdvList          from "./pages/SuperAdmin/IcdvList";
import IcdvDetail        from "./pages/SuperAdmin/IcdvDetail";
import IcdvForm          from "./pages/SuperAdmin/IcdvForm";
import CreateIcdvWizard  from "./pages/SuperAdmin/CreateIcdvWizard";

// ── Fallback ──────────────────────────────────────────────────────────────────
import NotFound        from "./pages/OtherPage/NotFound";

// ── Super Admin Route Guard ───────────────────────────────────────────────────
function SuperAdminRoute() {
  const { isAuthenticated, isSuperAdmin } = useAuth();
  if (!isAuthenticated) return <Navigate to="/signin" replace />;
  if (!isSuperAdmin)    return <Navigate to="/" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <AuthProvider>
      <ToastContainer />
      <Router>
        <ScrollToTop />
        <Routes>

          {/* ── Public ───────────────────────────────────────────────────── */}
          <Route path="/signin"         element={<SignIn />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* ── Change password (auth required, no shell) ─────────────────── */}
          <Route element={<ProtectedRoute />}>
            <Route path="/change-password" element={<ChangePassword />} />
          </Route>

          {/* ── All authenticated users ───────────────────────────────────── */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>

              {/* Dashboard */}
              <Route index path="/" element={<IcdvDashboard />} />

              {/* Vessels */}
              <Route path="/vessels"          element={<VesselsPage />} />
              <Route path="/vessels/new"      element={<VesselForm />} />
              <Route path="/vessels/:id"      element={<VesselDetail />} />
              <Route path="/vessels/:id/edit" element={<VesselForm />} />

              {/* Manifests */}
              <Route path="/manifests"           element={<ManifestsPage />} />
              <Route path="/manifests/new"       element={<ManifestForm />} />
              <Route path="/manifests/:id"       element={<ManifestDetail />} />
              <Route path="/manifests/:id/edit"  element={<ManifestForm />} />

              {/* Vehicles */}
              <Route path="/vehicles"          element={<VehiclesPage />} />
              <Route path="/vehicles/search"   element={<VehicleSearch />} />
              <Route path="/vehicles/new"      element={<VehicleForm />} />
              <Route path="/vehicles/:id"      element={<VehicleDetail />} />
              <Route path="/vehicles/:id/edit" element={<VehicleForm />} />

              {/* Drivers */}
              <Route path="/drivers"          element={<DriversPage />} />
              <Route path="/drivers/new"      element={<DriverForm />} />
              <Route path="/drivers/:id"      element={<DriverDetail />} />
              <Route path="/drivers/:id/edit" element={<DriverForm />} />

              {/* ── Workflow (5-step flow) — MUST be before /operations/:id ── */}
              <Route path="/operations/discharge"        element={<DischargePage />} />
              <Route path="/operations/batch"            element={<BatchPage />} />
              <Route path="/operations/batches"          element={<BatchListPage />} />
              <Route path="/operations/batches/:batchId" element={<BatchDetailPage />} />
              <Route path="/operations/transfer"         element={<TransferPage />} />
              <Route path="/operations/receive"          element={<ReceivePage />} />
              <Route path="/operations/search"           element={<ChassisSearchPage />} />

              {/* Operations (general) — after workflow so :id doesn't swallow named paths */}
              <Route path="/operations"           element={<OperationsPage />} />
              <Route path="/operations/new"       element={<OperationForm />} />
              <Route path="/operations/:id/edit"  element={<OperationForm />} />
              <Route path="/operations/:id"       element={<OperationDetail />} />

              {/* Deliveries */}
              <Route path="/deliveries"           element={<DeliveriesPage />} />
              <Route path="/deliveries/new"       element={<DeliveryForm />} />
              <Route path="/deliveries/:id"       element={<DeliveryDetail />} />
              <Route path="/deliveries/:id/edit"  element={<DeliveryForm />} />

              {/* Profile */}
              <Route path="/profile" element={<UserProfiles />} />

            </Route>
          </Route>

          {/* ── Admin / Supervisor only ───────────────────────────────────── */}
          <Route element={<ProtectedRoute allowedRoles={["admin", "supervisor", "super_admin"]} />}>
            <Route element={<AppLayout />}>
              <Route path="/users"   element={<UsersPage />} />
              <Route path="/lookups" element={<LookupsPage />} />
            </Route>
          </Route>

          {/* ── Super Admin only ──────────────────────────────────────────── */}
          <Route element={<SuperAdminRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/super-admin/icdvs"              element={<IcdvList />} />
              <Route path="/super-admin/icdvs/new"          element={<IcdvForm />} />
              <Route path="/super-admin/icdvs/create"       element={<CreateIcdvWizard />} />
              <Route path="/super-admin/icdvs/:icdvId"      element={<IcdvDetail />} />
              <Route path="/super-admin/icdvs/:icdvId/edit" element={<IcdvForm />} />
            </Route>
          </Route>

          {/* ── Fallback ──────────────────────────────────────────────────── */}
          <Route path="*" element={<NotFound />} />

        </Routes>
      </Router>
    </AuthProvider>
  );
}
