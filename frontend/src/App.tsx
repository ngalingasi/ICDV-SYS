import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from "react-router";
import { ScrollToTop }   from "./components/common/ScrollToTop";
import { AuthProvider }  from "./context/AuthContext";
import { useAuth }       from "./store/authStore";
import ProtectedRoute    from "./components/tpfcs/ProtectedRoute";
import AppLayout         from "./layout/AppLayout";
import { ToastContainer } from "./components/tpfcs/Toast";

import SignIn          from "./pages/AuthPages/SignIn";
import ResetPassword   from "./pages/AuthPages/ResetPassword";
import ChangePassword  from "./pages/AuthPages/ChangePassword";
import IcdvDashboard   from "./pages/Dashboard/IcdvDashboard";
import VesselsPage     from "./pages/Vessels/VesselsPage";
import VesselForm      from "./pages/Vessels/VesselForm";
import VesselDetail    from "./pages/Vessels/VesselDetail";
import ManifestsPage   from "./pages/Manifests/ManifestsPage";
import ManifestForm    from "./pages/Manifests/ManifestForm";
import ManifestDetail  from "./pages/Manifests/ManifestDetail";
import VehiclesPage    from "./pages/Vehicles/VehiclesPage";
import VehicleForm     from "./pages/Vehicles/VehicleForm";
import VehicleDetail   from "./pages/Vehicles/VehicleDetail";
import VehicleSearch   from "./pages/Vehicles/VehicleSearch";
import DriversPage     from "./pages/Drivers/DriversPage";
import DriverForm      from "./pages/Drivers/DriverForm";
import DriverDetail    from "./pages/Drivers/DriverDetail";
import OperationsPage  from "./pages/Operations/OperationsPage";
import OperationForm   from "./pages/Operations/OperationForm";
import OperationDetail from "./pages/Operations/OperationDetail";
import DeliveriesPage  from "./pages/Deliveries/DeliveriesPage";
import DeliveryForm    from "./pages/Deliveries/DeliveryForm";
import DeliveryDetail  from "./pages/Deliveries/DeliveryDetail";
import UsersPage       from "./pages/Users/UsersPage";
import LookupsPage     from "./pages/Lookups/LookupsPage";
import UserProfiles    from "./pages/UserProfiles";
import IcdvList        from "./pages/SuperAdmin/IcdvList";
import IcdvDetail      from "./pages/SuperAdmin/IcdvDetail";
import IcdvForm        from "./pages/SuperAdmin/IcdvForm";
import CreateIcdvWizard  from './pages/SuperAdmin/CreateIcdvWizard';
import NotFound        from "./pages/OtherPage/NotFound";

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
          <Route path="/signin"         element={<SignIn />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/change-password" element={<ChangePassword />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route index path="/"  element={<IcdvDashboard />} />
              <Route path="/vessels"           element={<VesselsPage />} />
              <Route path="/vessels/new"       element={<VesselForm />} />
              <Route path="/vessels/:id"       element={<VesselDetail />} />
              <Route path="/vessels/:id/edit"  element={<VesselForm />} />
              <Route path="/manifests"          element={<ManifestsPage />} />
              <Route path="/manifests/new"      element={<ManifestForm />} />
              <Route path="/manifests/:id"      element={<ManifestDetail />} />
              <Route path="/manifests/:id/edit" element={<ManifestForm />} />
              <Route path="/vehicles"           element={<VehiclesPage />} />
              <Route path="/vehicles/search"    element={<VehicleSearch />} />
              <Route path="/vehicles/new"       element={<VehicleForm />} />
              <Route path="/vehicles/:id"       element={<VehicleDetail />} />
              <Route path="/vehicles/:id/edit"  element={<VehicleForm />} />
              <Route path="/drivers"            element={<DriversPage />} />
              <Route path="/drivers/new"        element={<DriverForm />} />
              <Route path="/drivers/:id"        element={<DriverDetail />} />
              <Route path="/drivers/:id/edit"   element={<DriverForm />} />
              <Route path="/operations"           element={<OperationsPage />} />
              <Route path="/operations/new"       element={<OperationForm />} />
              <Route path="/operations/:id"       element={<OperationDetail />} />
              <Route path="/operations/:id/edit"  element={<OperationForm />} />
              <Route path="/deliveries"           element={<DeliveriesPage />} />
              <Route path="/deliveries/new"       element={<DeliveryForm />} />
              <Route path="/deliveries/:id"       element={<DeliveryDetail />} />
              <Route path="/deliveries/:id/edit"  element={<DeliveryForm />} />
              <Route path="/profile" element={<UserProfiles />} />
            </Route>
          </Route>
          <Route element={<ProtectedRoute allowedRoles={["admin", "supervisor", "super_admin"]} />}>
            <Route element={<AppLayout />}>
              <Route path="/users"   element={<UsersPage />} />
              <Route path="/lookups" element={<LookupsPage />} />
            </Route>
          </Route>
          <Route element={<SuperAdminRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/super-admin/icdvs"              element={<IcdvList />} />
              <Route path="/super-admin/icdvs/new"            element={<IcdvForm />} />
              <Route path="/super-admin/icdvs/create"         element={<CreateIcdvWizard />} />
              <Route path="/super-admin/icdvs/:icdvId"      element={<IcdvDetail />} />
              <Route path="/super-admin/icdvs/:icdvId/edit" element={<IcdvForm />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
