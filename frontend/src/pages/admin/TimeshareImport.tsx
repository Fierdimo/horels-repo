import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import {
  Upload,
  FileSpreadsheet,
  Play,
  Download,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import apiClient from '@/api/client';
import { useAuthStore } from '@/stores/authStore';

// ── Types ────────────────────────────────────────────────────────────────────

interface ImportError {
  file: 'anagrafica' | 'assignments' | 'calendar';
  row: number;
  raw_data: Record<string, string>;
  reason: string;
}

interface ImportReport {
  owners: { created: number; updated: number; skipped_no_email: number; emails_sent: number };
  suites: { created: number; already_existed: number };
  periods: { created: number; updated: number };
  ownerships: { created: number; already_existed: number };
  week_allocations: { created: number; already_existed: number };
  errors: ImportError[];
}

interface PreviewData {
  owners?:      { preview: any[]; total: number; skipped_no_email: number };
  assignments?: { preview: any[]; total: number; errors: ImportError[] };
  calendar?:    { preview: any[]; total: number; errors: ImportError[] };
}

type Step = 1 | 2 | 3 | 4;

// ── File drop zone ───────────────────────────────────────────────────────────

interface DropZoneProps {
  label: string;
  subtitle: string;
  file: File | null;
  onFile: (f: File | null) => void;
  optional?: boolean;
}

function DropZone({ label, subtitle, file, onFile, optional }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped) onFile(dropped);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    onFile(selected);
  };

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
        file
          ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
          : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
      }`}
      onClick={() => inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={e => e.preventDefault()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={handleChange}
      />
      {file ? (
        <div className="flex items-center justify-center gap-3">
          <CheckCircle className="h-8 w-8 text-green-500" />
          <div className="text-left">
            <p className="font-medium text-green-700 dark:text-green-400">{file.name}</p>
            <p className="text-sm text-green-600 dark:text-green-500">
              {(file.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <button
            onClick={e => { e.stopPropagation(); onFile(null); }}
            className="ml-auto text-gray-400 hover:text-red-500 text-xs"
          >
            ✕
          </button>
        </div>
      ) : (
        <>
          <FileSpreadsheet className="mx-auto h-10 w-10 text-gray-400 mb-2" />
          <div className="flex items-center justify-center gap-2">
            <p className="font-medium text-gray-700 dark:text-gray-300">{label}</p>
            {optional && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500">
                optional
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
          <p className="text-xs text-gray-400 mt-2">.xlsx · .xls · .csv</p>
        </>
      )}
    </div>
  );
}

// ── Preview table ────────────────────────────────────────────────────────────

function PreviewTable({ rows, total }: { rows: any[]; total: number }) {
  if (!rows.length) return <p className="text-sm text-gray-500 italic">No rows</p>;
  const keys = Object.keys(rows[0]).filter(k => k !== 'rowIndex');

  return (
    <div>
      {total > rows.length && (
        <p className="text-xs text-gray-500 mb-2">
          Showing first {rows.length} of {total} rows
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-700">
              {keys.map(k => (
                <th key={k} className="px-2 py-1 text-left font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap border border-gray-200 dark:border-gray-600">
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="odd:bg-white even:bg-gray-50 dark:odd:bg-gray-800 dark:even:bg-gray-750">
                {keys.map(k => (
                  <td key={k} className="px-2 py-1 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 max-w-[200px] truncate">
                    {String(row[k] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Report table ─────────────────────────────────────────────────────────────

function ReportRow({ label, value }: { label: string; value: number; }) {
  return (
    <div className="flex justify-between py-1 border-b border-gray-100 dark:border-gray-700">
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{value}</span>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function TimeshareImport() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  // Files
  const [registryFile,    setRegistryFile]    = useState<File | null>(null);
  const [assignmentsFile, setAssignmentsFile] = useState<File | null>(null);
  const [calendarFile,    setCalendarFile]    = useState<File | null>(null);

  // Config
  const [propertyId, setPropertyId] = useState<number | ''>('');
  const [seasonYear, setSeasonYear] = useState<number>(new Date().getFullYear());

  // State
  const [step,        setStep]        = useState<Step>(1);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [report,      setReport]      = useState<ImportReport | null>(null);
  const [loading,     setLoading]     = useState(false);

  // Admin-only: fetch properties for dropdown
  const { data: propertiesData } = useQuery({
    queryKey: ['admin-properties'],
    queryFn: async () => {
      const { data } = await apiClient.get('/api/admin/properties');
      return data;
    },
    enabled: isAdmin,
  });

  const properties: Array<{ id: number; name: string }> = propertiesData?.data ?? [];

  // ── Helpers ──

  function buildFormData() {
    const fd = new FormData();
    if (registryFile)    fd.append('registry_file',    registryFile);
    if (assignmentsFile) fd.append('assignments_file', assignmentsFile);
    if (calendarFile)    fd.append('calendar_file',    calendarFile);
    fd.append('season_year', String(seasonYear));
    if (isAdmin && propertyId) fd.append('property_id', String(propertyId));
    return fd;
  }

  const filesReady = registryFile || assignmentsFile || calendarFile;
  const configReady = !!filesReady && !!seasonYear && (isAdmin ? !!propertyId : true);

  // ── Step 3: Preview ──

  async function runPreview() {
    if (!configReady) return;
    setLoading(true);
    try {
      const { data } = await apiClient.post(
        '/api/admin/timeshare-import/preview',
        buildFormData(),
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setPreviewData(data.data);
      setStep(2);
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Preview failed');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 4: Execute ──

  async function runImport() {
    if (!configReady) return;
    setLoading(true);
    try {
      const { data } = await apiClient.post(
        '/api/admin/timeshare-import/execute',
        buildFormData(),
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setReport(data.data);
      setStep(4);
      toast.success('Import completed successfully');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Import failed');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 5: Download errors ──

  async function downloadErrors() {
    if (!report?.errors?.length) return;
    try {
      const { data } = await apiClient.post(
        '/api/admin/timeshare-import/errors.csv',
        { errors: report.errors },
        { responseType: 'blob' }
      );
      const url = URL.createObjectURL(new Blob([data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'import_errors.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download error CSV');
    }
  }

  function reset() {
    setRegistryFile(null);
    setAssignmentsFile(null);
    setCalendarFile(null);
    setPreviewData(null);
    setReport(null);
    setStep(1);
  }

  // ── Step indicator ──

  const stepLabels = [
    t('timeshareImport.step1', 'Upload & configure'),
    t('timeshareImport.step2', 'Preview'),
    t('timeshareImport.step3', 'Import'),
    t('timeshareImport.step4', 'Report'),
  ];

  // ── Render ──

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Upload className="h-6 w-6 text-blue-500" />
          {t('timeshareImport.title', 'Timeshare Owner Bulk Import')}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t('timeshareImport.subtitle', 'Import owner registry, suite assignments, and period calendar from Excel / CSV files.')}
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-1">
        {stepLabels.map((label, idx) => {
          const s = (idx + 1) as Step;
          const active  = step === s;
          const done    = step > s;
          return (
            <div key={s} className="flex items-center gap-1 shrink-0">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                active ? 'bg-blue-600 text-white' :
                done   ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                         'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
              }`}>
                {done ? <CheckCircle className="h-3 w-3" /> : <span>{s}</span>}
                {label}
              </div>
              {idx < stepLabels.length - 1 && (
                <ChevronRight className="h-3 w-3 text-gray-400 shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* ── Step 1: Upload & Configure ── */}
      {step === 1 && (
        <div className="space-y-6">
          {/* Configuration row — shown first so it's always visible above the fold */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-4">
              {t('timeshareImport.configTitle', 'Import target')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Property (admin: dropdown; staff: read-only label) */}
              {isAdmin ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('timeshareImport.property', 'Destination hotel')} <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={propertyId}
                    onChange={e => setPropertyId(Number(e.target.value) || '')}
                    className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">{t('timeshareImport.selectProperty', '— Select hotel —')}</option>
                    {properties.map((p: any) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {t('timeshareImport.propertyHint', 'Data will be imported into this hotel')}
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {t('timeshareImport.property', 'Hotel')}
                  </label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {t('timeshareImport.autoProperty', 'Automatically set to your property')}
                  </p>
                </div>
              )}

              {/* Season year */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('timeshareImport.seasonYear', 'Season year')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={seasonYear}
                  onChange={e => setSeasonYear(Number(e.target.value))}
                  min={2000}
                  max={2100}
                  className="w-32 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t('timeshareImport.seasonYearHint', 'Year of the periods in the uploaded files')}
                </p>
              </div>
            </div>
          </div>

          {/* Mode hint */}
          <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300">
            <p className="font-medium mb-1">{t('timeshareImport.partialHintTitle', 'All files are optional — upload only what you need:')}</p>
            <ul className="space-y-0.5 text-xs list-disc list-inside">
              <li>{t('timeshareImport.partialHint1', 'Anagrafica only → creates / updates owner accounts')}</li>
              <li>{t('timeshareImport.partialHint2', 'Assignments + Calendario → updates suite assignments and weekly allocations (owners must exist)')}</li>
              <li>{t('timeshareImport.partialHint3', 'Assignments only → updates ownerships using the calendar already in the database')}</li>
              <li>{t('timeshareImport.partialHint4', 'All three → complete import (first-time setup)')}</li>
            </ul>
          </div>

          {/* File drop-zones */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <DropZone
              label={t('timeshareImport.registryFile', 'Anagrafica (owners)')}
              subtitle={t('timeshareImport.registryFileSub', 'Owner personal & contact details')}
              file={registryFile}
              onFile={setRegistryFile}
              optional
            />
            <DropZone
              label={t('timeshareImport.assignmentsFile', 'Periodo e Suite (assignments)')}
              subtitle={t('timeshareImport.assignmentsFileSub', 'Owner → suite/period mapping')}
              file={assignmentsFile}
              onFile={setAssignmentsFile}
              optional
            />
            <DropZone
              label={t('timeshareImport.calendarFile', 'Calendario (periods)')}
              subtitle={t('timeshareImport.calendarFileSub', 'Period codes with date ranges')}
              file={calendarFile}
              onFile={setCalendarFile}
              optional
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={runPreview}
              disabled={!configReady || loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              {t('timeshareImport.previewBtn', 'Preview data')}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Preview ── */}
      {step === 2 && previewData && (
        <div className="space-y-6">
          {/* Owners */}
          {previewData.owners && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">
              {t('timeshareImport.ownersPreview', 'Owners (Anagrafica)')}
              <span className="ml-2 text-sm font-normal text-gray-500">
                {previewData.owners.total} rows · {previewData.owners.skipped_no_email} skipped (no email)
              </span>
            </h3>
            <PreviewTable rows={previewData.owners.preview} total={previewData.owners.total} />
          </div>
          )}

          {/* Assignments */}
          {previewData.assignments && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">
              {t('timeshareImport.assignmentsPreview', 'Assignments (Periodo e Suite)')}
              <span className="ml-2 text-sm font-normal text-gray-500">
                {previewData.assignments.total} rows
              </span>
            </h3>
            <PreviewTable rows={previewData.assignments.preview} total={previewData.assignments.total} />
            {previewData.assignments.errors.length > 0 && (
              <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">
                  {previewData.assignments.errors.length} parsing errors
                </p>
                {previewData.assignments.errors.slice(0, 3).map((e, i) => (
                  <p key={i} className="text-xs text-red-600 dark:text-red-400">
                    Row {e.row}: {e.reason}
                  </p>
                ))}
              </div>
            )}
          </div>
          )}

          {/* Calendar */}
          {previewData.calendar && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">
              {t('timeshareImport.calendarPreview', 'Calendar (Calendario)')}
              <span className="ml-2 text-sm font-normal text-gray-500">
                {previewData.calendar.total} periods
              </span>
            </h3>
            <PreviewTable rows={previewData.calendar.preview} total={previewData.calendar.total} />
          </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              {t('common.back', 'Back')}
            </button>
            <button
              onClick={() => setStep(3)}
              className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              <Play className="h-4 w-4" />
              {t('timeshareImport.proceedToImport', 'Proceed to import')}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Confirm & Execute ── */}
      {step === 3 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 text-center space-y-6">
          {/* Warning: assignments without calendar */}
          {assignmentsFile && !calendarFile && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 text-left">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  {t('timeshareImport.noCalendarWarningTitle', 'No calendar file uploaded')}
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                  {t('timeshareImport.noCalendarWarningBody',
                    'The assignments file requires period dates. Without a Calendario file the import will look for existing periods in the database. If none are found, all assignment rows will be skipped with a "Period code not found" error. Upload the Calendario file to avoid this.')}
                </p>
              </div>
            </div>
          )}
          <div>
            <AlertCircle className="mx-auto h-12 w-12 text-amber-500 mb-3" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              {t('timeshareImport.confirmTitle', 'Ready to import?')}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">
              {t('timeshareImport.confirmText',
                'The import will write data to the database. Existing records will be updated where applicable. This action cannot be automatically undone.')}
            </p>
          </div>

          <div className="flex justify-center gap-3">
            <button
              onClick={() => setStep(2)}
              disabled={loading}
              className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {t('common.back', 'Back')}
            </button>
            <button
              onClick={runImport}
              disabled={loading}
              className="flex items-center gap-2 px-8 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  {t('timeshareImport.importing', 'Importing…')}
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  {t('timeshareImport.runImport', 'Run import')}
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Report ── */}
      {step === 4 && report && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-2 mb-6">
              <CheckCircle className="h-6 w-6 text-green-500" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('timeshareImport.reportTitle', 'Import completed')}
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Owners */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  {t('timeshareImport.ownersSection', 'Owners')}
                </h3>
                <ReportRow label="Created" value={report.owners.created} />
                <ReportRow label="Updated" value={report.owners.updated} />
                <ReportRow label="Skipped (no email)" value={report.owners.skipped_no_email} />
                <ReportRow label="Welcome emails sent" value={report.owners.emails_sent} />
              </div>

              {/* Suites */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  {t('timeshareImport.suitesSection', 'Suites')}
                </h3>
                <ReportRow label="Created" value={report.suites.created} />
                <ReportRow label="Already existed" value={report.suites.already_existed} />
              </div>

              {/* Calendar periods */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  {t('timeshareImport.periodsSection', 'Calendar periods')}
                </h3>
                <ReportRow label="Created" value={report.periods.created} />
                <ReportRow label="Updated" value={report.periods.updated} />
              </div>

              {/* Ownerships */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  {t('timeshareImport.ownershipsSection', 'Ownerships')}
                </h3>
                <ReportRow label="Created" value={report.ownerships.created} />
                <ReportRow label="Already existed" value={report.ownerships.already_existed} />
              </div>

              {/* Week allocations */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  {t('timeshareImport.weekAllocsSection', 'Week allocations')}
                </h3>
                <ReportRow label="Created" value={report.week_allocations.created} />
                <ReportRow label="Already existed" value={report.week_allocations.already_existed} />
              </div>

              {/* Errors summary */}
              <div className={`rounded-lg p-4 ${report.errors.length ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  {t('timeshareImport.errorsSection', 'Errors')}
                </h3>
                <p className={`text-2xl font-bold ${report.errors.length ? 'text-red-600' : 'text-green-600'}`}>
                  {report.errors.length}
                </p>
                {report.errors.length > 0 && (
                  <button
                    onClick={downloadErrors}
                    className="mt-2 flex items-center gap-1.5 text-xs text-red-700 dark:text-red-400 hover:underline"
                  >
                    <Download className="h-3 w-3" />
                    {t('timeshareImport.downloadErrors', 'Download errors CSV')}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={reset}
              className="flex items-center gap-2 px-6 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              {t('timeshareImport.importAgain', 'Import again')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
