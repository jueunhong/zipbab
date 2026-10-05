"use client";

import { useRef, useState } from "react";
import CameraCapture from "@/components/CameraCapture";

/** 고른 사진 파일과 미리보기 URL을 관리한다. 카메라로 찍은 사진과 갤러리에서 고른 사진 모두 pick 으로 모인다. */
export function usePhoto(initialPreview: string | null = null) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(initialPreview);

  function pick(next: File | null) {
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    setFile(next);
    setPreview(next ? URL.createObjectURL(next) : null);
  }

  return { file, preview, pick };
}

/** 사진 미리보기 + "카메라로 찍기" / "갤러리에서 고르기" 버튼 */
export default function PhotoPicker({
  preview,
  onPick,
  emptyText = "요리 사진을 찍거나 골라 주세요",
}: {
  preview: string | null;
  onPick: (file: File | null) => void;
  emptyText?: string;
}) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [webcamOpen, setWebcamOpen] = useState(false);

  // 휴대폰·태블릿(터치 화면)은 기본 카메라 앱을, 컴퓨터는 브라우저 안 웹캠 창을 연다.
  // 컴퓨터 브라우저는 input 의 capture 속성을 무시하고 파일 선택 창만 띄우기 때문.
  function openCamera() {
    if (window.matchMedia("(pointer: coarse)").matches) cameraInputRef.current?.click();
    else setWebcamOpen(true);
  }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onPick(f);
    e.target.value = "";
  };

  return (
    <div className="space-y-2">
      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-line text-sm text-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {preview ? <img src={preview} alt="미리보기" className="h-full w-full object-cover" /> : emptyText}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={openCamera} className="rounded-lg border border-line py-2.5 text-center text-sm hover:border-accent">
          📷 {preview ? "다시 찍기" : "카메라로 찍기"}
        </button>
        {/* capture 가 있으면 휴대폰에서 카메라가 바로 열리고, 없으면 갤러리(사진 보관함)가 열린다 */}
        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFileChange} />
        <label className="cursor-pointer rounded-lg border border-line py-2.5 text-center text-sm hover:border-accent">
          🖼️ {preview ? "다른 사진 고르기" : "갤러리에서 고르기"}
          <input type="file" accept="image/*" className="hidden" onChange={onFileChange} />
        </label>
      </div>
      {webcamOpen && (
        <CameraCapture
          onCapture={(f) => {
            onPick(f);
            setWebcamOpen(false);
          }}
          onClose={() => setWebcamOpen(false)}
        />
      )}
    </div>
  );
}
