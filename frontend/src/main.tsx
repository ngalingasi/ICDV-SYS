import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "swiper/swiper-bundle.css";
import "simplebar-react/dist/simplebar.min.css";
import "flatpickr/dist/flatpickr.css";
import App from "./App.tsx";
import { AppWrapper } from "./components/common/PageMeta.tsx";
import { ThemeProvider } from "./context/ThemeContext.tsx";

// ── ERP token handler ─────────────────────────────────────────────────────────
// When redirected from the ERP portal with ?token=xxx&refreshToken=yyy,
// store tokens before React mounts so AuthContext sees them immediately.
// Login screen stays untouched — this only activates when URL params are present.
// Always overwrites — incoming token is the authoritative source.
const handleErpRedirect = (): void => {
  const params       = new URLSearchParams(window.location.search);
  const token        = params.get('token');
  const refreshToken = params.get('refreshToken');
  if (!token) return;

  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp * 1000 < Date.now()) return;

    localStorage.setItem('access_token',  token);
    localStorage.setItem('refresh_token', refreshToken ?? '');
    localStorage.setItem('tpfcs_user', JSON.stringify({
      user_id:              Number(payload.sub) || 0,
      full_name:            payload.full_name ?? payload.email ?? 'User',
      username:             payload.username  ?? payload.email ?? 'user',
      email:                payload.email     ?? '',
      role:                 payload.role      ?? 'user',
      status:               'active',
      must_change_password: Number(payload.must_change_password ?? 0),
      icdv_id:              payload.icdv_id   ?? null,
      icdv_name:            null,
    }));

    params.delete('token');
    params.delete('refreshToken');
    const clean = window.location.pathname +
      (params.toString() ? `?${params.toString()}` : '') +
      window.location.hash;
    window.history.replaceState({}, '', clean);
  } catch { /* invalid token — ignore */ }
};

handleErpRedirect();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <AppWrapper>
        <App />
      </AppWrapper>
    </ThemeProvider>
  </StrictMode>
);
