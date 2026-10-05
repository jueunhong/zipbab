"use client";

import { useEffect, useRef, useState } from "react";

function cameraErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "카메라 권한이 막혀 있어요. 주소창 왼쪽의 아이콘을 눌러 카메라를 허용한 뒤 다시 시도해 주세요. (맥이라면 시스템 설정 → 개인정보 보호 및 보안 → 카메라에서 브라우저도 허용해야 해요)";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") return "연결된 카메라를 찾을 수 없어요.";
  if (name === "NotReadableError") return "다른 앱이 카메라를 쓰고 있어요. 그 앱을 닫고 다시 시도해 주세요.";
  return "카메라를 켜지 못했어요.";
}

/**
 * 브라우저 안에서 웹캠 화면을 띄워 사진을 찍는 창 (컴퓨터용).
 * 카메라는 https 또는 localhost 에서만 켤 수 있다.
 */
export default function CameraCapture({ onCapture, onClose }: { onCapture: (file: File) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState(() =>
    typeof navigator !== "undefined" && !navigator.mediaDevices?.getUserMedia
      ? "이 주소에서는 카메라를 켤 수 없어요. 카메라는 https 주소나 localhost에서만 쓸 수 있어요. 갤러리에서 골라 주세요."
      : "",
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) return;
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false })
      .then((stream) => {
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch((err) => !cancelled && setError(cameraErrorMessage(err)));
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function shoot() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return setError("사진을 만들지 못했어요. 다시 시도해 주세요.");
        onCapture(new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9,
    );
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div className="w-full max-w-xl space-y-3" onClick={(e) => e.stopPropagation()}>
        {error ? (
          <div className="card text-sm text-red-600">{error}</div>
        ) : (
          <div className="relative overflow-hidden rounded-2xl bg-black">
            <video ref={videoRef} autoPlay playsInline muted onLoadedData={() => setReady(true)} className="aspect-[4/3] w-full object-cover" />
            {!ready && <p className="absolute inset-0 flex items-center justify-center text-sm text-white/70">카메라 켜는 중…</p>}
          </div>
        )}
        <div className="flex gap-2">
          {!error && (
            <button type="button" onClick={shoot} disabled={!ready} className="btn flex-1 !py-3">
              📸 찍기
            </button>
          )}
          <button type="button" onClick={onClose} className="flex-1 rounded-lg bg-surface py-3 text-sm">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
