import { useRef, useState, useEffect, useCallback } from 'react';
import './AvatarEditor.css';

interface Props {
  file: File;
  onApply: (blob: Blob) => void;
  onCancel: () => void;
}

const CANVAS_SIZE = 320;
const OUTPUT_SIZE = 256;
const CIRCLE_RADIUS = CANVAS_SIZE / 2 - 20;

const AvatarEditor = ({ file, onApply, onCancel }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(2);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const scale = zoom * Math.min(CANVAS_SIZE / img.width, CANVAS_SIZE / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    const x = (CANVAS_SIZE - w) / 2 + offset.x;
    const y = (CANVAS_SIZE - h) / 2 + offset.y;
    ctx.drawImage(img, x, y, w, h);

    //Dark overlay with circular cutout
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.rect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CIRCLE_RADIUS, 0, Math.PI * 2, true);
    ctx.fill('evenodd');

    //Circle border
    ctx.beginPath();
    ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CIRCLE_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }, [zoom, offset]);

  useEffect(() => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      imgRef.current = img;
      draw();
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    draw();
  }, [draw]);

  //Clamps offset so the circle never exits the image bounds
  const clampOffset = useCallback((x: number, y: number) => {
    const img = imgRef.current;
    if (!img) return { x, y };
    const scale = zoom * Math.min(CANVAS_SIZE / img.width, CANVAS_SIZE / img.height);
    const maxX = (img.width * scale) / 2 - CIRCLE_RADIUS;
    const maxY = (img.height * scale) / 2 - CIRCLE_RADIUS;
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  }, [zoom]);

  //Re-clamp when zoom changes in case current offset is now out of bounds
  useEffect(() => {
    setOffset(prev => clampOffset(prev.x, prev.y));
  }, [zoom]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const raw = { x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y };
    setOffset(clampOffset(raw.x, raw.y));
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleApply = () => {
    const img = imgRef.current;
    if (!img) return;

    const offscreen = document.createElement('canvas');
    offscreen.width = OUTPUT_SIZE;
    offscreen.height = OUTPUT_SIZE;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return;

    //Clip to circle for the exported image
    ctx.beginPath();
    ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();

    const ratio = OUTPUT_SIZE / CANVAS_SIZE;
    const scale = zoom * Math.min(CANVAS_SIZE / img.width, CANVAS_SIZE / img.height);
    const w = img.width * scale * ratio;
    const h = img.height * scale * ratio;
    const x = (OUTPUT_SIZE - w) / 2 + offset.x * ratio;
    const y = (OUTPUT_SIZE - h) / 2 + offset.y * ratio;
    ctx.drawImage(img, x, y, w, h);

    offscreen.toBlob((blob) => {
      if (blob) onApply(blob);
    }, 'image/png');
  };

  return (
    <div className="avatar-editor-overlay" onClick={onCancel}>
      <div className="avatar-editor-box" onClick={e => e.stopPropagation()}>
        <div className="avatar-editor-header">
          <h3 className="avatar-editor-title">Edit Image</h3>
          <button className="avatar-editor-close" onClick={onCancel}>✕</button>
        </div>

        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="avatar-editor-canvas"
          style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />

        <div className="avatar-editor-zoom">
          <span className="avatar-zoom-icon avatar-zoom-small" />
          <input
            type="range"
            className="avatar-zoom-slider"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={e => {
              const img = imgRef.current;
              if (!img) return;
              const newZoom = Number(e.target.value);
              const baseScale = Math.min(CANVAS_SIZE / img.width, CANVAS_SIZE / img.height);
              const minZoom = Math.max(
                2 * (CIRCLE_RADIUS + Math.abs(offset.x)) / (img.width  * baseScale),
                2 * (CIRCLE_RADIUS + Math.abs(offset.y)) / (img.height * baseScale),
              );
              setZoom(Math.max(minZoom, newZoom));
            }}
          />
          <span className="avatar-zoom-icon avatar-zoom-large" />
        </div>

        <div className="avatar-editor-actions">
          <button className="avatar-editor-cancel" onClick={onCancel}>Cancel</button>
          <button className="avatar-editor-apply" onClick={handleApply}>Apply</button>
        </div>
      </div>
    </div>
  );
};

export default AvatarEditor;
