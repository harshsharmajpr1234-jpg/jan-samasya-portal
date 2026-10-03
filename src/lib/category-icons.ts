import {
  Trash2,
  Droplets,
  Construction,
  Lightbulb,
  Waves,
  Dog,
  Fence,
  Trees,
  CircleDot,
  type LucideIcon,
} from "lucide-react";

/** Maps a category slug to a Lucide icon (keeps DB values framework-agnostic). */
export function categoryIcon(slugOrIcon: string): LucideIcon {
  switch (slugOrIcon) {
    case "garbage-sanitation":
      return Trash2;
    case "water-supply":
      return Droplets;
    case "roads-potholes":
      return Construction;
    case "streetlights":
      return Lightbulb;
    case "drainage-sewage":
      return Waves;
    case "stray-animals":
      return Dog;
    case "encroachment":
      return Fence;
    case "parks-public-spaces":
      return Trees;
    default:
      return CircleDot;
  }
}
