/**
 * ManifestActionsDropdown.tsx
 *
 * Reusable actions dropdown for the Manifest module.
 * Used in: ManifestsPage (list row), ManifestDetail (header).
 *
 * POSITIONING: Uses position:fixed calculated from getBoundingClientRect()
 * so the panel escapes ALL overflow clipping contexts (overflow-x-auto,
 * overflow-hidden, etc). The panel is rendered via a React Portal into
 * document.body so it is never clipped by any table wrapper.
 *
 * Permissions: mirrors existing role checks throughout the app.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../../store/authStore';

interface ManifestActionsDropdownProps {
  manifestId:  number;
  showDelete?: boolean;
  onDelete?:   () => void;
  onImport?:   () => void;
  compact?:    boolean;
}

export default function ManifestActionsDropdown({
  manifestId,
  showDelete = true,
  onDelete,
  onImport,
  compact = false,
}: ManifestActionsDropdownProps) {
  const { user } = useAuth();
  const [open, setOpen]   = useState(false);
  const [pos,  setPos]    = useState({ top: 0, left: 0 });
  const btnRef            = useRef<HTMLButtonElement>(null);
  const panelRef          = useRef<HTMLDivElement>(null);
  const navigate          = useNavigate();

  const canManageManifests = user && [
    'backoffice_officer', 'operator', 'supervisor', 'admin', 'system_admin', 'super_admin',
  ].includes(user.role);

  const canPrintDeliverySheet = user && [
    'backoffice_officer', 'yard_officer', 'operator', 'supervisor', 'admin', 'system_admin', 'super_admin',
  ].includes(user.role);

  // Calculate fixed position from button coords
  const openPanel = useCallback(() => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    // Panel width is 224px (w-56). Align right edge with button right edge.
    setPos({
      top:  r.bottom + window.scrollY + 4,
      left: r.right  + window.scrollX - 224,
    });
    setOpen(true);
  }, []);

  // Close on outside click or scroll
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (
        panelRef.current  && !panelRef.current.contains(e.target as Node) &&
        btnRef.current    && !btnRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const close = () => setOpen(false);

  const itemCls = 'flex items-center gap-2.5 w-full px-3.5 py-2 text-xs text-left text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors whitespace-nowrap';
  const divider = <div className="h-px bg-gray-100 dark:bg-gray-800 my-1" />;

  const panel = open ? createPortal(
    <div
      ref={panelRef}
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
      className="w-56 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl overflow-hidden py-1"
    >
      <Link to={`/manifests/${manifestId}`} onClick={close} className={itemCls}>
        <EyeIcon /> View Manifest
      </Link>

      {canManageManifests && (
        <Link to={`/manifests/${manifestId}/edit`} onClick={close} className={itemCls}>
          <EditIcon /> Edit Manifest
        </Link>
      )}

      {canManageManifests && showDelete && onDelete && (
        <button
          onClick={() => { close(); onDelete(); }}
          className={`${itemCls} text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10`}
        >
          <TrashIcon /> Delete Manifest
        </button>
      )}

      {(canManageManifests || canPrintDeliverySheet) && divider}

      {canPrintDeliverySheet && (
        <a href={`/manifests/${manifestId}/delivery-sheet`} target="_blank" rel="noopener noreferrer" onClick={close} className={itemCls}>
          <PrintIcon /> Print Delivery Sheet
        </a>
      )}

      {canPrintDeliverySheet && (
        <a href={`/manifests/${manifestId}/delivery-sheet?combined=1`} target="_blank" rel="noopener noreferrer" onClick={close} className={itemCls}>
          <PrintIcon /> Print Combined Sheet
        </a>
      )}

      {canManageManifests && onImport && (
        <button onClick={() => { close(); onImport(); }} className={itemCls}>
          <ImportIcon /> Import Vehicles
        </button>
      )}

      {divider}

      <button onClick={() => { close(); navigate(`/manifests/${manifestId}/live-transfers`); }} className={itemCls}>
        <LiveIcon /> Live Transfer Monitoring
      </button>

      <button onClick={() => { close(); navigate(`/manifests/${manifestId}/transfer-performance`); }} className={itemCls}>
        <ChartIcon /> Transfer Performance
      </button>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => open ? setOpen(false) : openPanel()}
        className={
          compact
            ? 'inline-flex items-center justify-center w-7 h-7 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors'
            : 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors'
        }
      >
        {compact ? (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        ) : (
          <>
            Actions
            <svg className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </>
        )}
      </button>
      {panel}
    </>
  );
}

const EyeIcon    = () => <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>;
const EditIcon   = () => <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>;
const TrashIcon  = () => <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>;
const PrintIcon  = () => <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>;
const ImportIcon = () => <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/></svg>;
const LiveIcon   = () => <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>;
const ChartIcon  = () => <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>;
