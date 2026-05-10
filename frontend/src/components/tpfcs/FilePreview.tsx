import { useState } from 'react';

interface Props {
  url: string;
  name: string;
  mimeType?: string;
  onClose: () => void;
}

const getType = (mime?: string, name?: string): 'image' | 'pdf' | 'other' => {
  const m = (mime ?? '').toLowerCase();
  const ext = (name ?? '').split('.').pop()?.toLowerCase() ?? '';
  if (m.startsWith('image/') || ['jpg','jpeg','png','gif','webp'].includes(ext)) return 'image';
  if (m === 'application/pdf' || ext === 'pdf') return 'pdf';
  return 'other';
};

export default function FilePreview({ url, name, mimeType, onClose }: Props) {
  const type = getType(mimeType, name);
  const [imgError, setImgError] = useState(false);

  return (
    <div className="fixed inset-0 z-[99999] flex flex-col" style={{ background: 'rgba(0,0,0,0.92)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-4">
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm font-medium text-white truncate">{name}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <a href={url} download={name}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-brand-500 rounded-lg hover:bg-brand-600">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download
          </a>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-white hover:bg-gray-700">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto flex items-center justify-center p-6">
        {type === 'image' && !imgError && (
          <img src={url} alt={name} onError={() => setImgError(true)}
            className="max-w-full max-h-full object-contain rounded shadow-2xl" />
        )}

        {type === 'pdf' && (
          // Use <object> instead of <iframe> — better browser compatibility, no "refused to connect"
          <object
            data={url}
            type="application/pdf"
            className="w-full rounded shadow-2xl bg-white"
            style={{ height: 'calc(100vh - 112px)' }}
          >
            {/* Fallback if object tag fails */}
            <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-4">
              <svg className="w-12 h-12 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-sm">PDF preview unavailable in this browser</p>
              <a href={url} target="_blank" rel="noreferrer"
                className="px-4 py-2 bg-brand-500 text-white text-sm rounded-lg hover:bg-brand-600">
                Open PDF in new tab
              </a>
            </div>
          </object>
        )}

        {(type === 'other' || (type === 'image' && imgError)) && (
          <div className="flex flex-col items-center justify-center gap-4 text-gray-400">
            <svg className="w-16 h-16 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm">Preview not available for this file type</p>
            <a href={url} download={name}
              className="px-4 py-2 bg-brand-500 text-white text-sm rounded-lg hover:bg-brand-600">
              Download to view
            </a>
          </div>
        )}
      </div>

      {/* Click outside to close */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />
    </div>
  );
}
