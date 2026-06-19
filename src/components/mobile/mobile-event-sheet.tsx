"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarPlus, Download, Link2, MapPin, QrCode, Share2, Ticket, UserPlus, Users, X } from "lucide-react";
import {
  addEventCohost,
  fetchEventTicket,
  inviteFriendToEvent,
  joinEvent,
  moderateEventMember,
  reportEventMember,
  setArrivalStatus,
  setEventChatMode,
  setEventMemberStaffRoles,
  submitCheckInToken
} from "@/lib/mobile-api";
import { StoryStrip, PostCard } from "@/components/mobile/mobile-feed";
import { formatMobileDateTime, getArrivalStatusLabel, getMapLink } from "@/lib/mobile-shared";
import type { MobileConversationDetail, MobileEventDetail, MobileEventTicket, MobileProfile, MobileProfileMini } from "@/lib/mobile-types";

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function Avatar({ profile }: { profile: Pick<MobileProfile, "handle" | "avatarUrl"> | MobileProfileMini }) {
  if (profile.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={profile.avatarUrl} alt={`@${profile.handle}`} className="h-11 w-11 rounded-full object-cover" />
    );
  }

  return (
    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--bg-soft)] text-xs font-semibold text-[var(--text-main)]">
      {profile.handle.slice(0, 2).toUpperCase()}
    </span>
  );
}

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function formatIcsDate(value: string) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function buildEventShareUrl(slug: string) {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/evento/${slug}`;
  }

  return `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/evento/${slug}`;
}

type BarcodeDetectorLike = {
  detect: (input: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

let sharedScannerCameraSessionStream: MediaStream | null = null;
let sharedScannerCameraSessionFacingMode: "environment" | "user" | null = null;

function stopSharedScannerCameraSessionStream() {
  sharedScannerCameraSessionStream?.getTracks().forEach((track) => track.stop());
  sharedScannerCameraSessionStream = null;
  sharedScannerCameraSessionFacingMode = null;
}

function getReusableScannerCameraSessionStream(facingMode: "environment" | "user") {
  if (
    !sharedScannerCameraSessionStream ||
    sharedScannerCameraSessionFacingMode !== facingMode ||
    sharedScannerCameraSessionStream.getTracks().every((track) => track.readyState === "ended")
  ) {
    if (sharedScannerCameraSessionStream?.getTracks().every((track) => track.readyState === "ended")) {
      stopSharedScannerCameraSessionStream();
    }

    return null;
  }

  sharedScannerCameraSessionStream.getVideoTracks().forEach((track) => {
    track.enabled = true;
  });

  return sharedScannerCameraSessionStream;
}

function parkScannerCameraSessionStream(stream: MediaStream | null) {
  if (!stream) {
    return;
  }

  sharedScannerCameraSessionStream = stream;
  stream.getVideoTracks().forEach((track) => {
    track.enabled = false;
  });
}

function getBarcodeDetectorCtor() {
  if (typeof window === "undefined") {
    return null;
  }

  return (window as Window & { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector ?? null;
}

function normalizeScannedToken(rawValue: string) {
  const trimmed = rawValue.trim();
  if (!trimmed) {
    return "";
  }

  const extractTicketValue = (value: string, baseUrl?: string) => {
    try {
      const parsedUrl = baseUrl ? new URL(value, baseUrl) : new URL(value);
      return parsedUrl.searchParams.get("entry") ?? parsedUrl.searchParams.get("checkin");
    } catch {
      return null;
    }
  };

  const extractedValue =
    extractTicketValue(trimmed) ??
    extractTicketValue(trimmed, typeof window !== "undefined" ? window.location.origin : "https://tindereo.local");

  if (extractedValue) {
    return extractedValue;
  }

  try {
    return new URL(trimmed).toString();
  } catch {
    return trimmed;
  }
}

function getScanReadyMessage(barcodeDetectorCtor: BarcodeDetectorCtor | null) {
  return barcodeDetectorCtor
    ? "Apunta al QR para validar acceso."
    : "Camara lista. Si tu navegador no detecta QR en vivo, pega el codigo debajo.";
}

function formatStaffRoleLabel(role: "moderator" | "scanner") {
  return role === "moderator" ? "Moderador" : "Escaner";
}

async function urlToDataUrl(url: string) {
  const response = await fetch(url);
  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No pude preparar la imagen."));
    reader.readAsDataURL(blob);
  });
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function EventTicketPreview({
  event,
  ticket,
  onClose,
  onDownload,
  onCalendar,
  onShare
}: {
  event: MobileEventDetail["event"];
  ticket: MobileEventTicket;
  onClose: () => void;
  onDownload: () => Promise<void>;
  onCalendar: () => void;
  onShare: () => Promise<void>;
}) {
  const [qrFocusOpen, setQrFocusOpen] = useState(false);
  const isTicketActive = ticket.status === "active";
  const ticketStatusLabel =
    ticket.status === "used"
      ? "Entrada usada"
      : ticket.status === "expired"
        ? "Entrada caducada"
        : ticket.status === "invalid"
          ? "Entrada invalida"
          : "Entrada activa";
  const ticketStatusDescription =
    ticket.status === "used"
      ? `Escaneada ${formatMobileDateTime(ticket.scannedAt ?? ticket.validUntil)}${ticket.scannedByHandle ? ` por ${ticket.scannedByHandle}` : ""}.`
      : ticket.status === "expired"
        ? "Ya no se puede volver a usar porque ha caducado."
        : ticket.status === "invalid"
          ? ticket.invalidReason || "Esta entrada ya no es valida."
          : `Valida hasta ${formatMobileDateTime(ticket.validUntil)}`;

  return (
    <>
      <div
        className="fixed inset-0 z-[70] bg-black/65 px-4 py-[calc(0.5rem+env(safe-area-inset-top))] pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
        onClick={onClose}
      >
        <div
          className="mx-auto flex h-full w-full max-w-[480px] flex-col overflow-hidden rounded-[2rem] bg-[var(--bg-main)] shadow-2xl"
          onClick={(eventMouse) => eventMouse.stopPropagation()}
        >
        <div className="relative min-h-[172px] overflow-hidden bg-[var(--text-main)]">
          {event.coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.coverImage} alt={event.title} className="h-full w-full object-cover opacity-75" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-black/25 to-black/80" />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="absolute inset-x-0 bottom-0 px-5 pb-4 text-white">
            <div className="text-xs uppercase tracking-[0.24em] text-white/70">{ticket.roleLabel}</div>
            <div className="mt-2 text-[2rem] font-black leading-8 tracking-[-0.04em]">{event.title}</div>
            <div className="mt-2 text-sm text-white/80">{formatMobileDateTime(event.startsAt)} · {event.city}</div>
          </div>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
          <div className="rounded-[2rem] border border-[var(--line-soft)] bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-[0.22em] text-[var(--text-soft)]">Titular</div>
                <div className="mt-2 text-lg font-bold">{ticket.holderLabel}</div>
                <div className="mt-1 text-sm text-[var(--text-soft)]">{event.venue}</div>
              </div>
              <div className="rounded-full bg-[rgba(255,107,87,0.1)] px-3 py-2 text-xs font-semibold text-[var(--coral)]">
                {ticket.ticketCode}
              </div>
            </div>

            {isTicketActive ? (
              <button
                type="button"
                onClick={() => setQrFocusOpen(true)}
                className="mt-4 block w-full rounded-[1.8rem] bg-[var(--bg-soft)] p-4"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ticket.qrImageUrl} alt="QR de entrada" className="mx-auto h-48 w-48 rounded-[1.5rem] bg-white p-3" />
                <div className="mt-3 text-center text-xs text-[var(--text-soft)]">{ticketStatusDescription}</div>
                <div className="mt-2 text-center text-xs font-semibold text-[var(--coral)]">Tocar para ampliar QR</div>
              </button>
            ) : (
              <div className="mt-4 rounded-[1.8rem] border border-[var(--line-soft)] bg-[var(--bg-soft)] px-4 py-6 text-center">
                <div className="text-sm font-semibold">{ticketStatusLabel}</div>
                <div className="mt-2 text-sm text-[var(--text-soft)]">{ticketStatusDescription}</div>
              </div>
            )}
          </div>

          <div className="mt-auto grid grid-cols-3 gap-3 bg-[var(--bg-main)] pb-1 pt-4">
            <button type="button" disabled={!isTicketActive} onClick={() => void onShare()} className="rounded-[1.4rem] border border-[var(--line-soft)] bg-white px-3 py-4 text-center shadow-sm disabled:opacity-45">
              <Share2 className="mx-auto h-5 w-5 text-[var(--coral)]" />
              <div className="mt-2 text-xs font-semibold">Compartir</div>
            </button>
            <button type="button" disabled={!isTicketActive} onClick={() => void onDownload()} className="rounded-[1.4rem] border border-[var(--line-soft)] bg-white px-3 py-4 text-center shadow-sm disabled:opacity-45">
              <Download className="mx-auto h-5 w-5 text-[var(--coral)]" />
              <div className="mt-2 text-xs font-semibold">Guardar</div>
            </button>
            <button type="button" onClick={onCalendar} className="rounded-[1.4rem] border border-[var(--line-soft)] bg-white px-3 py-4 text-center shadow-sm">
              <CalendarPlus className="mx-auto h-5 w-5 text-[var(--coral)]" />
              <div className="mt-2 text-xs font-semibold">Calendario</div>
            </button>
          </div>
        </div>
      </div>
      </div>

      {qrFocusOpen ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/92 px-5" onClick={() => setQrFocusOpen(false)}>
          <div
            className="w-full max-w-[420px] rounded-[2rem] bg-white p-6 text-center"
            onClick={(eventMouse) => eventMouse.stopPropagation()}
          >
            <div className="text-xs uppercase tracking-[0.22em] text-[var(--text-soft)]">{ticket.roleLabel}</div>
            <div className="mt-2 text-2xl font-black tracking-[-0.04em]">{event.title}</div>
            <div className="mt-1 text-sm text-[var(--text-soft)]">{ticket.ticketCode}</div>
            <div className="mt-5 rounded-[1.8rem] bg-[var(--bg-soft)] p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ticket.qrImageUrl} alt="QR ampliado de entrada" className="mx-auto h-[78vw] max-h-[320px] w-[78vw] max-w-[320px] rounded-[1.5rem] bg-white p-3" />
            </div>
            <div className="mt-4 text-xs text-[var(--text-soft)]">{ticketStatusDescription}</div>
            <button
              type="button"
              onClick={() => setQrFocusOpen(false)}
              className="mt-5 rounded-full bg-[var(--text-main)] px-5 py-3 text-sm font-semibold text-white"
            >
              Cerrar
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function EventInfoSheet({
  conversation,
  eventDetail,
  loading = false,
  onClose,
  onRefresh
}: {
  conversation: MobileConversationDetail;
  eventDetail: MobileEventDetail | null;
  loading?: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [tab, setTab] = useState<"live" | "info" | "people" | "stories" | "faq" | "scan">("live");
  const [ticket, setTicket] = useState<MobileEventTicket | null>(null);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [loadingTicket, setLoadingTicket] = useState(false);
  const [invitingUserId, setInvitingUserId] = useState<string | null>(null);
  const [moderatingUserId, setModeratingUserId] = useState<string | null>(null);
  const [reportingUserId, setReportingUserId] = useState<string | null>(null);
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState<string | null>(null);
  const [sharingEvent, setSharingEvent] = useState(false);
  const [manualScanValue, setManualScanValue] = useState("");
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanStreamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);
  const scanLockRef = useRef(false);
  const onRefreshRef = useRef(onRefresh);
  const myMembership = eventDetail?.myMembership ?? null;
  const isInside = myMembership?.arrivalStatus === "inside";
  const storyClusters = useMemo(
    () =>
      eventDetail?.stories.length
        ? [
            {
              ownerId: eventDetail.event.id,
              ownerType: "event" as const,
              ownerLabel: eventDetail.event.title,
              ownerAvatarUrl: eventDetail.event.coverImage,
              unseenCount: eventDetail.stories.filter((story) => !story.hasSeen).length,
              stories: eventDetail.stories
            }
          ]
        : [],
    [eventDetail]
  );
  const viewerProfile =
    conversation.participants.find((participant) => participant.id === conversation.viewerId) ?? eventDetail?.host ?? null;

  if (!eventDetail) {
    return (
      <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose}>
        <div
          className="absolute bottom-0 left-1/2 flex h-[88dvh] w-full max-w-[480px] -translate-x-1/2 flex-col rounded-t-[2rem] bg-[var(--bg-main)]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 pb-4 pt-4">
            <div>
              <div className="h-6 w-36 rounded-full bg-white/80 shadow-sm" />
              <div className="mt-2 h-4 w-24 rounded-full bg-white/70 shadow-sm" />
            </div>
            <button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full bg-white">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 space-y-4 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
            <div className="rounded-[1.8rem] border border-[var(--line-soft)] bg-white px-4 py-4">
              <div className="text-sm text-[var(--text-soft)]">
                {loading ? "Cargando informacion del evento..." : "No pude cargar la informacion del evento."}
              </div>
            </div>
            <div className="h-24 rounded-[1.8rem] bg-white/80 shadow-sm" />
            <div className="h-28 rounded-[1.8rem] bg-white/80 shadow-sm" />
            <div className="h-40 rounded-[1.8rem] bg-white/80 shadow-sm" />
          </div>
        </div>
      </div>
    );
  }

  const event = eventDetail.event;
  const canManage = eventDetail.canManage;
  const canModerateMembers = eventDetail.canModerateMembers;
  const canScan = eventDetail.canScan;
  const eventShareUrl = buildEventShareUrl(event.slug);
  const mapLink = getMapLink(
    event.meetingPointAddress,
    event.meetingPointLat,
    event.meetingPointLng
  );
  const canUseTicket = myMembership?.status === "approved" || canManage;

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  async function ensureTicket() {
    if (ticket) {
      return ticket;
    }

    setLoadingTicket(true);
    try {
      const nextTicket = await fetchEventTicket(event.slug);
      setTicket(nextTicket);
      return nextTicket;
    } finally {
      setLoadingTicket(false);
    }
  }

  async function handleOpenTicket() {
    const nextTicket = await ensureTicket();
    if (nextTicket) {
      setTicketOpen(true);
    }
  }

  async function handleShareTicket() {
    const nextTicket = await ensureTicket();
    if (!nextTicket) {
      return;
    }

    const sharePayload = {
      title: `Entrada para ${event.title}`,
      text: `${ticket?.roleLabel ?? "Entrada"} - ${event.title}`,
      url: nextTicket.shareUrl
    };

    if (navigator.share) {
      await navigator.share(sharePayload);
      return;
    }

    await navigator.clipboard.writeText(nextTicket.shareUrl);
  }

  async function handleShareEvent() {
    const sharePayload = {
      title: event.title,
      text: `${event.summary || event.title} · ${event.city}`,
      url: eventShareUrl
    };

    setSharingEvent(true);
    try {
      if (navigator.share) {
        await navigator.share(sharePayload);
        return;
      }

      await navigator.clipboard.writeText(eventShareUrl);
    } finally {
      setSharingEvent(false);
    }
  }

  async function handleWhatsAppShare() {
    const message = `${event.title} · ${event.city}\n${eventShareUrl}`;
    if (typeof window !== "undefined") {
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
    }
  }

  async function handleCopyEventLink() {
    await navigator.clipboard.writeText(eventShareUrl);
  }

  function handleDownloadCalendar() {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Tindereo//Evento//ES",
      "BEGIN:VEVENT",
      `UID:${event.id}@tindereo`,
      `DTSTAMP:${formatIcsDate(new Date().toISOString())}`,
      `DTSTART:${formatIcsDate(event.startsAt)}`,
      `DTEND:${formatIcsDate(event.endsAt)}`,
      `SUMMARY:${escapeIcsText(event.title)}`,
      `DESCRIPTION:${escapeIcsText(event.description || event.summary)}`,
      `LOCATION:${escapeIcsText(event.meetingPointAddress || event.venue)}`,
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n");

    triggerDownload(
      new Blob([ics], { type: "text/calendar;charset=utf-8" }),
      `${event.slug}.ics`
    );
  }

  async function handleDownloadTicket() {
    const nextTicket = await ensureTicket();
    if (!nextTicket) {
      return;
    }

    const qrDataUrl = await urlToDataUrl(nextTicket.qrImageUrl);
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <rect width="1080" height="1920" fill="#F6EFE7"/>
  <rect x="60" y="60" width="960" height="1800" rx="64" fill="#FFFFFF"/>
  <rect x="60" y="60" width="960" height="460" rx="64" fill="#1F1714"/>
  <text x="120" y="160" font-size="34" font-family="Arial, sans-serif" fill="#F2C8B6" letter-spacing="6">${escapeXml(nextTicket.roleLabel.toUpperCase())}</text>
  <text x="120" y="240" font-size="76" font-weight="700" font-family="Arial, sans-serif" fill="#FFFFFF">${escapeXml(event.title)}</text>
  <text x="120" y="320" font-size="34" font-family="Arial, sans-serif" fill="#E7DDD4">${escapeXml(formatMobileDateTime(event.startsAt))}</text>
  <text x="120" y="372" font-size="34" font-family="Arial, sans-serif" fill="#E7DDD4">${escapeXml(event.meetingPointAddress || event.venue)}</text>
  <rect x="120" y="590" width="840" height="980" rx="52" fill="#F6EFE7"/>
  <image href="${qrDataUrl}" x="240" y="700" width="600" height="600" preserveAspectRatio="xMidYMid slice"/>
  <text x="540" y="1360" text-anchor="middle" font-size="40" font-family="Arial, sans-serif" fill="#2A211D">${escapeXml(nextTicket.ticketCode)}</text>
  <text x="540" y="1440" text-anchor="middle" font-size="30" font-family="Arial, sans-serif" fill="#7A665B">${escapeXml(nextTicket.holderLabel)}</text>
  <text x="540" y="1510" text-anchor="middle" font-size="26" font-family="Arial, sans-serif" fill="#9A857A">Valida hasta ${escapeXml(formatMobileDateTime(nextTicket.validUntil))}</text>
</svg>`;

    triggerDownload(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
      `${event.slug}-entrada.svg`
    );
  }

  function detachScannerVideoElement() {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
  }

  function stopScannerCamera(mode: "dispose" | "park" = "dispose") {
    if (scanIntervalRef.current !== null) {
      window.clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    const stream = scanStreamRef.current;

    if (mode === "park") {
      parkScannerCameraSessionStream(stream);
    } else if (stream && sharedScannerCameraSessionStream === stream) {
      stopSharedScannerCameraSessionStream();
    } else {
      stream?.getTracks().forEach((track) => track.stop());
    }

    scanStreamRef.current = null;
    detachScannerVideoElement();
    setCameraReady(false);
  }

  useEffect(() => {
    return () => {
      stopSharedScannerCameraSessionStream();
    };
  }, []);

  async function handleResolveScannedValue(rawValue: string) {
    const token = normalizeScannedToken(rawValue);
    if (!token || scanLockRef.current) {
      return;
    }

    scanLockRef.current = true;
    setScanBusy(true);
    setScanError(null);
    setScanMessage("Validando entrada...");

    try {
      const result = await submitCheckInToken(token, event.id);

      setManualScanValue("");
      setScanMessage(`${result.attendeeHandle} dentro. QR invalidado.`);
      await onRefreshRef.current();
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "No pude validar esta entrada.");
    } finally {
      setScanBusy(false);
      window.setTimeout(() => {
        scanLockRef.current = false;
      }, 900);
    }
  }

  useEffect(() => {
    if (typeof window === "undefined" || tab !== "scan" || !canScan) {
      stopScannerCamera();
      return;
    }

    let cancelled = false;
    const barcodeDetectorCtor = getBarcodeDetectorCtor();

    async function startScanner() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setScanError("Tu navegador no deja abrir la camara. Puedes pegar el codigo manualmente.");
        return;
      }

      const reusableStream = getReusableScannerCameraSessionStream("environment");
      if (reusableStream) {
        scanStreamRef.current = reusableStream;
        setCameraReady(true);
        setScanError(null);
        setScanMessage(getScanReadyMessage(barcodeDetectorCtor));
        return;
      }

      stopScannerCamera("dispose");

      try {
        let stream: MediaStream;

        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: { ideal: "environment" },
              aspectRatio: { ideal: 4 / 5 },
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

        scanStreamRef.current = stream;
        sharedScannerCameraSessionStream = stream;
        sharedScannerCameraSessionFacingMode = "environment";

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

        setCameraReady(true);
        setScanError(null);
        setScanMessage(getScanReadyMessage(barcodeDetectorCtor));
      } catch {
        setScanError("No pude abrir la camara. Revisa permisos o usa el pegado manual.");
      }
    }

    void startScanner();

    return () => {
      cancelled = true;
      stopScannerCamera("park");
    };
  }, [canScan, event.id, tab]);

  useEffect(() => {
    if (typeof window === "undefined" || tab !== "scan" || !canScan || !cameraReady) {
      return undefined;
    }

    let cancelled = false;

    const bindScannerPreview = async () => {
      const video = videoRef.current;
      const stream = scanStreamRef.current;

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
          setScanError(null);
        }
      } catch {
        if (!cancelled) {
          setScanError("He pedido acceso a la camara pero el movil no ha mostrado la preview.");
        }
      }
    };

    void bindScannerPreview();

    return () => {
      cancelled = true;
    };
  }, [cameraReady, canScan, tab]);

  useEffect(() => {
    if (typeof window === "undefined" || tab !== "scan" || !canScan || !cameraReady) {
      if (scanIntervalRef.current !== null) {
        window.clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
      return undefined;
    }

    const barcodeDetectorCtor = getBarcodeDetectorCtor();
    if (!barcodeDetectorCtor) {
      return undefined;
    }

    const detector = new barcodeDetectorCtor({ formats: ["qr_code"] });
    scanIntervalRef.current = window.setInterval(async () => {
      if (scanLockRef.current || !videoRef.current || videoRef.current.readyState < 2) {
        return;
      }

      try {
        const results = await detector.detect(videoRef.current);
        const rawValue = results[0]?.rawValue?.trim();
        if (rawValue) {
          void handleResolveScannedValue(rawValue);
        }
      } catch {
        // Keep trying while the camera is alive.
      }
    }, 700);

    return () => {
      if (scanIntervalRef.current !== null) {
        window.clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    };
  }, [cameraReady, canScan, event.id, tab]);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose}>
        <div
          className="absolute bottom-0 left-1/2 flex h-[88dvh] w-full max-w-[480px] -translate-x-1/2 flex-col rounded-t-[2rem] bg-[var(--bg-main)]"
          onClick={(event) => event.stopPropagation()}
        >
        <div className="flex items-center justify-between px-4 pb-4 pt-4">
          <div>
            <div className="text-lg font-black tracking-[-0.03em]">{event.title}</div>
            <div className="text-sm text-[var(--text-soft)]">{event.city}</div>
          </div>
          <button type="button" onClick={onClose} className="flex h-11 w-11 items-center justify-center rounded-full bg-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="scrollbar-hide flex gap-2 overflow-x-auto px-4 pb-2">
          {[
            ["live", "En vivo"],
            ["info", "Info"],
            ["people", "Miembros"],
            ["stories", "Historias"],
            ["faq", "FAQ"],
            ...(canScan ? ([["scan", "Escanear"]] as const) : [])
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value as typeof tab)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold",
                tab === value ? "bg-[var(--text-main)] text-white" : "bg-white text-[var(--text-soft)]"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
          {tab === "live" ? (
            <div className="space-y-4">
              <section className="grid grid-cols-3 gap-3">
                {[
                  ["Dentro", `${event.insideCount}`],
                  ["Confirmados", `${event.approvedCount}`],
                  ["Cola", `${event.waitlistCount}`]
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[1.6rem] border border-[var(--line-soft)] bg-white px-4 py-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-[var(--text-soft)]">{label}</div>
                    <div className="mt-3 text-2xl font-black tracking-[-0.04em]">{value}</div>
                  </div>
                ))}
              </section>
              {canManage && eventDetail.hostMetrics ? (
                <section className="rounded-[1.8rem] border border-[var(--line-soft)] bg-white px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">Panel host</div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {[
                      ["Invitaciones", `${eventDetail.hostMetrics.inviteCount}`],
                      ["Aceptadas", `${eventDetail.hostMetrics.acceptedInviteCount}`],
                      ["Pendientes", `${eventDetail.hostMetrics.pendingInviteCount}`],
                      ["Check-ins", `${eventDetail.hostMetrics.checkedInCount}`],
                      ["Conversion", `${eventDetail.hostMetrics.inviteConversionRate}%`],
                      ["Impacto", `${eventDetail.hostMetrics.storyReachCount + eventDetail.hostMetrics.contentInteractionCount}`]
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-[1.3rem] bg-[var(--bg-soft)] px-4 py-3">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">{label}</div>
                        <div className="mt-2 text-xl font-black tracking-[-0.04em]">{value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-[1.3rem] bg-[var(--bg-soft)] px-4 py-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--text-soft)]">Recordatorios</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[
                        ["24h", eventDetail.hostMetrics.reminder24hCount],
                        ["2h", eventDetail.hostMetrics.reminder2hCount],
                        ["Live", eventDetail.hostMetrics.liveReminderCount]
                      ].map(([label, value]) => (
                        <span
                          key={String(label)}
                          className="rounded-full bg-white px-3 py-2 text-xs font-semibold text-[var(--text-main)]"
                        >
                          {label}: {value}
                        </span>
                      ))}
                    </div>
                  </div>
                </section>
              ) : null}
              <section className="rounded-[1.8rem] border border-[var(--line-soft)] bg-white px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">Estado de llegada</div>
                <div className="mt-3 text-sm text-[var(--text-soft)]">{getArrivalStatusLabel(myMembership?.arrivalStatus ?? "none")}</div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    ["going", "Voy saliendo"],
                    ["eta20", "Llego en 20"],
                    ["inside", "Ya estoy dentro"]
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={async () => {
                        await setArrivalStatus(event.slug, value);
                        await onRefresh();
                      }}
                      className={cn(
                        "rounded-2xl border px-3 py-3 text-xs font-semibold",
                        myMembership?.arrivalStatus === value
                          ? "border-[rgba(255,107,87,0.26)] bg-[rgba(255,107,87,0.08)] text-[var(--coral)]"
                          : "border-[var(--line-warm)] bg-[var(--bg-soft)] text-[var(--text-main)]"
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </section>
              <section className="rounded-[1.8rem] border border-[var(--line-soft)] bg-white px-4 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">Punto de encuentro</div>
                      <div className="mt-2 text-base font-bold">{event.meetingPointLabel || event.venue}</div>
                      <div className="mt-1 text-sm text-[var(--text-soft)]">{event.meetingPointAddress || event.venue}</div>
                  </div>
                  <MapPin className="h-5 w-5 text-[var(--coral)]" />
                </div>
                {mapLink ? (
                  <a
                    href={mapLink}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex rounded-full bg-[var(--text-main)] px-4 py-2 text-sm font-semibold text-white"
                  >
                    Abrir en Mapas
                  </a>
                ) : null}
              </section>
              <section className="rounded-[1.8rem] border border-[var(--line-soft)] bg-white px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">Compartir evento</div>
                    <div className="mt-2 text-sm text-[var(--text-soft)]">
                      Enlace limpio para WhatsApp, share sheet del movil o copiar y pegar donde quieras.
                    </div>
                  </div>
                  <Share2 className="h-5 w-5 text-[var(--coral)]" />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={sharingEvent}
                    onClick={() => void handleShareEvent()}
                    className="rounded-full bg-[var(--text-main)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {sharingEvent ? "Abriendo..." : "Compartir"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleWhatsAppShare()}
                    className="rounded-full border border-[var(--line-warm)] px-4 py-2 text-sm font-semibold"
                  >
                    WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCopyEventLink()}
                    className="rounded-full border border-[var(--line-warm)] px-4 py-2 text-sm font-semibold"
                  >
                    Copiar enlace
                  </button>
                </div>
              </section>
              {event.experienceState === "afterglow" ? (
                <section className="rounded-[1.8rem] border border-[rgba(255,107,87,0.16)] bg-[rgba(255,107,87,0.06)] px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">Recap activo</div>
                  <div className="mt-2 text-base font-bold">El evento ya ha acabado, pero el post-evento sigue vivo.</div>
                  <div className="mt-2 text-sm leading-6 text-[var(--text-soft)]">
                    Chat, fotos, historias y album compartido abiertos hasta {formatMobileDateTime(event.recapEndsAt)}.
                  </div>
                </section>
              ) : null}
              {canUseTicket ? (
                <section className="rounded-[1.8rem] border border-[var(--line-soft)] bg-white px-4 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">Entrada digital</div>
                      <div className="mt-2 text-sm text-[var(--text-soft)]">
                        Llévala dentro de la app, compártela o guárdala mientras no usemos Wallet.
                      </div>
                    </div>
                    <Ticket className="h-5 w-5 text-[var(--coral)]" />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleOpenTicket()}
                      disabled={loadingTicket}
                      className="rounded-full bg-[var(--text-main)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {loadingTicket ? "Preparando..." : "Ver entrada"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleShareTicket()}
                      disabled={loadingTicket}
                      className="rounded-full border border-[var(--line-warm)] px-4 py-2 text-sm font-semibold disabled:opacity-60"
                    >
                      Compartir
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadCalendar}
                      className="rounded-full border border-[var(--line-warm)] px-4 py-2 text-sm font-semibold"
                    >
                      Calendario
                    </button>
                  </div>
                </section>
              ) : myMembership?.status === "pending" ? (
                <div className="rounded-[1.6rem] border border-dashed border-[var(--line-warm)] bg-white/80 px-4 py-4 text-sm text-[var(--text-soft)]">
                  Cuando te aprueben en el evento, aquí te aparecerá tu entrada digital.
                </div>
              ) : null}
              {canScan ? (
                <section className="rounded-[1.8rem] border border-[var(--line-soft)] bg-white px-4 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">Control de acceso</div>
                      <div className="mt-2 text-sm text-[var(--text-soft)]">Usa la pestana Escanear para validar asistentes y bloquear el QR al primer uso.</div>
                    </div>
                    <QrCode className="h-5 w-5 text-[var(--coral)]" />
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setTab("scan")}
                      className="rounded-full bg-[var(--text-main)] px-4 py-2 text-sm font-semibold text-white"
                    >
                      Abrir escaner
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await setEventChatMode(
                          event.slug,
                          event.chatMode === "open" ? "announcements" : "open"
                        );
                        await onRefresh();
                      }}
                      className="rounded-full border border-[var(--line-warm)] px-4 py-2 text-sm font-semibold"
                    >
                      Chat {event.chatMode === "open" ? "abierto" : "solo staff"}
                    </button>
                  </div>
                </section>
              ) : null}
              {!myMembership ? (
                <button
                  type="button"
                  onClick={async () => {
                    await joinEvent(event.slug);
                    await onRefresh();
                  }}
                  className="tindereo-gradient w-full rounded-[1.6rem] px-4 py-4 text-base font-bold text-white"
                >
                  Pedir acceso
                </button>
              ) : null}
              {isInside ? (
                <div className="rounded-[1.6rem] border border-[rgba(42,168,118,0.22)] bg-[rgba(42,168,118,0.08)] px-4 py-4 text-sm text-[var(--green)]">
                  Check-in hecho. Ya sales como dentro.
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === "info" ? (
            <div className="space-y-4">
              <section className="rounded-[1.8rem] border border-[var(--line-soft)] bg-white px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">Cuando</div>
                <div className="mt-2 text-base font-bold">{formatMobileDateTime(event.startsAt)}</div>
                <p className="mt-4 text-sm leading-6 text-[var(--text-soft)]">{event.description}</p>
              </section>
              <section className="grid grid-cols-2 gap-3">
                <div className="rounded-[1.6rem] border border-[var(--line-soft)] bg-white px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">Aforo</div>
                  <div className="mt-2 text-2xl font-black tracking-[-0.04em]">
                    {event.approvedCount}/{event.capacity}
                  </div>
                  <div className="mt-1 text-xs text-[var(--text-soft)]">{event.waitlistCount} en espera</div>
                </div>
                <div className="rounded-[1.6rem] border border-[var(--line-soft)] bg-white px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">Modo</div>
                  <div className="mt-2 text-base font-bold">
                    {event.visibility === "private" ? "Privado" : "Publico"}
                  </div>
                  <div className="mt-1 text-xs text-[var(--text-soft)]">
                    {event.chatMode === "announcements" ? "Solo admins" : "Chat abierto"}
                  </div>
                </div>
              </section>
              <section className="rounded-[1.8rem] border border-[var(--line-soft)] bg-white px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">Staff</div>
                <div className="mt-3 flex items-center gap-3 rounded-[1.4rem] bg-[var(--bg-soft)] px-3 py-3">
                  <Avatar profile={eventDetail.host} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">@{eventDetail.host.handle}</div>
                    <div className="text-xs text-[var(--text-soft)]">Creador del evento</div>
                  </div>
                </div>
                {eventDetail.cohosts.map((cohost) => (
                  <div key={cohost.id} className="mt-2 flex items-center gap-3 rounded-[1.4rem] bg-[var(--bg-soft)] px-3 py-3">
                    <Avatar profile={cohost} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">@{cohost.handle}</div>
                      <div className="text-xs text-[var(--text-soft)]">Coorganizador</div>
                    </div>
                  </div>
                ))}
                {!eventDetail.cohosts.length ? (
                  <div className="mt-3 text-sm text-[var(--text-soft)]">Todavia no hay coorganizadores asignados.</div>
                ) : null}
              </section>
              <section className="rounded-[1.8rem] border border-[var(--line-soft)] bg-white px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">Normas</div>
                <div className="mt-3 space-y-2">
                  {event.rules.length ? event.rules.map((rule) => (
                    <div key={rule} className="rounded-2xl bg-[var(--bg-soft)] px-4 py-3 text-sm leading-6">{rule}</div>
                  )) : <div className="text-sm text-[var(--text-soft)]">Aún sin normas cargadas.</div>}
                </div>
              </section>
              {event.playlistUrl ? (
                <a href={event.playlistUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-[var(--text-main)] px-4 py-2 text-sm font-semibold text-white">
                  <Link2 className="h-4 w-4" />
                  Abrir playlist
                </a>
              ) : null}
            </div>
          ) : null}

          {tab === "people" ? (
            <div className="space-y-3">
              <div className="rounded-[1.8rem] border border-[var(--line-soft)] bg-white px-4 py-4 text-sm text-[var(--text-soft)]">
                <div className="mb-2 flex items-center gap-2 text-[var(--text-main)]">
                  <Users className="h-4 w-4" />
                  {eventDetail.participants.length} personas visibles
                </div>
                {!eventDetail.participants.length
                  ? "Hasta que no estes dentro no se expone la lista completa."
                  : "Host, cohosts, gente aprobada y estados visibles para staff."}
              </div>
              {eventDetail.canInviteFriends && eventDetail.inviteCandidates.length ? (
                <section className="rounded-[1.8rem] border border-[var(--line-soft)] bg-white px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">
                        Invitar amistades
                      </div>
                      <div className="mt-2 text-sm text-[var(--text-soft)]">
                        Queda trazado quien invita a quien y la otra persona acepta en un toque.
                      </div>
                    </div>
                    <UserPlus className="h-5 w-5 text-[var(--coral)]" />
                  </div>
                  <div className="mt-4 space-y-2">
                    {eventDetail.inviteCandidates.slice(0, 8).map((profile) => {
                      const isBusy = invitingUserId === profile.id;
                      return (
                        <div key={profile.id} className="flex items-center gap-3 rounded-[1.4rem] bg-[var(--bg-soft)] px-3 py-3">
                          <Avatar profile={profile} />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold">@{profile.handle}</div>
                            <div className="truncate text-xs text-[var(--text-soft)]">{profile.city}</div>
                          </div>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={async () => {
                              setInvitingUserId(profile.id);
                              try {
                                await inviteFriendToEvent(event.slug, profile.id);
                                await onRefresh();
                              } finally {
                                setInvitingUserId(null);
                              }
                            }}
                            className="rounded-full bg-[var(--text-main)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
                          >
                            {isBusy ? "Enviando..." : "Invitar"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : null}
              {eventDetail.invites.length ? (
                <section className="rounded-[1.8rem] border border-[var(--line-soft)] bg-white px-4 py-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">
                    Invitaciones y trazabilidad
                  </div>
                  <div className="mt-4 space-y-2">
                    {eventDetail.invites.map((invite) => (
                      <div key={invite.id} className="rounded-[1.4rem] bg-[var(--bg-soft)] px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold">
                              @{invite.fromProfile.handle} invito a @{invite.toProfile.handle}
                            </div>
                            <div className="mt-1 text-xs text-[var(--text-soft)]">
                              {invite.status === "pending"
                                ? "Pendiente"
                                : invite.status === "accepted"
                                  ? "Aceptada"
                                  : invite.status === "rejected"
                                    ? "Rechazada"
                                    : "Cancelada"}{" "}
                              · {formatMobileDateTime(invite.createdAt)}
                            </div>
                          </div>
                          <span className="rounded-full bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--coral)]">
                            {invite.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
              {eventDetail.participants.map((participant) => {
                const member = participant.profile;
                const membership = participant.membership;
                const isMuted = eventDetail.mutedUserIds.includes(member.id);
                const isBanned = eventDetail.bannedUserIds.includes(member.id);
                const hasModeratorRole = participant.staffRoles.includes("moderator");
                const hasScannerRole = participant.staffRoles.includes("scanner");
                const isBusy =
                  moderatingUserId === member.id ||
                  reportingUserId === member.id ||
                  updatingRoleUserId === member.id;

                return (
                  <div key={member.id} className="rounded-[1.8rem] border border-[var(--line-soft)] bg-white px-4 py-4">
                    <div className="flex items-start gap-3">
                      <Avatar profile={member} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="truncate text-sm font-semibold">@{member.handle}</div>
                          {member.id === event.hostId ? (
                            <span className="rounded-full bg-[var(--text-main)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
                              Host
                            </span>
                          ) : null}
                          {participant.isCohost ? (
                            <span className="rounded-full bg-[rgba(255,107,87,0.1)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--coral)]">
                              Cohost
                            </span>
                          ) : null}
                          {hasModeratorRole ? (
                            <span className="rounded-full bg-[rgba(42,168,118,0.12)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#2a8a66]">
                              Moderador
                            </span>
                          ) : null}
                          {hasScannerRole ? (
                            <span className="rounded-full bg-[rgba(52,99,235,0.12)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#3463eb]">
                              Escaner
                            </span>
                          ) : null}
                          {isMuted ? (
                            <span className="rounded-full bg-[rgba(255,193,7,0.14)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9c6a00]">
                              Silenciado
                            </span>
                          ) : null}
                          {isBanned ? (
                            <span className="rounded-full bg-[rgba(184,64,49,0.12)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b84031]">
                              Bloqueado
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-1 truncate text-xs text-[var(--text-soft)]">{member.city}</div>
                        <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-[var(--text-soft)]">
                          <span className="rounded-full bg-[var(--bg-soft)] px-3 py-2">
                            {membership.status === "approved"
                              ? "Aceptado"
                              : membership.status === "pending"
                                ? "Pendiente"
                                : membership.status === "waitlisted"
                                  ? "Lista de espera"
                                  : "Rechazado"}
                          </span>
                          <span className="rounded-full bg-[var(--bg-soft)] px-3 py-2">
                            {getArrivalStatusLabel(membership.arrivalStatus)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {canManage && member.id !== event.hostId ? (
                        <>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={async () => {
                              setUpdatingRoleUserId(member.id);
                              try {
                                const nextRoles = hasModeratorRole
                                  ? participant.staffRoles.filter((role) => role !== "moderator")
                                  : [...participant.staffRoles, "moderator"];
                                await setEventMemberStaffRoles(event.slug, member.id, nextRoles);
                                await onRefresh();
                              } finally {
                                setUpdatingRoleUserId(null);
                              }
                            }}
                            className="rounded-full border border-[var(--line-warm)] px-3 py-2 text-xs font-semibold disabled:opacity-60"
                          >
                            {hasModeratorRole ? "Quitar moderador" : "Moderador"}
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={async () => {
                              setUpdatingRoleUserId(member.id);
                              try {
                                const nextRoles = hasScannerRole
                                  ? participant.staffRoles.filter((role) => role !== "scanner")
                                  : [...participant.staffRoles, "scanner"];
                                await setEventMemberStaffRoles(event.slug, member.id, nextRoles);
                                await onRefresh();
                              } finally {
                                setUpdatingRoleUserId(null);
                              }
                            }}
                            className="rounded-full border border-[var(--line-warm)] px-3 py-2 text-xs font-semibold disabled:opacity-60"
                          >
                            {hasScannerRole ? "Quitar escaner" : "Escaner"}
                          </button>
                        </>
                      ) : null}
                      {canModerateMembers && member.id !== conversation.viewerId && member.id !== event.hostId ? (
                        <>
                          {!participant.isCohost ? (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={async () => {
                                setModeratingUserId(member.id);
                                try {
                                  await addEventCohost(event.slug, member.id);
                                  await onRefresh();
                                } finally {
                                  setModeratingUserId(null);
                                }
                              }}
                              className="rounded-full border border-[var(--line-warm)] px-3 py-2 text-xs font-semibold disabled:opacity-60"
                            >
                              Cohost
                            </button>
                          ) : null}
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={async () => {
                              setModeratingUserId(member.id);
                              try {
                                await moderateEventMember(event.slug, member.id, isMuted ? "unmute" : "mute");
                                await onRefresh();
                              } finally {
                                setModeratingUserId(null);
                              }
                            }}
                            className="rounded-full border border-[var(--line-warm)] px-3 py-2 text-xs font-semibold disabled:opacity-60"
                          >
                            {isMuted ? "Quitar silencio" : "Silenciar"}
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={async () => {
                              setModeratingUserId(member.id);
                              try {
                                await moderateEventMember(event.slug, member.id, "kick");
                                await onRefresh();
                              } finally {
                                setModeratingUserId(null);
                              }
                            }}
                            className="rounded-full border border-[var(--line-warm)] px-3 py-2 text-xs font-semibold disabled:opacity-60"
                          >
                            Expulsar
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={async () => {
                              setModeratingUserId(member.id);
                              try {
                                await moderateEventMember(event.slug, member.id, isBanned ? "unban" : "ban");
                                await onRefresh();
                              } finally {
                                setModeratingUserId(null);
                              }
                            }}
                            className="rounded-full border border-[rgba(184,64,49,0.18)] px-3 py-2 text-xs font-semibold text-[#b84031] disabled:opacity-60"
                          >
                            {isBanned ? "Desbloquear" : "Bloquear"}
                          </button>
                        </>
                      ) : null}
                      {member.id !== conversation.viewerId ? (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={async () => {
                            const reason = window.prompt(`Reportar a @${member.handle}. Explica el motivo:`);
                            if (!reason?.trim()) {
                              return;
                            }
                            setReportingUserId(member.id);
                            try {
                              await reportEventMember(event.slug, member.id, reason);
                            } finally {
                              setReportingUserId(null);
                            }
                          }}
                          className="rounded-full border border-[var(--line-warm)] px-3 py-2 text-xs font-semibold disabled:opacity-60"
                        >
                          Reportar
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {tab === "stories" ? (
            <div className="space-y-4">
              {viewerProfile ? <StoryStrip clusters={storyClusters} viewer={viewerProfile} /> : null}
              {eventDetail.posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
              {!storyClusters.length && !eventDetail.posts.length ? (
                <div className="rounded-[1.8rem] border border-dashed border-[var(--line-warm)] bg-white/80 px-5 py-8 text-center text-sm text-[var(--text-soft)]">
                  Cuando el evento empiece a moverse, aquí aparecerán historias y publicaciones.
                </div>
              ) : null}
            </div>
          ) : null}

          {tab === "scan" ? (
            <div className="space-y-4">
              <section className="rounded-[1.8rem] border border-[var(--line-soft)] bg-white px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">Escaner del evento</div>
                    <div className="mt-2 text-sm text-[var(--text-soft)]">
                      Valida asistentes en la puerta. En cuanto entra un QR, se marca dentro y no vuelve a valer.
                    </div>
                  </div>
                  <QrCode className="h-5 w-5 text-[var(--coral)]" />
                </div>

                <div className="mt-4 overflow-hidden rounded-[1.8rem] bg-[#120d0a]">
                  <video ref={videoRef} playsInline muted className="aspect-[4/5] w-full object-cover" />
                </div>

                <div className="mt-3 rounded-[1.4rem] bg-[var(--bg-soft)] px-4 py-3 text-sm text-[var(--text-soft)]">
                  {cameraReady ? scanMessage || "Camara lista." : "Preparando camara..."}
                </div>
                {scanError ? (
                  <div className="rounded-[1.4rem] border border-[rgba(184,64,49,0.16)] bg-[rgba(184,64,49,0.06)] px-4 py-3 text-sm text-[#b84031]">
                    {scanError}
                  </div>
                ) : null}
              </section>

              <section className="rounded-[1.8rem] border border-[var(--line-soft)] bg-white px-4 py-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-soft)]">Validacion manual</div>
                <div className="mt-2 text-sm text-[var(--text-soft)]">
                  Si el movil no detecta el QR en vivo, pega aqui el codigo TDR, el contenido del QR o el enlace completo.
                </div>
                <textarea
                  value={manualScanValue}
                  onChange={(eventInput) => setManualScanValue(eventInput.target.value)}
                  placeholder="Pega aqui el codigo TDR, el QR o la URL de entrada"
                  className="mt-4 min-h-28 w-full rounded-[1.4rem] border border-[var(--line-soft)] bg-[var(--bg-soft)] px-4 py-3 text-sm outline-none"
                />
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={scanBusy || !manualScanValue.trim()}
                    onClick={() => void handleResolveScannedValue(manualScanValue)}
                    className="rounded-full bg-[var(--text-main)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {scanBusy ? "Validando..." : "Validar entrada"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setManualScanValue("");
                      setScanError(null);
                      setScanMessage(cameraReady ? getScanReadyMessage(getBarcodeDetectorCtor()) : null);
                    }}
                    className="rounded-full border border-[var(--line-warm)] px-4 py-2 text-sm font-semibold"
                  >
                    Limpiar
                  </button>
                </div>
              </section>
            </div>
          ) : null}

          {tab === "faq" ? (
            <div className="space-y-3">
                {event.faq.length ? event.faq.map((item) => (
                <div key={item.question} className="rounded-[1.8rem] border border-[var(--line-soft)] bg-white px-4 py-4">
                  <div className="text-sm font-bold">{item.question}</div>
                  <div className="mt-2 text-sm leading-6 text-[var(--text-soft)]">{item.answer}</div>
                </div>
              )) : (
                <div className="rounded-[1.8rem] border border-dashed border-[var(--line-warm)] bg-white/80 px-5 py-8 text-center text-sm text-[var(--text-soft)]">
                  Este evento todavía no ha cargado preguntas frecuentes.
                </div>
              )}
            </div>
          ) : null}
        </div>
        </div>
      </div>

      {ticketOpen && ticket ? (
        <EventTicketPreview
          event={event}
          ticket={ticket}
          onClose={() => setTicketOpen(false)}
          onDownload={handleDownloadTicket}
          onCalendar={handleDownloadCalendar}
          onShare={handleShareTicket}
        />
      ) : null}
    </>
  );
}
