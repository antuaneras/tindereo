"use client";

import { startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Camera,
  Image as ImageIcon,
  MapPin,
  Mic2,
  Plus,
  RefreshCw,
  Sparkles,
  UsersRound
} from "lucide-react";
import { publishPost, publishStory, searchMobile } from "@/lib/mobile-api";
import {
  STORY_MAX_VIDEO_MS,
  captureVideoFrameToFile,
  compressPostImages,
  createObjectPreviewUrl,
  getSupportedRecordingMimeType,
  prepareStoryFile,
  revokeObjectPreviewUrl
} from "@/lib/mobile-media-client";
import { uploadManagedMediaFromClient } from "@/lib/tindereo-api";
import type { MobileProfile } from "@/lib/mobile-types";

type CreatorMode = "camera" | "post";
type CaptureMode = "story" | "post";

type LocalMediaItem = {
  file: File;
  id: string;
  previewUrl: string;
};

let sharedCameraSessionStream: MediaStream | null = null;
let sharedCameraSessionFacingMode: "environment" | "user" | null = null;

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function stopSharedCameraSessionStream() {
  sharedCameraSessionStream?.getTracks().forEach((track) => track.stop());
  sharedCameraSessionStream = null;
  sharedCameraSessionFacingMode = null;
}

function getReusableCameraSessionStream(facingMode: "environment" | "user") {
  if (
    !sharedCameraSessionStream ||
    sharedCameraSessionFacingMode !== facingMode ||
    sharedCameraSessionStream.getTracks().every((track) => track.readyState === "ended")
  ) {
    if (sharedCameraSessionStream?.getTracks().every((track) => track.readyState === "ended")) {
      stopSharedCameraSessionStream();
    }

    return null;
  }

  sharedCameraSessionStream.getVideoTracks().forEach((track) => {
    track.enabled = true;
  });

  return sharedCameraSessionStream;
}

function parkCameraSessionStream(stream: MediaStream | null) {
  if (!stream) {
    return;
  }

  sharedCameraSessionStream = stream;
  stream.getVideoTracks().forEach((track) => {
    track.enabled = false;
  });
}

function buildFinalCaption(caption: string, location: string, taggedProfiles: MobileProfile[]) {
  const sections = [caption.trim()];
  if (taggedProfiles.length) {
    sections.push(taggedProfiles.map((profile) => `@${profile.handle}`).join(" "));
  }
  if (location.trim()) {
    sections.push(`📍 ${location.trim()}`);
  }
  return sections.filter(Boolean).join("\n\n");
}

function PostComposer({
  initialFiles = [],
  onBack
}: {
  initialFiles?: File[];
  onBack: () => void;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const itemsRef = useRef<LocalMediaItem[]>([]);
  const [items, setItems] = useState<LocalMediaItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [caption, setCaption] = useState("");
  const [location, setLocation] = useState("");
  const [taggedProfiles, setTaggedProfiles] = useState<MobileProfile[]>([]);
  const [tagQuery, setTagQuery] = useState("");
  const deferredTagQuery = useDeferredValue(tagQuery);
  const [tagResults, setTagResults] = useState<MobileProfile[]>([]);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    return () => {
      for (const item of itemsRef.current) {
        revokeObjectPreviewUrl(item.previewUrl);
      }
    };
  }, []);

  useEffect(() => {
    if (!deferredTagQuery.trim()) {
      setTagResults([]);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(() => {
      void searchMobile(deferredTagQuery)
        .then((payload) => {
          if (!cancelled) {
            setTagResults(
              payload.profiles.filter(
                (profile) => !taggedProfiles.some((taggedProfile) => taggedProfile.id === profile.id)
              )
            );
          }
        })
        .catch(() => {
          if (!cancelled) {
            setTagResults([]);
          }
        });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [deferredTagQuery, taggedProfiles]);

  async function ingestFiles(inputFiles: File[]) {
    if (!inputFiles.length) {
      return;
    }

    setError(null);
    setIsPreparing(true);

    try {
      const remainingSlots = Math.max(0, 20 - items.length);
      if (remainingSlots === 0) {
        throw new Error("Has llegado al limite de 20 fotos por publicacion.");
      }

      const compressed = await compressPostImages(inputFiles.slice(0, remainingSlots));
      const nextItems = compressed.map((file, index) => ({
        file,
        id: `${Date.now()}-${index}-${file.name}`,
        previewUrl: createObjectPreviewUrl(file)
      }));

      setItems((current) => {
        const next = [...current, ...nextItems].slice(0, 20);
        if (current.length === 0) {
          setActiveIndex(0);
        }
        return next;
      });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "No se pudieron preparar esas fotos.");
    } finally {
      setIsPreparing(false);
    }
  }

  async function handleAddFiles(fileList: FileList | null) {
    if (!fileList?.length) {
      return;
    }

    await ingestFiles(Array.from(fileList));
  }

  useEffect(() => {
    if (!initialFiles.length) {
      return;
    }

    void ingestFiles(initialFiles);
  }, [initialFiles]);

  async function handleSubmit() {
    if (!items.length || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const uploads: Array<{ assetRef: string; previewUrl: string | null; mimeType: string }> = [];

      for (const [index, item] of items.entries()) {
        setProgressLabel(`Subiendo ${index + 1} de ${items.length}`);
        const uploaded = await uploadManagedMediaFromClient(item.file, "post");
        uploads.push({
          assetRef: uploaded.assetRef,
          previewUrl: uploaded.previewUrl,
          mimeType: item.file.type || "image/jpeg"
        });
      }

      setProgressLabel("Compartiendo publicacion...");
      await publishPost({
        ownerType: "user",
        ownerId: "",
        caption: buildFinalCaption(caption, location, taggedProfiles),
        assets: uploads
      });

      startTransition(() => {
        router.push("/inicio");
        router.refresh();
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo compartir la publicacion.");
    } finally {
      setIsSubmitting(false);
      setProgressLabel(null);
    }
  }

  return (
    <div className="space-y-4 rounded-[2.2rem] bg-white shadow-[0_24px_70px_rgba(29,22,15,0.12)]">
      <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-[2.2rem] border-b border-[var(--line-soft)] bg-white/95 px-4 py-4 backdrop-blur">
        <button type="button" onClick={onBack} className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--bg-soft)]">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <div className="text-base font-bold">Nueva publicacion</div>
          <div className="text-xs text-[var(--text-soft)]">Hasta 20 fotos</div>
        </div>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!items.length || isSubmitting || isPreparing}
          className="rounded-full bg-[var(--text-main)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-45"
        >
          {isSubmitting ? "Subiendo..." : "Compartir"}
        </button>
      </div>

      {!items.length ? (
        <div className="space-y-4 px-4 pb-5">
          <div className="rounded-[2rem] bg-[#15110d] px-5 py-8 text-center text-white">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/8">
              <ImageIcon className="h-7 w-7" />
            </div>
            <div className="mt-4 text-xl font-black tracking-[-0.04em]">Abre la fototeca</div>
            <p className="mt-2 text-sm leading-6 text-white/64">
              En web movil no puedo leer toda la libreria como Instagram antes de que elijas archivos, asi que abro el
              selector nativo y luego te monto el grid y el carrusel dentro de la app.
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-5 rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#15110d]"
            >
              Elegir fotos
            </button>
          </div>
          {error ? <p className="text-sm text-[#b84031]">{error}</p> : null}
        </div>
      ) : (
        <div className="space-y-4 px-4 pb-6">
          <div className="overflow-hidden rounded-[1.8rem] bg-black">
            <div className="scrollbar-hide flex snap-x snap-mandatory overflow-x-auto" onScroll={(event) => {
              const node = event.currentTarget;
              const width = node.clientWidth || 1;
              setActiveIndex(Math.round(node.scrollLeft / width));
            }}>
              {items.map((item, index) => (
                <div key={item.id} className="w-full shrink-0 snap-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.previewUrl} alt={`Seleccion ${index + 1}`} className="aspect-square w-full object-cover" />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-soft)]">
              {activeIndex + 1} de {items.length}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={items.length >= 20 || isPreparing || isSubmitting}
              className="rounded-full border border-[var(--line-warm)] px-4 py-2 text-sm font-semibold disabled:opacity-45"
            >
              {items.length >= 20 ? "Limite alcanzado" : "Seleccionar mas"}
            </button>
          </div>

          <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-1">
            {items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={cn(
                  "overflow-hidden rounded-[1.1rem] border-2",
                  index === activeIndex ? "border-[var(--coral)]" : "border-transparent"
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.previewUrl} alt={`Miniatura ${index + 1}`} className="h-20 w-20 object-cover" />
              </button>
            ))}
          </div>

          <textarea
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            placeholder="Anade un pie de foto..."
            className="min-h-28 w-full rounded-[1.8rem] border border-[var(--line-warm)] bg-[var(--bg-soft)] px-4 py-4 text-base outline-none"
          />

          <div className="space-y-3 rounded-[1.8rem] border border-[var(--line-soft)] bg-[var(--bg-soft)] p-4">
            <div className="flex items-center gap-3">
              <UsersRound className="h-5 w-5 text-[var(--text-soft)]" />
              <div className="text-sm font-semibold">Etiquetar personas</div>
            </div>
            <input
              value={tagQuery}
              onChange={(event) => setTagQuery(event.target.value)}
              placeholder="Buscar por nombre o @usuario"
              className="h-12 w-full rounded-full border border-[var(--line-warm)] bg-white px-4 text-base outline-none"
            />

            {taggedProfiles.length ? (
              <div className="flex flex-wrap gap-2">
                {taggedProfiles.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() =>
                      setTaggedProfiles((current) => current.filter((item) => item.id !== profile.id))
                    }
                    className="rounded-full bg-white px-3 py-2 text-sm font-semibold"
                  >
                    @{profile.handle}
                  </button>
                ))}
              </div>
            ) : null}

            {tagResults.length ? (
              <div className="grid gap-2">
                {tagResults.slice(0, 6).map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => {
                      setTaggedProfiles((current) => [...current, profile]);
                      setTagQuery("");
                      setTagResults([]);
                    }}
                    className="flex items-center justify-between rounded-[1.2rem] bg-white px-3 py-3 text-left"
                  >
                    <div>
                      <div className="text-sm font-semibold">@{profile.handle}</div>
                      <div className="text-xs text-[var(--text-soft)]">
                        {profile.displayName} · {profile.city}
                      </div>
                    </div>
                    <Plus className="h-4 w-4 text-[var(--coral)]" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <label className="flex items-center gap-3 rounded-[1.6rem] border border-[var(--line-soft)] bg-[var(--bg-soft)] px-4 py-4">
            <MapPin className="h-5 w-5 text-[var(--text-soft)]" />
            <input
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Anadir ubicacion"
              className="w-full bg-transparent text-base outline-none placeholder:text-[var(--text-soft)]"
            />
          </label>

          <div className="flex items-center gap-3 rounded-[1.6rem] border border-[var(--line-soft)] bg-[var(--bg-soft)] px-4 py-4 text-[var(--text-soft)]">
            <Mic2 className="h-5 w-5" />
            <div className="flex-1">
              <div className="text-sm font-semibold text-[var(--text-main)]">Anade audio</div>
              <div className="text-xs">Lo dejamos preparado de interfaz, pero todavia no lo estamos guardando.</div>
            </div>
          </div>

          {(error || progressLabel || isPreparing) ? (
            <div className="rounded-[1.4rem] bg-[var(--bg-soft)] px-4 py-3 text-sm text-[var(--text-soft)]">
              {error ?? progressLabel ?? "Preparando fotos..."}
            </div>
          ) : null}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          void handleAddFiles(event.target.files);
          event.currentTarget.value = "";
        }}
      />
    </div>
  );
}

function CameraComposer({
  onBack,
  onOpenEvent,
  onOpenPostComposer
}: {
  onBack: () => void;
  onOpenEvent: () => void;
  onOpenPostComposer: (files: File[]) => void;
}) {
  const router = useRouter();
  const libraryInputRef = useRef<HTMLInputElement | null>(null);
  const fallbackCaptureInputRef = useRef<HTMLInputElement | null>(null);
  const liveVideoRef = useRef<HTMLVideoElement | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const capturePressStartedAtRef = useRef<number | null>(null);
  const videoCaptureStartedRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStartedAtRef = useRef<number | null>(null);
  const recordingTimeoutRef = useRef<number | null>(null);
  const recordingFrameRef = useRef<number | null>(null);

  const [previewUrl, setPreviewUrl] = useState("");
  const [storyFile, setStoryFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [storyMediaType, setStoryMediaType] = useState<"image" | "video">("image");
  const [durationMs, setDurationMs] = useState(5000);
  const [captureMode, setCaptureMode] = useState<CaptureMode>("story");
  const [cameraAccessError, setCameraAccessError] = useState<string | null>(null);
  const [cameraFacingMode, setCameraFacingMode] = useState<"environment" | "user">("environment");
  const [hasLiveCamera, setHasLiveCamera] = useState(false);
  const [isLivePreviewReady, setIsLivePreviewReady] = useState(false);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [cameraRetryNonce, setCameraRetryNonce] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    return () => {
      revokeObjectPreviewUrl(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (captureMode !== "post" || !previewUrl) {
      return;
    }

    resetStoryDraft();
    setCameraRetryNonce((current) => current + 1);
  }, [captureMode, previewUrl]);

  const resetStoryDraft = () => {
    if (previewUrl) {
      revokeObjectPreviewUrl(previewUrl);
    }
    setPreviewUrl("");
    setStoryFile(null);
    setCaption("");
    setStoryMediaType("image");
    setDurationMs(5000);
    setCameraAccessError(null);
  };

  const clearCaptureTimer = () => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const clearRecordingTimeout = () => {
    if (recordingTimeoutRef.current !== null) {
      window.clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
  };

  const clearRecordingProgress = () => {
    if (recordingFrameRef.current !== null) {
      window.cancelAnimationFrame(recordingFrameRef.current);
      recordingFrameRef.current = null;
    }

    setRecordingProgress(0);
  };

  const openLibraryPicker = () => {
    libraryInputRef.current?.click();
  };

  const openFallbackCapturePicker = () => {
    fallbackCaptureInputRef.current?.click();
  };

  const detachLiveVideoElement = () => {
    if (liveVideoRef.current) {
      liveVideoRef.current.pause();
      liveVideoRef.current.srcObject = null;
    }
  };

  const stopLiveStream = (mode: "dispose" | "park" = "dispose") => {
    const stream = streamRef.current;

    if (mode === "park") {
      parkCameraSessionStream(stream);
    } else if (stream && sharedCameraSessionStream === stream) {
      stopSharedCameraSessionStream();
    } else {
      stream?.getTracks().forEach((track) => track.stop());
    }

    streamRef.current = null;
    detachLiveVideoElement();
    setHasLiveCamera(false);
    setIsLivePreviewReady(false);
  };

  useEffect(() => {
    let cancelled = false;

    const startLiveCamera = async () => {
      if (previewUrl || typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        return;
      }

      setIsLivePreviewReady(false);
      const reusableStream = getReusableCameraSessionStream(cameraFacingMode);
      if (reusableStream) {
        streamRef.current = reusableStream;
        setCameraAccessError(null);
        setHasLiveCamera(true);
        return;
      }

      stopLiveStream("dispose");

      const preferredFacingMode =
        cameraFacingMode === "user" ? "user" : ({ ideal: "environment" } as const);

      try {
        let stream: MediaStream;

        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: preferredFacingMode,
              aspectRatio: { ideal: 9 / 16 },
              height: { ideal: 1920 },
              width: { ideal: 1080 }
            }
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: true
          });
        }

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        sharedCameraSessionStream = stream;
        sharedCameraSessionFacingMode = cameraFacingMode;

        const [videoTrack] = stream.getVideoTracks();
        const capabilities = videoTrack?.getCapabilities?.() as
          | (MediaTrackCapabilities & { zoom?: { min?: number; max?: number }; focusMode?: string[] })
          | undefined;

        if (videoTrack && capabilities) {
          const advancedConstraints: Record<string, number | string> = {};

          if (typeof capabilities.zoom?.min === "number") {
            advancedConstraints.zoom = capabilities.zoom.min;
          }

          if (Array.isArray(capabilities.focusMode) && capabilities.focusMode.includes("continuous")) {
            advancedConstraints.focusMode = "continuous";
          }

          if (Object.keys(advancedConstraints).length) {
            void videoTrack.applyConstraints({
              advanced: [advancedConstraints as MediaTrackConstraintSet]
            }).catch(() => undefined);
          }
        }

        setCameraAccessError(null);
        setHasLiveCamera(true);
      } catch {
        if (!cancelled) {
          setHasLiveCamera(false);
          setIsLivePreviewReady(false);
          setCameraAccessError("No he podido abrir la camara en directo. Puedes reintentarlo o usar la del sistema.");
        }
      }
    };

    void startLiveCamera();

    return () => {
      cancelled = true;
      clearCaptureTimer();
      clearRecordingTimeout();
      clearRecordingProgress();
      mediaRecorderRef.current?.stop?.();
      mediaRecorderRef.current = null;
      stopLiveStream("park");
    };
  }, [cameraFacingMode, cameraRetryNonce, previewUrl]);

  useEffect(() => {
    if (!hasLiveCamera || previewUrl) {
      return undefined;
    }

    let cancelled = false;

    const bindPreview = async () => {
      const video = liveVideoRef.current;
      const stream = streamRef.current;

      if (!video || !stream) {
        return;
      }

      if (video.srcObject !== stream) {
        video.srcObject = stream;
      }

      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;
      video.setAttribute("muted", "");
      video.setAttribute("autoplay", "");
      video.setAttribute("playsinline", "");

      try {
        await video.play();
        if (!cancelled) {
          setCameraAccessError(null);
        }
      } catch {
        if (!cancelled) {
          setCameraAccessError("He pedido acceso a la camara pero el movil no ha mostrado la preview.");
        }
      }
    };

    void bindPreview();

    return () => {
      cancelled = true;
    };
  }, [hasLiveCamera, previewUrl]);

  const updateRecordingProgressFrame = () => {
    if (!recordingStartedAtRef.current || !isRecordingVideo) {
      clearRecordingProgress();
      return;
    }

    const elapsedMs = Date.now() - recordingStartedAtRef.current;
    const nextProgress = Math.min(100, (elapsedMs / STORY_MAX_VIDEO_MS) * 100);
    setRecordingProgress(nextProgress);

    if (nextProgress >= 100) {
      recordingFrameRef.current = null;
      return;
    }

    recordingFrameRef.current = window.requestAnimationFrame(updateRecordingProgressFrame);
  };

  const remainingRecordingSeconds = Math.max(
    0,
    Math.ceil(((100 - recordingProgress) * STORY_MAX_VIDEO_MS) / 100 / 1000)
  );
  const remainingRecordingLabel = `00:${String(remainingRecordingSeconds).padStart(2, "0")}`;

  async function handlePickedStoryFile(file: File | null) {
    if (!file) {
      return;
    }

    if (captureMode === "post") {
      onOpenPostComposer([file]);
      return;
    }

    const prepared = await prepareStoryFile(file);
    if (previewUrl) {
      revokeObjectPreviewUrl(previewUrl);
    }
    setStoryFile(prepared.file);
    setPreviewUrl(createObjectPreviewUrl(prepared.file));
    setStoryMediaType(prepared.mediaType);
    setDurationMs(prepared.durationMs);
    setCameraAccessError(null);
  }

  async function handlePickedLibraryFiles(fileList: FileList | null) {
    if (!fileList?.length) {
      return;
    }

    const files = Array.from(fileList);

    if (captureMode === "post") {
      onOpenPostComposer(files.slice(0, 20));
      return;
    }

    await handlePickedStoryFile(files[0] ?? null);
  }

  async function capturePhotoFromLiveCamera() {
    const video = liveVideoRef.current;
    if (!video || !hasLiveCamera || video.videoWidth === 0 || video.videoHeight === 0) {
      if (captureMode === "post") {
        openLibraryPicker();
      } else {
        openFallbackCapturePicker();
      }
      return;
    }

    const file = await captureVideoFrameToFile(video);
    if (captureMode === "post") {
      onOpenPostComposer([file]);
      return;
    }

    await handlePickedStoryFile(file);
  }

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    clearRecordingTimeout();
    clearRecordingProgress();
  };

  const startVideoRecording = () => {
    if (!streamRef.current || typeof MediaRecorder === "undefined" || isSubmitting) {
      setCameraAccessError("No he podido grabar en directo. Usa un archivo del sistema si lo prefieres.");
      return;
    }

    try {
      recordingChunksRef.current = [];
      recordingStartedAtRef.current = Date.now();
      const mimeType = getSupportedRecordingMimeType();
      const recorder = mimeType
        ? new MediaRecorder(streamRef.current, {
            mimeType,
            videoBitsPerSecond: 1_800_000
          })
        : new MediaRecorder(streamRef.current);

      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const nextMimeType = recordingChunksRef.current[0]?.type || mimeType || "video/webm";
        const extension = nextMimeType.includes("mp4") ? "mp4" : "webm";
        const nextBlob = new Blob(recordingChunksRef.current, { type: nextMimeType });
        const nextFile = new File([nextBlob], `story-${Date.now()}.${extension}`, {
          type: nextMimeType
        });
        recordingChunksRef.current = [];
        recordingStartedAtRef.current = null;
        setIsRecordingVideo(false);
        void handlePickedStoryFile(nextFile);
      };

      recorder.onerror = () => {
        setIsRecordingVideo(false);
        recordingChunksRef.current = [];
        recordingStartedAtRef.current = null;
        clearRecordingProgress();
        setCameraAccessError("La grabacion en directo ha fallado. Puedes probar otra vez.");
      };

      recorder.start();
      setIsRecordingVideo(true);
      setRecordingProgress(0);
      clearRecordingProgress();
      recordingFrameRef.current = window.requestAnimationFrame(updateRecordingProgressFrame);
      clearRecordingTimeout();
      recordingTimeoutRef.current = window.setTimeout(() => {
        stopVideoRecording();
      }, STORY_MAX_VIDEO_MS);
    } catch {
      setCameraAccessError("No he podido iniciar la grabacion en directo.");
    }
  };

  const handleCapturePressStart = () => {
    if (typeof window === "undefined" || isSubmitting) {
      return;
    }

    capturePressStartedAtRef.current = window.performance.now();
    videoCaptureStartedRef.current = false;

    if (!hasLiveCamera) {
      return;
    }

    if (captureMode === "post") {
      return;
    }

    clearCaptureTimer();
    holdTimerRef.current = window.setTimeout(() => {
      videoCaptureStartedRef.current = true;
      startVideoRecording();
      holdTimerRef.current = null;
    }, 220);
  };

  const handleCapturePressEnd = () => {
    if (isSubmitting) {
      return;
    }

    const wasLongPress =
      typeof window !== "undefined" &&
      capturePressStartedAtRef.current !== null &&
      window.performance.now() - capturePressStartedAtRef.current >= 220;
    capturePressStartedAtRef.current = null;

    if (!hasLiveCamera) {
      if (captureMode === "post") {
        openLibraryPicker();
      } else {
        openFallbackCapturePicker();
      }
      return;
    }

    if (captureMode === "post") {
      void capturePhotoFromLiveCamera();
      return;
    }

    const shouldStopVideo = videoCaptureStartedRef.current;
    clearCaptureTimer();

    if (shouldStopVideo) {
      stopVideoRecording();
    } else if (!wasLongPress) {
      void capturePhotoFromLiveCamera();
    }

    window.setTimeout(() => {
      videoCaptureStartedRef.current = false;
    }, 0);
  };

  const handleCapturePressCancel = () => {
    capturePressStartedAtRef.current = null;
    clearCaptureTimer();
    if (videoCaptureStartedRef.current) {
      stopVideoRecording();
    }
    videoCaptureStartedRef.current = false;
  };

  async function handleSubmit() {
    if (!storyFile || isSubmitting || captureMode !== "story") {
      return;
    }

    setIsSubmitting(true);
    setCameraAccessError(null);

    try {
      const uploaded = await uploadManagedMediaFromClient(storyFile, "story");
      await publishStory({
        ownerType: "user",
        ownerId: "",
        assetRef: uploaded.assetRef,
        previewUrl: uploaded.previewUrl,
        mimeType: storyFile.type || "image/jpeg",
        caption: caption.trim(),
        durationMs
      });

      startTransition(() => {
        router.push("/inicio");
        router.refresh();
      });
    } catch (submitError) {
      setCameraAccessError(submitError instanceof Error ? submitError.message : "No se pudo subir la historia.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="relative min-h-[100dvh] select-none overflow-hidden bg-black text-white"
      style={{
        userSelect: "none",
        WebkitTouchCallout: "none",
        WebkitUserSelect: "none"
      }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-36 bg-gradient-to-b from-black/76 via-black/26 to-transparent" />
      <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-4 pb-6 pt-[calc(1rem+env(safe-area-inset-top))]">
        <button className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/10 backdrop-blur" onClick={onBack} type="button">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/72">
          {captureMode === "story" ? "Historia" : "Publicacion"}
        </p>
        <button
          className={cn(
            "pointer-events-auto rounded-full px-4 py-2 text-sm font-semibold backdrop-blur disabled:opacity-60",
            previewUrl && captureMode === "story" ? "bg-white text-[#1d160f]" : "bg-white/10 text-white"
          )}
          disabled={previewUrl && captureMode === "story" ? isSubmitting || !previewUrl : false}
          onClick={() => {
            if (previewUrl && captureMode === "story") {
              void handleSubmit();
              return;
            }

            onOpenEvent();
          }}
          type="button"
        >
          {previewUrl && captureMode === "story" ? (
            isSubmitting ? "Subiendo..." : "Subir"
          ) : (
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Evento
            </span>
          )}
        </button>
      </div>

      <div className="min-h-[100dvh]">
        <div className="relative min-h-[100dvh] overflow-hidden bg-black">
          {previewUrl ? (
            <div className="relative h-[100dvh]">
              {storyMediaType === "video" ? (
                <video autoPlay controls muted playsInline src={previewUrl} className="h-full w-full object-cover" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="Vista previa de historia" className="h-full w-full object-cover" />
              )}
              <div className="absolute inset-x-0 top-[calc(4.5rem+env(safe-area-inset-top))] flex items-center justify-between px-4">
                <p className="rounded-full bg-black/35 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white/70 backdrop-blur">
                  Vista previa
                </p>
                <button
                  className="inline-flex items-center gap-2 rounded-full bg-black/35 px-4 py-2 text-sm font-semibold text-white backdrop-blur"
                  onClick={() => {
                    resetStoryDraft();
                    setCameraRetryNonce((current) => current + 1);
                  }}
                  type="button"
                >
                  <RefreshCw className="h-4 w-4" />
                  Repetir
                </button>
              </div>
            </div>
          ) : hasLiveCamera ? (
            <div className="relative h-[100dvh] overflow-hidden bg-black">
              {isRecordingVideo ? (
                <>
                  <div className="absolute inset-x-4 top-[calc(4.5rem+env(safe-area-inset-top))] z-10 h-1.5 overflow-hidden rounded-full bg-white/18">
                    <div className="h-full rounded-full bg-[#ff6b57] transition-[width] duration-100" style={{ width: `${recordingProgress}%` }} />
                  </div>
                  <div className="absolute left-1/2 top-[calc(5.4rem+env(safe-area-inset-top))] z-10 -translate-x-1/2 rounded-full bg-black/45 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
                    <span className="mr-2 inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-[#ff6b57]" />
                    Grabando {remainingRecordingLabel}
                  </div>
                </>
              ) : null}
              {!isLivePreviewReady ? (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_32%),rgba(7,5,4,0.84)] px-6 text-center">
                  <div className="h-10 w-10 animate-pulse rounded-full border border-white/18 bg-white/12" />
                  <p className="text-sm font-semibold text-white">Abriendo la camara...</p>
                </div>
              ) : null}
              <video
                autoPlay
                className={cn(
                  "h-full w-full object-cover transition-opacity duration-200",
                  cameraFacingMode === "user" && "-scale-x-100",
                  isLivePreviewReady ? "opacity-100" : "opacity-0"
                )}
                disablePictureInPicture
                muted
                onLoadedData={() => setIsLivePreviewReady(true)}
                onLoadedMetadata={() => setIsLivePreviewReady(true)}
                onPlaying={() => setIsLivePreviewReady(true)}
                playsInline
                ref={liveVideoRef}
              />
              <div className="absolute inset-x-0 top-[calc(4.5rem+env(safe-area-inset-top))] flex items-center justify-between px-4">
                <div className="rounded-full bg-black/35 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70 backdrop-blur">
                  {captureMode === "story" ? "Historia" : "Publicacion"}
                </div>
                <button
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur disabled:opacity-40"
                  disabled={isRecordingVideo}
                  onClick={() => {
                    stopSharedCameraSessionStream();
                    setCameraFacingMode((current) => (current === "environment" ? "user" : "environment"));
                  }}
                  type="button"
                >
                  <RefreshCw className="h-5 w-5" />
                </button>
              </div>
              <div className="absolute inset-x-0 bottom-0 z-20 bg-[linear-gradient(0deg,rgba(0,0,0,0.98),rgba(0,0,0,0.54),transparent)] px-4 pb-[calc(0.45rem+env(safe-area-inset-bottom))] pt-24">
                <div className="flex justify-center">
                  <div className="inline-flex rounded-full bg-black/40 p-1 backdrop-blur">
                    {([
                      { id: "post", label: "Publicacion" },
                      { id: "story", label: "Historia" }
                    ] as const).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setCaptureMode(item.id)}
                        className={cn(
                          "rounded-full px-4 py-2 text-sm font-semibold transition",
                          captureMode === item.id ? "bg-white text-[#120d0a]" : "text-white/72"
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-8 flex items-end justify-between gap-4 px-1">
                  <button
                    className="inline-flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-white/8 text-white"
                    onClick={openLibraryPicker}
                    type="button"
                  >
                    <ImageIcon className="h-5 w-5" />
                  </button>
                  <button
                    className={cn(
                      "relative inline-flex h-24 w-24 touch-none select-none items-center justify-center rounded-full border-2 border-white bg-white/12 text-white shadow-[0_18px_40px_rgba(0,0,0,0.28)]",
                      isRecordingVideo && "ring-4 ring-[#ff6b57]/35"
                    )}
                    onContextMenu={(event) => event.preventDefault()}
                    onPointerCancel={(event) => {
                      event.preventDefault();
                      event.currentTarget.releasePointerCapture?.(event.pointerId);
                      handleCapturePressCancel();
                    }}
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.currentTarget.setPointerCapture?.(event.pointerId);
                      handleCapturePressStart();
                    }}
                    onPointerLeave={(event) => {
                      if (!event.currentTarget.hasPointerCapture?.(event.pointerId)) {
                        return;
                      }

                      event.preventDefault();
                      event.currentTarget.releasePointerCapture?.(event.pointerId);
                      handleCapturePressCancel();
                    }}
                    onPointerUp={(event) => {
                      event.preventDefault();
                      event.currentTarget.releasePointerCapture?.(event.pointerId);
                      handleCapturePressEnd();
                    }}
                    style={{
                      touchAction: "none",
                      userSelect: "none",
                      WebkitTouchCallout: "none",
                      WebkitUserSelect: "none"
                    }}
                    type="button"
                  >
                    <span className={cn("inline-flex h-[4.4rem] w-[4.4rem] items-center justify-center rounded-full transition", isRecordingVideo ? "scale-90 bg-[#ff6b57]" : "bg-white text-[#1d160f]")}>
                      {isRecordingVideo ? <span className="h-7 w-7 rounded-2xl bg-white" /> : <Camera className="h-7 w-7" />}
                    </span>
                  </button>
                  <button
                    className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white disabled:opacity-40"
                    disabled={isRecordingVideo}
                    onClick={() => {
                      stopSharedCameraSessionStream();
                      setCameraFacingMode((current) => (current === "environment" ? "user" : "environment"));
                    }}
                    type="button"
                  >
                    <RefreshCw className="h-5 w-5" />
                  </button>
                </div>

                <div className="mt-4 space-y-2 text-center">
                  <p className="text-sm font-semibold text-white">
                    {captureMode === "story"
                      ? hasLiveCamera
                        ? isRecordingVideo
                          ? `Grabando historia · ${remainingRecordingLabel}`
                          : cameraFacingMode === "user"
                            ? "Camara selfie activa"
                            : "Camara trasera activa"
                        : "Usa la camara en directo o la del sistema"
                      : "Haz una foto o abre tu fototeca para publicar"}
                  </p>
                  <p className="text-xs uppercase tracking-[0.18em] text-white/60">
                    {captureMode === "story"
                      ? "Toca para foto · Mantener para video"
                      : "Toca para foto · Galeria para carrusel"}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-center">
                  <button
                    className="rounded-full border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white"
                    onClick={() => {
                      setCameraAccessError(null);
                      stopLiveStream("dispose");
                      setCameraRetryNonce((current) => current + 1);
                    }}
                    type="button"
                  >
                    Reintentar camara
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-[100dvh] flex-col items-center justify-center gap-4 px-6 text-center">
              <Camera className="h-12 w-12 text-white/72" />
              <p className="max-w-xs text-sm text-white/72">
                Intento abrir la camara al entrar. Si tu movil la bloquea, puedes reintentarlo o usar un archivo del
                sistema.
              </p>
            </div>
          )}
        </div>

        <input
          ref={libraryInputRef}
          type="file"
          accept={captureMode === "post" ? "image/*" : "image/*,video/*"}
          multiple={captureMode === "post"}
          className="hidden"
          onChange={(event) => {
            void handlePickedLibraryFiles(event.target.files);
            event.currentTarget.value = "";
          }}
        />

        <input
          ref={fallbackCaptureInputRef}
          type="file"
          accept="image/*,video/*"
          capture={cameraFacingMode}
          className="hidden"
          onChange={(event) => {
            void handlePickedStoryFile(event.target.files?.[0] ?? null);
            event.currentTarget.value = "";
          }}
        />

        {previewUrl && captureMode === "story" ? (
          <div className="absolute inset-x-4 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-30">
            <div className="rounded-[1.8rem] border border-white/10 bg-black/36 p-4 backdrop-blur">
              <div className="flex items-center gap-3 text-white/72">
                <Sparkles className="h-5 w-5" />
                <div className="text-sm font-semibold">
                  {storyMediaType === "video"
                    ? `Video listo para historia · ${Math.max(1, Math.ceil(durationMs / 1000))} s`
                    : "Historia lista para publicar"}
                </div>
              </div>
              <textarea
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                placeholder="Escribe algo..."
                className="mt-3 min-h-24 w-full rounded-[1.6rem] border border-white/10 bg-white/10 px-4 py-4 text-sm text-white outline-none placeholder:text-white/42"
              />
            </div>
          </div>
        ) : null}

        {cameraAccessError ? (
          <div className="absolute inset-x-4 bottom-[calc(8rem+env(safe-area-inset-bottom))] z-30 rounded-[1.4rem] bg-black/60 px-4 py-3 text-sm text-[#ffd0c2] backdrop-blur">{cameraAccessError}</div>
        ) : null}
      </div>
    </div>
  );
}

export function MobileMediaCreator({
  initialMode = "camera",
  onOpenEvent
}: {
  initialMode?: CreatorMode;
  onOpenEvent: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<CreatorMode>(initialMode);
  const [postSeedFiles, setPostSeedFiles] = useState<File[]>([]);
  const [postComposerKey, setPostComposerKey] = useState(0);

  const dismissCreator = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/inicio");
  };

  return mode === "post" ? (
    <PostComposer
      key={postComposerKey}
      initialFiles={postSeedFiles}
      onBack={() => {
        setPostSeedFiles([]);
        setMode("camera");
      }}
    />
  ) : (
    <CameraComposer
      onBack={dismissCreator}
      onOpenEvent={onOpenEvent}
      onOpenPostComposer={(files) => {
        setPostSeedFiles(files);
        setPostComposerKey((current) => current + 1);
        setMode("post");
      }}
    />
  );
}
