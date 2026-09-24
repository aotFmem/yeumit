"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, Camera, Image as ImageIcon, AlertCircle, RefreshCw, Loader2, QrCode } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (decodedText: string) => void;
  equipmentName?: string;
  isProcessing?: boolean;
}

export default function QrScannerModal({
  isOpen,
  onClose,
  onScanSuccess,
  equipmentName,
  isProcessing = false,
}: QrScannerModalProps) {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraStarting, setIsCameraStarting] = useState(true);
  const [isScanningFile, setIsScanningFile] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const readerElementId = "yeum-it-camera-scanner";

  // เริ่มต้นและจัดการกล้อง
  useEffect(() => {
    if (!isOpen) {
      cleanupScanner();
      return;
    }

    let isMounted = true;
    setIsCameraStarting(true);
    setCameraError(null);

    const startScanner = async () => {
      try {
        // รอให้ DOM render element id ก่อน
        await new Promise((resolve) => setTimeout(resolve, 300));
        if (!isMounted) return;

        const readerElem = document.getElementById(readerElementId);
        if (!readerElem) return;

        // ล้าง instance เก่าถ้ามี
        if (scannerRef.current) {
          try {
            if (scannerRef.current.isScanning) {
              await scannerRef.current.stop();
            }
          } catch {
            // ignore
          }
        }

        const html5QrCode = new Html5Qrcode(readerElementId);
        scannerRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 220, height: 220 },
            aspectRatio: 1.0,
          },
          (decodedText) => {
            // สแกนสำเร็จ
            if (isMounted) {
              if (typeof window !== "undefined" && "vibrate" in navigator) {
                navigator.vibrate?.([80]);
              }
              cleanupScanner();
              onScanSuccess(decodedText);
            }
          },
          () => {
            // Frame ไม่พบ QR - ปกติ ไม่ต้องทำอะไร
          }
        );

        if (isMounted) {
          setIsCameraStarting(false);
        }
      } catch (err: any) {
        console.warn("[QrScannerModal] Camera start error:", err);
        if (isMounted) {
          setIsCameraStarting(false);
          setCameraError(
            err?.message?.includes("Permission")
              ? "กรุณาอนุญาตการเข้าถึงกล้อง เพื่อสแกน QR Code"
              : "ไม่สามารถเปิดกล้องได้ กรุณาอนุญาตการเข้าถึงกล้อง หรือเลือกอัปโหลดจากรูปภาพ"
          );
        }
      }
    };

    startScanner();

    return () => {
      isMounted = false;
      cleanupScanner();
    };
  }, [isOpen]);

  const cleanupScanner = () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(() => {});
        }
      } catch {
        // ignore
      }
      scannerRef.current = null;
    }
  };

  // สแกนจากไฟล์รูปภาพ
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanningFile(true);
    try {
      let tempScanner = scannerRef.current;
      if (!tempScanner) {
        tempScanner = new Html5Qrcode(readerElementId);
      }
      const result = await tempScanner.scanFile(file, true);
      if (result) {
        cleanupScanner();
        onScanSuccess(result);
      }
    } catch (err) {
      alert("❌ ไม่พบ QR Code ในรูปภาพนี้ กรุณาถ่ายภาพป้าย QR Code ให้ชัดเจนขึ้นแล้วลองใหม่อีกครั้ง");
    } finally {
      setIsScanningFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-slate-100 relative overflow-hidden flex flex-col items-center">
        {/* ปุ่มปิด */}
        <button
          type="button"
          onClick={() => {
            cleanupScanner();
            onClose();
          }}
          disabled={isProcessing}
          className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* ส่วนหัว Modal */}
        <div className="text-center mb-3">
          <div className="w-11 h-11 rounded-2xl bg-emerald-100 text-[#06C755] flex items-center justify-center mx-auto mb-2 shadow-xs">
            <QrCode className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">สแกน QR จุดรับคืนอุปกรณ์ IT</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            อุปกรณ์: <span className="font-semibold text-emerald-700">{equipmentName || "อุปกรณ์ IT"}</span>
          </p>
        </div>

        {/* กล่องกล้อง Viewfinder */}
        <div className="w-full relative bg-slate-900 rounded-2xl overflow-hidden mb-3 aspect-square max-h-[260px] flex items-center justify-center border-2 border-emerald-500/50 shadow-inner">
          {/* พื้นที่สำหรับ Html5Qrcode video */}
          <div id={readerElementId} className="w-full h-full object-cover [&_video]:w-full [&_video]:h-full [&_video]:object-cover" />

          {/* Loading Indicator ระหว่างรอกล้องเปิด */}
          {isCameraStarting && (
            <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center text-white space-y-2 z-10">
              <Loader2 className="w-8 h-8 animate-spin text-[#06C755]" />
              <p className="text-xs text-slate-300">กำลังเชื่อมต่อกล้องมือถือ...</p>
            </div>
          )}

          {/* แจ้งเตือนเมื่อกล้องเปิดไม่ได้ */}
          {cameraError && (
            <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center p-4 text-center text-white space-y-2.5 z-10">
              <AlertCircle className="w-8 h-8 text-amber-400" />
              <p className="text-xs text-slate-200 leading-relaxed">{cameraError}</p>
              <button
                type="button"
                onClick={() => {
                  setCameraError(null);
                  setIsCameraStarting(true);
                  // Trigger re-mount scanner
                  cleanupScanner();
                  const fakeElem = document.getElementById(readerElementId);
                  if (fakeElem) {
                    const html5QrCode = new Html5Qrcode(readerElementId);
                    scannerRef.current = html5QrCode;
                    html5QrCode
                      .start(
                        { facingMode: "environment" },
                        { fps: 10, qrbox: { width: 220, height: 220 } },
                        (text) => {
                          cleanupScanner();
                          onScanSuccess(text);
                        },
                        () => {}
                      )
                      .then(() => setIsCameraStarting(false))
                      .catch((e) => {
                        setIsCameraStarting(false);
                        setCameraError(e?.message || "ไม่สามารถเปิดกล้องได้");
                      });
                  }
                }}
                className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-semibold flex items-center space-x-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>ลองใหม่อีกครั้ง</span>
              </button>
            </div>
          )}

          {/* Processing Overlay */}
          {isProcessing && (
            <div className="absolute inset-0 bg-emerald-950/80 backdrop-blur-xs flex flex-col items-center justify-center text-white space-y-2 z-20 animate-in fade-in">
              <Loader2 className="w-9 h-9 animate-spin text-[#06C755]" />
              <p className="text-xs font-semibold text-emerald-100">กำลังยืนยันการคืนอุปกรณ์...</p>
            </div>
          )}
        </div>

        <p className="text-[11px] text-slate-500 text-center mb-3">
          ส่องกล้องไปที่ <span className="font-semibold text-slate-800">ป้าย QR Code ณ จุดรับคืนห้อง IT</span> เพื่อยืนยันการคืน
        </p>

        {/* ตัวเลือกสำรอง: อัปโหลดรูปภาพป้าย QR Code */}
        <div className="w-full space-y-2">
          {/* ซ่อน file input สำหรับเลือกภาพจาก Gallery */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing || isScanningFile}
            className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 text-xs font-semibold rounded-xl transition flex items-center justify-center space-x-1.5"
          >
            {isScanningFile ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600" />
            ) : (
              <ImageIcon className="w-3.5 h-3.5 text-slate-600" />
            )}
            <span>เลือกจากภาพถ่ายป้าย QR Code</span>
          </button>

          <button
            type="button"
            onClick={() => {
              cleanupScanner();
              onClose();
            }}
            disabled={isProcessing}
            className="w-full py-2 text-slate-400 hover:text-slate-600 text-xs font-medium transition"
          >
            ยกเลิก
          </button>
        </div>
      </div>
    </div>
  );
}
