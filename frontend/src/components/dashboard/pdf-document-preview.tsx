"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle } from "lucide-react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

type PdfDocumentPreviewProps = {
  file: Blob;
  loadingLabel: string;
  errorLabel: string;
  retryLabel: string;
  pageLabel: string;
  ofLabel: string;
  previousLabel: string;
  nextLabel: string;
};

export function PdfDocumentPreview({
  file,
  loadingLabel,
  errorLabel,
  retryLabel,
  pageLabel,
  ofLabel,
  previousLabel,
  nextLabel,
}: PdfDocumentPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [containerWidth, setContainerWidth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let active = true;
    let loadingTask: ReturnType<
      (typeof import("pdfjs-dist"))["getDocument"]
    > | null = null;

    void (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        loadingTask = pdfjs.getDocument({
          data: new Uint8Array(await file.arrayBuffer()),
        });
        const loadedDocument = await loadingTask.promise;
        if (active) setDocument(loadedDocument);
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      if (loadingTask) void loadingTask.destroy();
    };
  }, [file, retryCount]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!document || !canvasRef.current || containerWidth <= 0) return;
    let active = true;
    let renderTask: RenderTask | undefined;
    setRendering(true);
    setError(false);

    void document
      .getPage(pageNumber)
      .then((page) => {
        if (!active || !canvasRef.current) return;
        const unscaledViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(containerWidth / unscaledViewport.width, 2);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas rendering is unavailable.");
        const pixelRatio = window.devicePixelRatio || 1;
        canvas.width = Math.ceil(viewport.width * pixelRatio);
        canvas.height = Math.ceil(viewport.height * pixelRatio);
        canvas.style.width = `${Math.ceil(viewport.width)}px`;
        canvas.style.height = `${Math.ceil(viewport.height)}px`;
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        setRendering(true);
        renderTask = page.render({ canvas, canvasContext: context, viewport });
        return renderTask.promise;
      })
      .catch((cause: unknown) => {
        if (
          active &&
          (!(cause instanceof Error) ||
            cause.name !== "RenderingCancelledException")
        ) {
          setError(true);
        }
      })
      .finally(() => {
        if (active) setRendering(false);
      });

    return () => {
      active = false;
      renderTask?.cancel();
    };
  }, [containerWidth, document, pageNumber]);

  const pageCount = document?.numPages ?? 0;

  return (
    <div
      ref={containerRef}
      className="relative flex min-h-[50vh] w-full flex-col items-center overflow-auto rounded-lg bg-slate-100 p-3"
    >
      {loading || rendering ? (
        <div
          role="status"
          className="absolute inset-0 z-10 flex min-h-[50vh] flex-col items-center justify-center gap-2 bg-slate-100/90 text-xs text-slate-600"
        >
          <LoaderCircle size={20} className="animate-spin text-teal-700" />
          {loadingLabel}
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center text-xs text-slate-700"
        >
          <p>{errorLabel}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setError(false);
              setRetryCount((current) => current + 1);
            }}
            className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 font-medium text-slate-700 hover:bg-slate-50"
          >
            {retryLabel}
          </button>
        </div>
      ) : (
        <>
          <canvas
            ref={canvasRef}
            aria-label={`${pageLabel} ${pageNumber}`}
            className="max-w-full bg-white shadow-sm"
          />
          {document && pageCount > 1 ? (
            <div className="sticky bottom-0 mt-3 flex items-center gap-3 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-[10px] text-slate-700 shadow-sm">
              <button
                type="button"
                disabled={pageNumber <= 1 || loading || rendering}
                onClick={() => setPageNumber((current) => current - 1)}
                className="rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-40"
              >
                {previousLabel}
              </button>
              <span>
                {pageLabel} {pageNumber} {ofLabel} {pageCount}
              </span>
              <button
                type="button"
                disabled={pageNumber >= pageCount || loading || rendering}
                onClick={() => setPageNumber((current) => current + 1)}
                className="rounded px-2 py-1 hover:bg-slate-100 disabled:opacity-40"
              >
                {nextLabel}
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
