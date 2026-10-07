'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import cn from 'classnames';
import { useReactToPrint } from 'react-to-print';
import {
  DocTableItem,
  DocumentModel,
  TransferToolsPreviewRow,
} from '@/app/interfaces/document.interface';
import { ReferenceModel } from '@/app/interfaces/reference.interface';
import { useAllReferences } from '@/app/components/lists/referencesList/hooks/useReferencesData';
import {
  fetchTransferToolsPreview,
  getTransferToolsPreviewParams,
} from '@/app/service/documents/fetchTransferToolsPreview';
import { showMessage } from '@/app/service/common/showMessage';
import {
  DEFAULT_FORMWORK_LAYOUT,
  FormworkLayout,
  FormworkSolveResult,
  FwSegment,
} from '@/app/service/formwork/formwork.types';
import { buildGeometry } from '@/app/service/formwork/geometry';
import { solveFormwork } from '@/app/service/formwork/formworkSolver';
import { buildFormworkElements } from '@/app/service/formwork/buildFormworkElements';
import {
  applyFormworkToDocument,
  withFormworkLayout,
} from '@/app/service/formwork/applyFormworkToDocument';
import FoundationSketchEditor from './foundationSketchEditor';
import FormworkLayoutScheme from './formworkLayoutScheme';
import FormworkResultPanel from './formworkResultPanel';
import FormworkPrintDocument from './formworkPrintDocument';
import styles from './formworkPlannerModal.module.css';

interface FormworkPlannerModalProps {
  open: boolean;
  currentDocument: DocumentModel;
  allDocItems: DocTableItem[];
  token: string | undefined;
  enterpriseId: number | null | undefined;
  setMainData: Function | undefined;
  onClose: () => void;
}

const numOr = (v: string, fallback: number) => {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const readSavedLayout = (doc: DocumentModel): FormworkLayout => {
  const saved = doc?.docValues?.formworkLayout;
  if (saved && Array.isArray(saved.segments)) {
    return {
      ...DEFAULT_FORMWORK_LAYOUT,
      ...saved,
      segments: saved.segments.filter(
        (s: FwSegment) => s && s.a && s.b && Number.isFinite(s.a.x) && Number.isFinite(s.b.x),
      ),
    };
  }
  return { ...DEFAULT_FORMWORK_LAYOUT, segments: [] };
};

export default function FormworkPlannerModal({
  open,
  currentDocument,
  allDocItems,
  token,
  enterpriseId,
  setMainData,
  onClose,
}: FormworkPlannerModalProps) {
  const { data: references } = useAllReferences(token);

  const [layout, setLayout] = useState<FormworkLayout>(() => readSavedLayout(currentDocument));
  const [stripDraft, setStripDraft] = useState(String(layout.stripWidth));
  const [heightDraft, setHeightDraft] = useState(String(layout.foundationHeight));
  const [gapDraft, setGapDraft] = useState(String(layout.maxGap));

  const [previewRows, setPreviewRows] = useState<TransferToolsPreviewRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [result, setResult] = useState<FormworkSolveResult | null>(layout.result ?? null);
  const [tier, setTier] = useState(0);
  const [applying, setApplying] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [view, setView] = useState<'sketch' | 'scheme'>('sketch');

  const printRef = useRef<HTMLDivElement>(null);
  const printFn = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Опалубка схемаси ${currentDocument?.id ?? ''}`,
  });

  useEffect(() => {
    if (!open) return;
    const initial = readSavedLayout(currentDocument);
    setLayout(initial);
    setStripDraft(String(initial.stripWidth));
    setHeightDraft(String(initial.foundationHeight));
    setGapDraft(String(initial.maxGap));
    setResult(initial.result ?? null);
    setTier(0);
    setActionError(null);
    setView(initial.result ? 'scheme' : 'sketch');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { error } = getTransferToolsPreviewParams(currentDocument, enterpriseId);
      if (error) {
        setPreviewRows(null);
        setLoadError(error);
        return;
      }
      const rows = await fetchTransferToolsPreview(currentDocument, token, enterpriseId);
      setPreviewRows(rows);
    } catch (e: any) {
      setPreviewRows(null);
      setLoadError(e?.response?.data?.message || e?.message || 'Склад қолдиғини юклашда хатолик');
    } finally {
      setLoading(false);
    }
  }, [currentDocument, enterpriseId, token]);

  useEffect(() => {
    if (open) loadPreview();
    else setPreviewRows(null);
  }, [open, loadPreview]);

  const stockKnown = previewRows !== null;

  const elements = useMemo(
    () => buildFormworkElements(references as ReferenceModel[] | undefined, previewRows, allDocItems),
    [references, previewRows, allDocItems],
  );

  const geometry = useMemo(
    () => buildGeometry(layout.segments, layout.stripWidth),
    [layout.segments, layout.stripWidth],
  );

  const clientName = useMemo(() => {
    const id = Number(currentDocument?.docValues?.receiverId) || 0;
    return (references as ReferenceModel[] | undefined)?.find((r) => r.id === id)?.name;
  }, [references, currentDocument]);

  const updateSegments = (segments: FwSegment[]) => {
    setLayout((prev) => ({ ...prev, segments }));
    setResult(null);
  };

  const commitParams = () => {
    setLayout((prev) => {
      const next = {
        ...prev,
        stripWidth: numOr(stripDraft, prev.stripWidth),
        foundationHeight: numOr(heightDraft, prev.foundationHeight),
        maxGap: Math.max(0, Number(gapDraft.replace(',', '.')) || 0),
      };
      setStripDraft(String(next.stripWidth));
      setHeightDraft(String(next.foundationHeight));
      setGapDraft(String(next.maxGap));
      return next;
    });
    setResult(null);
  };

  const handleSolve = () => {
    setActionError(null);
    if (!geometry.contours.length) {
      setActionError('Аввал фундамент чизмасини чизинг (ёпиқ контур)');
      return;
    }
    if (!elements.length) {
      setActionError('Справочникда опалубка элементлари йўқ. ТМБ карточкасида «Опалубка элементи» ни белгиланг.');
      return;
    }
    const solved = solveFormwork({
      geometry,
      elements,
      foundationHeight: layout.foundationHeight,
      maxGap: layout.maxGap,
      stockKnown,
    });
    setResult(solved);
    setTier(0);
    setView('scheme');
  };

  const currentLayoutWithResult = (): FormworkLayout => ({ ...layout, result });

  const handleSaveLayout = () => {
    setMainData?.('currentDocument', withFormworkLayout(currentDocument, currentLayoutWithResult()));
    showMessage('Чизма ҳужжатга сақланди. Ҳужжатни сақлашни унутманг.', 'success', setMainData);
  };

  const handleApply = async () => {
    if (!result) return;
    setApplying(true);
    setActionError(null);
    try {
      const applied = await applyFormworkToDocument(
        currentDocument,
        result,
        elements,
        previewRows || [],
        token,
        enterpriseId,
      );
      if ('error' in applied) {
        setActionError(applied.error);
        return;
      }
      setMainData?.(
        'currentDocument',
        withFormworkLayout(currentDocument, currentLayoutWithResult(), applied.docTableItems),
      );
      const parts = [`Қўшилди: ${applied.addedCount} қатор`];
      if (applied.replacedCount) parts.push(`алмаштирилди: ${applied.replacedCount}`);
      if (applied.skipped.length) parts.push(`складда йўқ: ${applied.skipped.join(', ')}`);
      showMessage(parts.join('; '), 'success', setMainData);
      onClose();
    } catch (e: any) {
      setActionError(e?.message || 'Хатолик юз берди');
    } finally {
      setApplying(false);
    }
  };

  if (!open) return null;

  const canApply = Boolean(result && stockKnown && result.spec.some((r) => r.issue > 0));

  return (
    <div className={styles.overlay}>
      <div className={styles.dialog}>
        <div className={styles.header}>
          <div>
            <h3 className={styles.title}>Опалубка ҳисоблагичи</h3>
            <p className={styles.subtitle}>
              Фундамент ўқ чизиқларини чизинг — программа склад қолдиғи бўйича щитлар тўпламини танлайди
            </p>
          </div>
          <div className={styles.toolGroup}>
            {loading && <span className={styles.hint}>Склад юкланмоқда…</span>}
            {!loading && (
              <span className={cn(styles.stockBadge, { [styles.stockBadgeUnknown]: !stockKnown })}>
                {stockKnown ? `Склад: ${previewRows?.length ?? 0} позиция` : 'Склад қолдиғи номаълум'}
              </span>
            )}
            <button type="button" className={styles.toolBtn} onClick={loadPreview} disabled={loading}>
              ↻ Склад
            </button>
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.leftCol}>
            <div className={styles.toolGroup} style={{ justifyContent: 'space-between' }}>
              <div className={styles.tierTabs}>
                <button
                  type="button"
                  className={cn(styles.tierTab, { [styles.tierTabActive]: view === 'sketch' })}
                  onClick={() => setView('sketch')}
                >
                  Чизма
                </button>
                <button
                  type="button"
                  className={cn(styles.tierTab, { [styles.tierTabActive]: view === 'scheme' })}
                  onClick={() => setView('scheme')}
                  disabled={!result}
                >
                  Жойлашув схемаси
                </button>
              </div>
              {view === 'scheme' && result && result.tiers.length > 1 && (
                <div className={styles.tierTabs}>
                  {result.tiers.map((h, i) => (
                    <button
                      key={i}
                      type="button"
                      className={cn(styles.tierTab, { [styles.tierTabActive]: tier === i })}
                      onClick={() => setTier(i)}
                    >
                      Ярус {i + 1} · {h}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {view === 'sketch' || !result ? (
              <FoundationSketchEditor
                segments={layout.segments}
                onChange={updateSegments}
                geometry={geometry}
                stripWidth={layout.stripWidth}
              />
            ) : (
              <div className={styles.editor} style={{ padding: 8, overflow: 'auto' }}>
                <FormworkLayoutScheme
                  geometry={geometry}
                  result={result}
                  tier={tier}
                  stripWidth={layout.stripWidth}
                  elements={elements}
                  height={480}
                />
              </div>
            )}
          </div>

          <div className={styles.rightCol}>
            <div className={styles.card}>
              <h4 className={styles.cardTitle}>Параметрлар</h4>
              <div className={styles.params}>
                <label className={styles.paramField}>
                  Лента эни, мм
                  <input
                    value={stripDraft}
                    onChange={(e) => setStripDraft(e.target.value)}
                    onBlur={commitParams}
                    onKeyDown={(e) => e.key === 'Enter' && commitParams()}
                    inputMode="numeric"
                  />
                </label>
                <label className={styles.paramField}>
                  Баландлик, мм
                  <input
                    value={heightDraft}
                    onChange={(e) => setHeightDraft(e.target.value)}
                    onBlur={commitParams}
                    onKeyDown={(e) => e.key === 'Enter' && commitParams()}
                    inputMode="numeric"
                  />
                </label>
                <label className={styles.paramField}>
                  Рухсат этилган зазор, мм
                  <input
                    value={gapDraft}
                    onChange={(e) => setGapDraft(e.target.value)}
                    onBlur={commitParams}
                    onKeyDown={(e) => e.key === 'Enter' && commitParams()}
                    inputMode="numeric"
                  />
                </label>
              </div>
              <div className={styles.hint} style={{ marginTop: 8 }}>
                Контурлар: {geometry.contours.length} · Грани: {geometry.faces.length} · Бурчаклар:{' '}
                {geometry.corners.length}
                {loadError ? ` · ${loadError}` : ''}
              </div>
              {geometry.warnings.map((w, i) => (
                <div key={i} className={styles.warning} style={{ marginTop: 6 }}>
                  {w}
                </div>
              ))}
            </div>

            <div className={styles.card}>
              <h4 className={styles.cardTitle}>
                Опалубка элементлари
                <span className={styles.hint}>{elements.length} та</span>
              </h4>
              {elements.length ? (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Номи</th>
                      <th>Ўлчам</th>
                      {stockKnown && <th className={styles.num}>Қолдиқ</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {elements.map((el) => (
                      <tr key={el.analiticId}>
                        <td>{el.name}</td>
                        <td>
                          {el.width && el.height
                            ? `${el.width}×${el.height}`
                            : el.width
                              ? `${el.width}`
                              : el.norm
                                ? `норма ${el.norm}`
                                : ''}
                        </td>
                        {stockKnown && (
                          <td className={cn(styles.num, { [styles.shortCell]: el.stock <= 0 })}>{el.stock}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className={styles.empty}>
                  Справочникда опалубка элементлари топилмади. ТМБ (ускуна) карточкасида «Опалубка элементи» ва
                  ўлчамларни киритинг.
                </div>
              )}
            </div>

            {actionError && <div className={styles.error}>{actionError}</div>}

            {result && <FormworkResultPanel result={result} />}
          </div>
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.btnPrimary} onClick={handleSolve} disabled={loading}>
            Ҳисоблаш
          </button>
          <button type="button" className={styles.btn} onClick={handleSaveLayout}>
            Чизмани сақлаш
          </button>
          <button type="button" className={styles.btn} onClick={() => printFn()} disabled={!result}>
            Схемани чоп этиш
          </button>
          <div className={styles.footerEnd}>
            <button type="button" className={styles.btn} onClick={onClose} disabled={applying}>
              Ёпиш
            </button>
            <button type="button" className={styles.btnPrimary} onClick={handleApply} disabled={!canApply || applying}>
              {applying ? 'Кўчирилмоқда…' : 'Ҳужжатга кўчириш'}
            </button>
          </div>
        </div>
      </div>

      {result && (
        <div style={{ display: 'none' }}>
          <FormworkPrintDocument
            ref={printRef}
            layout={layout}
            geometry={geometry}
            result={result}
            elements={elements}
            clientName={clientName}
            documentId={currentDocument?.id}
            documentDate={Number(currentDocument?.date) || undefined}
          />
        </div>
      )}
    </div>
  );
}
