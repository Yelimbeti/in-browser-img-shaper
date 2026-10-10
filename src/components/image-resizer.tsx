import { useCallback, useEffect, useRef, useState } from "react";
import {
  UploadCloud,
  Link2,
  Link2Off,
  Download,
  RotateCcw,
  ImageIcon,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type OutputFormat = "image/jpeg" | "image/png" | "image/webp";

interface SourceImage {
  url: string;
  width: number;
  height: number;
  sizeBytes: number;
  name: string;
  type: string;
}

const ACCEPT = "image/jpeg,image/jpg,image/png,image/webp";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function extensionFor(format: OutputFormat): string {
  if (format === "image/png") return "png";
  if (format === "image/webp") return "webp";
  return "jpg";
}

async function renderToBlob(
  img: HTMLImageElement,
  width: number,
  height: number,
  format: OutputFormat,
  quality: number,
): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  if (format === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), format, quality),
  );
}

/** Binary-search the quality that lands closest to (and under) the target size. */
async function compressToTarget(
  img: HTMLImageElement,
  width: number,
  height: number,
  format: OutputFormat,
  targetBytes: number,
): Promise<{ blob: Blob | null; quality: number; achieved: boolean }> {
  let lo = 0.01;
  let hi = 1;
  let best: Blob | null = null;
  let bestQ = hi;

  const top = await renderToBlob(img, width, height, format, 1);
  if (top && top.size <= targetBytes) {
    return { blob: top, quality: 1, achieved: true };
  }

  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2;
    const blob = await renderToBlob(img, width, height, format, mid);
    if (!blob) break;
    if (blob.size <= targetBytes) {
      best = blob;
      bestQ = mid;
      lo = mid;
    } else {
      hi = mid;
    }
  }

  if (best) return { blob: best, quality: bestQ, achieved: true };
  const smallest = await renderToBlob(img, width, height, format, 0.01);
  return { blob: smallest, quality: 0.01, achieved: false };
}

export function ImageResizer() {
  const [source, setSource] = useState<SourceImage | null>(null);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [locked, setLocked] = useState(true);
  const [format, setFormat] = useState<OutputFormat>("image/jpeg");
  const [quality, setQuality] = useState(85);
  const [targetKb, setTargetKb] = useState<string>("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultSize, setResultSize] = useState<number | null>(null);
  const [resultDims, setResultDims] = useState<{ w: number; h: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const aspectRef = useRef(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultUrlRef = useRef<string | null>(null);
  const sourceUrlRef = useRef<string | null>(null);

  const setResult = useCallback((url: string | null, size: number | null) => {
    if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
    resultUrlRef.current = url;
    setResultUrl(url);
    setResultSize(size);
  }, []);

  const process = useCallback(
    async (
      img: HTMLImageElement,
      w: number,
      h: number,
      fmt: OutputFormat,
      q: number,
      kb: string,
    ) => {
      if (w < 1 || h < 1) return;
      setNotice(null);
      const target = parseFloat(kb);
      const hasTarget = !Number.isNaN(target) && target > 0;

      if (hasTarget && fmt === "image/png") {
        const blob = await renderToBlob(img, w, h, fmt, 1);
        if (blob) {
          setResult(URL.createObjectURL(blob), blob.size);
          setResultDims({ w, h });
        }
        setNotice(
          "PNG is a lossless format, so quality compression can't be applied. The target file size was ignored — switch to JPG or WebP to compress to a target size.",
        );
        return;
      }

      if (hasTarget) {
        const { blob, achieved, quality: foundQ } = await compressToTarget(
          img,
          w,
          h,
          fmt,
          target * 1024,
        );
        if (blob) {
          setResult(URL.createObjectURL(blob), blob.size);
          setResultDims({ w, h });
          setQuality(Math.round(foundQ * 100));
        }
        if (!achieved) {
          setNotice(
            `Couldn't reach ${target} KB at these dimensions — even the lowest quality is larger. Try a smaller width/height or a bigger target.`,
          );
        }
        return;
      }

      const blob = await renderToBlob(img, w, h, fmt, q / 100);
      if (blob) {
        setResult(URL.createObjectURL(blob), blob.size);
        setResultDims({ w, h });
      }
    },
    [setResult],
  );

  const scheduleProcess = useCallback(
    (w: number, h: number, fmt: OutputFormat, q: number, kb: string) => {
      if (!imgEl) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void process(imgEl, w, h, fmt, q, kb);
      }, 250);
    },
    [imgEl, process],
  );

  useEffect(() => {
    if (imgEl && width > 0 && height > 0) {
      scheduleProcess(width, height, format, quality, targetKb);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgEl, width, height, format, quality, targetKb]);

  useEffect(
    () => () => {
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
    },
    [],
  );

  const loadFile = useCallback(
    (file: File) => {
      setError(null);
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        setError("Please choose a JPG, JPEG, PNG, or WebP image.");
        return;
      }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
        sourceUrlRef.current = url;
        setSource({
          url,
          width: img.naturalWidth,
          height: img.naturalHeight,
          sizeBytes: file.size,
          name: file.name.replace(/\.[^.]+$/, ""),
          type: file.type,
        });
        setImgEl(img);
        aspectRef.current = img.naturalWidth / img.naturalHeight;
        setWidth(img.naturalWidth);
        setHeight(img.naturalHeight);
        setQuality(85);
        setTargetKb("");
        setFormat(
          file.type === "image/png"
            ? "image/png"
            : file.type === "image/webp"
              ? "image/webp"
              : "image/jpeg",
        );
        setNotice(null);
        setResult(null, null);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        setError("That file couldn't be read as an image. Try another one.");
      };
      img.src = url;
    },
    [setResult],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) loadFile(file);
    },
    [loadFile],
  );

  const changeWidth = (value: string) => {
    const w = Math.max(0, Math.floor(Number(value) || 0));
    setWidth(w);
    if (locked && w > 0) setHeight(Math.max(1, Math.round(w / aspectRef.current)));
  };

  const changeHeight = (value: string) => {
    const h = Math.max(0, Math.floor(Number(value) || 0));
    setHeight(h);
    if (locked && h > 0) setWidth(Math.max(1, Math.round(h * aspectRef.current)));
  };

  const reset = () => {
    if (!source) return;
    aspectRef.current = source.width / source.height;
    setWidth(source.width);
    setHeight(source.height);
    setLocked(true);
    setQuality(85);
    setTargetKb("");
    setFormat(
      source.type === "image/png"
        ? "image/png"
        : source.type === "image/webp"
          ? "image/webp"
          : "image/jpeg",
    );
    setNotice(null);
  };

  const download = () => {
    if (!resultUrl || !source) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = `${source.name}-resized.${extensionFor(format)}`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <ImageIcon className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Image Resizer
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {!source ? (
          <div className="mx-auto max-w-xl">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`flex w-full flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-6 py-20 text-center transition-colors ${
                dragging
                  ? "border-primary bg-accent"
                  : "border-border bg-card hover:border-primary/60 hover:bg-accent/50"
              }`}
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent">
                <UploadCloud className="h-8 w-8 text-primary" />
              </div>
              <div>
                <p className="text-lg font-medium text-foreground">
                  Drop your image here, or click to browse
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Supports JPG, JPEG, PNG, and WebP — processed entirely in your browser
                </p>
              </div>
            </button>
            {error && (
              <p className="mt-4 flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" /> {error}
              </p>
            )}
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
            {/* Preview column */}
            <div>
              <div className="flex items-center justify-center rounded-2xl border border-border bg-muted/40 p-4">
                <img
                  src={resultUrl ?? source.url}
                  alt="Image preview"
                  className="max-h-[480px] max-w-full rounded-lg object-contain"
                />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-border bg-card p-3">
                  <p className="text-muted-foreground">Original</p>
                  <p className="mt-1 font-medium text-foreground">
                    {source.width} × {source.height} px
                  </p>
                  <p className="text-muted-foreground">{formatBytes(source.sizeBytes)}</p>
                </div>
                <div className="rounded-xl border border-primary/30 bg-accent p-3">
                  <p className="text-muted-foreground">Resized</p>
                  <p className="mt-1 font-medium text-foreground">
                    {resultDims ? `${resultDims.w} × ${resultDims.h} px` : "—"}
                  </p>
                  <p className="text-primary font-medium">
                    {resultSize !== null ? formatBytes(resultSize) : "—"}
                  </p>
                </div>
              </div>
              {notice && (
                <p className="mt-4 flex items-start gap-2 rounded-xl border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {notice}
                </p>
              )}
            </div>

            {/* Controls column */}
            <div className="space-y-5 rounded-2xl border border-border bg-card p-5">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label>Dimensions (px)</Label>
                  <button
                    type="button"
                    onClick={() => setLocked((v) => !v)}
                    className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    {locked ? (
                      <>
                        <Link2 className="h-3.5 w-3.5" /> Aspect ratio locked
                      </>
                    ) : (
                      <>
                        <Link2Off className="h-3.5 w-3.5" /> Aspect ratio unlocked
                      </>
                    )}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="width" className="text-xs text-muted-foreground">
                      Width
                    </Label>
                    <Input
                      id="width"
                      type="number"
                      min={1}
                      value={width || ""}
                      onChange={(e) => changeWidth(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="height" className="text-xs text-muted-foreground">
                      Height
                    </Label>
                    <Input
                      id="height"
                      type="number"
                      min={1}
                      value={height || ""}
                      onChange={(e) => changeHeight(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="targetKb">Target file size (KB)</Label>
                <Input
                  id="targetKb"
                  type="number"
                  min={1}
                  placeholder="Optional — e.g. 200"
                  value={targetKb}
                  onChange={(e) => setTargetKb(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  We'll compress as close to this size as possible.
                </p>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label>Quality</Label>
                  <span className="text-sm font-medium text-foreground">{quality}%</span>
                </div>
                <Slider
                  value={[quality]}
                  min={1}
                  max={100}
                  step={1}
                  disabled={format === "image/png" || targetKb !== ""}
                  onValueChange={(v) => setQuality(v[0] ?? quality)}
                />
                {format === "image/png" && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    PNG is lossless — quality doesn't apply.
                  </p>
                )}
              </div>

              <div>
                <Label>Output format</Label>
                <Select
                  value={format}
                  onValueChange={(v) => setFormat(v as OutputFormat)}
                >
                  <SelectTrigger className="mt-1 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="image/jpeg">JPG</SelectItem>
                    <SelectItem value="image/png">PNG</SelectItem>
                    <SelectItem value="image/webp">WebP</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button onClick={download} disabled={!resultUrl} className="w-full">
                  <Download className="mr-2 h-4 w-4" /> Download Image
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={reset} className="flex-1">
                    <RotateCcw className="mr-2 h-4 w-4" /> Reset
                  </Button>
                  <Button
                    variant="ghost"
                    className="flex-1"
                    onClick={() => {
                      setSource(null);
                      setImgEl(null);
                      setResult(null, null);
                      fileInputRef.current?.click();
                    }}
                  >
                    <UploadCloud className="mr-2 h-4 w-4" /> New image
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) loadFile(file);
            e.target.value = "";
          }}
        />
      </main>
    </div>
  );
}
