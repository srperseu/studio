
'use client'

import React, { useState, useCallback } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Icons } from './icons'

interface ImageCropperProps {
  image: string
  isOpen: boolean
  onClose: () => void
  onCropComplete: (croppedArea: Area, croppedAreaPixels: Area) => void
  aspect?: number
  cropShape?: 'rect' | 'round'
}

const ImageCropper: React.FC<ImageCropperProps> = ({
  image,
  isOpen,
  onClose,
  onCropComplete,
  aspect = 1,
  cropShape = 'rect',
}) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)

  const onCropChange = (location: { x: number; y: number }) => {
    setCrop(location)
  }

  const onZoomChange = (value: number[]) => {
    setZoom(value[0])
  }

  const handleCropComplete = useCallback(
    (croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels)
    },
    []
  )

  const handleSave = () => {
    if (croppedAreaPixels) {
      onCropComplete(crop, croppedAreaPixels)
    }
  }

  // Reset zoom and crop when image changes
  React.useEffect(() => {
    setZoom(1);
    setCrop({ x: 0, y: 0 });
  }, [image]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle>Ajustar Imagem</DialogTitle>
        </DialogHeader>
        <div className="relative h-80 w-full bg-muted">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            cropShape={cropShape}
            onCropChange={onCropChange}
            onZoomChange={(z) => setZoom(z)}
            onCropComplete={handleCropComplete}
          />
        </div>
        <div className="flex items-center gap-4">
          <Icons.ZoomOut className="h-5 w-5" />
          <Slider
            min={1}
            max={3}
            step={0.1}
            value={[zoom]}
            onValueChange={onZoomChange}
          />
          <Icons.ZoomIn className="h-5 w-5" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ImageCropper

// Adicionando os novos ícones ao icons.tsx
// Este arquivo é simbólico, a adição real seria no src/components/icons.tsx
declare module '@/components/icons' {
    export const Icons: {
        ZoomIn: (props: any) => JSX.Element;
        ZoomOut: (props: any) => JSX.Element;
    }
}
