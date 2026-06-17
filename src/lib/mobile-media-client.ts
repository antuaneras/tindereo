"use client";

const STORY_MAX_VIDEO_MS = 20_000;

type ImageCompressionOptions = {
  maxHeight: number;
  maxWidth: number;
  quality: number;
};

function loadImageFromFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No se pudo leer la imagen seleccionada."));
    };

    image.src = objectUrl;
  });
}

async function canvasToFile(canvas: HTMLCanvasElement, name: string, quality: number) {
  return new Promise<File>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("No se pudo preparar la imagen."));
          return;
        }

        resolve(
          new File([blob], name.replace(/\.[^.]+$/, "") + ".jpg", {
            type: "image/jpeg"
          })
        );
      },
      "image/jpeg",
      quality
    );
  });
}

export function createObjectPreviewUrl(file: Blob) {
  return typeof window === "undefined" ? "" : URL.createObjectURL(file);
}

export function revokeObjectPreviewUrl(value?: string | null) {
  if (!value || typeof window === "undefined" || !value.startsWith("blob:")) {
    return;
  }

  URL.revokeObjectURL(value);
}

export async function compressImageFile(file: File, options: ImageCompressionOptions) {
  const image = await loadImageFromFile(file);
  const ratio = Math.min(1, options.maxWidth / image.width, options.maxHeight / image.height);
  const width = Math.max(1, Math.round(image.width * ratio));
  const height = Math.max(1, Math.round(image.height * ratio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    return file;
  }

  context.drawImage(image, 0, 0, width, height);
  return canvasToFile(canvas, file.name || `image-${Date.now()}.jpg`, options.quality);
}

export async function compressPostImages(files: File[]) {
  const limited = files.filter((file) => file.type.startsWith("image/")).slice(0, 20);
  return Promise.all(
    limited.map((file) =>
      compressImageFile(file, {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.8
      })
    )
  );
}

export async function prepareStoryFile(file: File) {
  if (file.type.startsWith("video/")) {
    const durationMs = await readVideoDurationFromFile(file);
    if (durationMs > STORY_MAX_VIDEO_MS) {
      throw new Error("La historia en video no puede durar mas de 20 segundos.");
    }

    return {
      durationMs,
      file,
      mediaType: "video" as const
    };
  }

  return {
    durationMs: 5000,
    file: await compressImageFile(file, {
      maxWidth: 1080,
      maxHeight: 1920,
      quality: 0.76
    }),
    mediaType: "image" as const
  };
}

export async function readVideoDurationFromFile(file: File) {
  return new Promise<number>((resolve, reject) => {
    if (typeof document === "undefined") {
      resolve(STORY_MAX_VIDEO_MS);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const video = document.createElement("video");

    const cleanup = () => {
      URL.revokeObjectURL(objectUrl);
      video.removeAttribute("src");
      video.load();
    };

    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const durationMs = Number.isFinite(video.duration) ? Math.round(video.duration * 1000) : 0;
      cleanup();
      resolve(durationMs);
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("No se pudo leer la duracion del video."));
    };
    video.src = objectUrl;
  });
}

export function getSupportedRecordingMimeType() {
  if (typeof MediaRecorder === "undefined") {
    return "";
  }

  const candidates = [
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm"
  ];

  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "";
}

export async function captureVideoFrameToFile(video: HTMLVideoElement) {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("No se ha podido capturar la foto.");
  }

  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvasToFile(canvas, `capture-${Date.now()}.jpg`, 0.82);
}

export { STORY_MAX_VIDEO_MS };
