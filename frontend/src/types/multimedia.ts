export interface FeatureWithMedia {
  id: string;
  title: string;
  description: string;
  videoUrl?: string;
  imageUrl: string;
  demoUrl?: string;
  category: 'templates' | 'analytics' | 'automation' | 'security' | 'integration';
  highlights: string[];
}

export interface MultimediaShowcaseProps {
  features?: FeatureWithMedia[];
  onFeatureSelect?: (featureId: string) => void;
  className?: string;
}

export interface MediaAsset {
  id: string;
  type: 'image' | 'video' | 'animation';
  src: string;
  alt: string;
  title: string;
  thumbnail?: string;
  duration?: number; // for videos in seconds
  size?: {
    width: number;
    height: number;
  };
}

export interface MediaGalleryProps {
  assets: MediaAsset[];
  onAssetSelect?: (assetId: string) => void;
  autoPlay?: boolean;
  showThumbnails?: boolean;
  className?: string;
}

export interface VideoPlayerState {
  isPlaying: boolean;
  isMuted: boolean;
  isFullscreen: boolean;
  progress: number;
  duration: number;
  currentTime: number;
  showControls: boolean;
  isLoading: boolean;
}