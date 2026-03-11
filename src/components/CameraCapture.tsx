import { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, SwitchCamera, X } from 'lucide-react';

interface CameraCaptureProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (file: File) => void;
  facingMode?: 'user' | 'environment';
}

const CameraCapture = ({ open, onOpenChange, onCapture, facingMode = 'environment' }: CameraCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [currentFacing, setCurrentFacing] = useState(facingMode);
  const [streaming, setStreaming] = useState(false);

  const startCamera = useCallback(async (facing: string) => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setStreaming(true);
      }
    } catch {
      // Camera not available
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setStreaming(false);
  }, []);

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' });
        onCapture(file);
        stopCamera();
        onOpenChange(false);
      }
    }, 'image/jpeg', 0.9);
  };

  const toggleFacing = () => {
    const next = currentFacing === 'user' ? 'environment' : 'user';
    setCurrentFacing(next);
    startCamera(next);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) stopCamera(); onOpenChange(v); }}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2"><Camera className="w-4 h-4" /> Camera</DialogTitle>
          <DialogDescription>Take a photo using your device camera</DialogDescription>
        </DialogHeader>
        <div className="relative bg-black aspect-[4/3] w-full">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          {!streaming && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Button onClick={() => startCamera(currentFacing)} variant="outline" className="bg-background/80">
                <Camera className="w-4 h-4 mr-2" /> Start Camera
              </Button>
            </div>
          )}
        </div>
        <canvas ref={canvasRef} className="hidden" />
        {streaming && (
          <div className="flex gap-2 p-4 pt-0">
            <Button variant="outline" size="icon" onClick={toggleFacing}><SwitchCamera className="w-4 h-4" /></Button>
            <Button onClick={handleCapture} className="flex-1"><Camera className="w-4 h-4 mr-2" /> Capture Photo</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CameraCapture;
