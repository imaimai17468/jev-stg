import { MaximizeIcon, MinusIcon, PlusIcon } from "lucide-react";
import { Button } from "@/shared/ui/button";

interface MapZoomControlsProps {
  readonly onFit: () => void;
  readonly onZoom: (factor: number) => void;
  /** The factor one press of the zoom-in button multiplies the scale by. */
  readonly step: number;
}

export const MapZoomControls = ({
  onFit,
  onZoom,
  step,
}: MapZoomControlsProps) => (
  <div className="absolute right-3 bottom-3 flex flex-col gap-2">
    <Button
      aria-label="拡大"
      onClick={() => {
        onZoom(step);
      }}
      size="tap"
      type="button"
      variant="outline"
    >
      <PlusIcon aria-hidden />
    </Button>
    <Button
      aria-label="縮小"
      onClick={() => {
        onZoom(1 / step);
      }}
      size="tap"
      type="button"
      variant="outline"
    >
      <MinusIcon aria-hidden />
    </Button>
    <Button
      aria-label="全体を表示"
      onClick={onFit}
      size="tap"
      type="button"
      variant="outline"
    >
      <MaximizeIcon aria-hidden />
    </Button>
  </div>
);
