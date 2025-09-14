import { Character } from '@prisma/client';

export type SharePlatform = 'twitter' | 'facebook' | 'instagram' | 'pinterest' | 'reddit' | 'discord' | 'direct';

export interface ShareMetadata {
  title: string;
  description: string;
  imageUrl?: string;
  hashtags?: string[];
  url: string;
}

export interface ShareOptions {
  platform: SharePlatform;
  includeCredit?: boolean;
  customMessage?: string;
  hashtags?: string[];
}

export interface ShareResult {
  success: boolean;
  shareUrl?: string;
  error?: string;
  platform: SharePlatform;
}

export interface SocialMediaConfig {
  appName: string;
  baseUrl: string;
  twitterHandle?: string;
  defaultHashtags: string[];
}

export class ShareService {
  private config: SocialMediaConfig;

  constructor(config: SocialMediaConfig) {
    this.config = config;
  }

  /**
   * Generates share metadata for a character
   */
  generateShareMetadata(character: Character, options: ShareOptions): ShareMetadata {
    const characterUrl = `${this.config.baseUrl}/character/${character.id}`;
    
    let title = `Check out my character: ${character.name}`;
    let description = character.prompt;
    
    if (options.customMessage) {
      title = options.customMessage;
      description = `${options.customMessage} - Created with ${this.config.appName}`;
    }

    // Add creator credit if requested
    if (options.includeCredit) {
      description += ` | Created with ${this.config.appName}`;
    }

    // Combine default and custom hashtags
    const hashtags = [
      ...this.config.defaultHashtags,
      ...(options.hashtags || []),
      character.styleType,
      'charactercreation',
    ];

    return {
      title,
      description,
      imageUrl: character.s3Url || undefined,
      hashtags: [...new Set(hashtags)], // Remove duplicates
      url: characterUrl,
    };
  }

  /**
   * Creates a share URL for the specified platform
   */
  createShareUrl(metadata: ShareMetadata, platform: SharePlatform): string {
    const encodedUrl = encodeURIComponent(metadata.url);
    const encodedTitle = encodeURIComponent(metadata.title);
    const encodedDescription = encodeURIComponent(metadata.description);
    const hashtags = metadata.hashtags?.join(',') || '';
    const encodedHashtags = encodeURIComponent(hashtags);

    switch (platform) {
      case 'twitter':
        const twitterText = `${metadata.title} ${metadata.url}`;
        const encodedTwitterText = encodeURIComponent(twitterText);
        return `https://twitter.com/intent/tweet?text=${encodedTwitterText}&hashtags=${encodedHashtags}`;

      case 'facebook':
        return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedTitle}`;

      case 'pinterest':
        if (!metadata.imageUrl) {
          throw new Error('Pinterest sharing requires an image');
        }
        const encodedImageUrl = encodeURIComponent(metadata.imageUrl);
        return `https://pinterest.com/pin/create/button/?url=${encodedUrl}&media=${encodedImageUrl}&description=${encodedDescription}`;

      case 'reddit':
        return `https://reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`;

      case 'discord':
        // Discord doesn't have a direct share URL, return the character URL for manual sharing
        return metadata.url;

      case 'instagram':
        // Instagram doesn't support URL-based sharing, return the character URL
        return metadata.url;

      case 'direct':
        return metadata.url;

      default:
        throw new Error(`Unsupported platform: ${platform}`);
    }
  }

  /**
   * Shares a character to the specified platform
   */
  async shareCharacter(
    character: Character,
    options: ShareOptions
  ): Promise<ShareResult> {
    try {
      const metadata = this.generateShareMetadata(character, options);
      const shareUrl = this.createShareUrl(metadata, options.platform);

      // For platforms that support direct sharing
      if (['twitter', 'facebook', 'pinterest', 'reddit'].includes(options.platform)) {
        // Open share URL in new window/tab
        if (typeof window !== 'undefined') {
          const popup = window.open(
            shareUrl,
            'share-popup',
            'width=600,height=400,scrollbars=yes,resizable=yes'
          );
          
          if (!popup) {
            // Fallback if popup was blocked
            window.open(shareUrl, '_blank');
          }
        }
      }

      return {
        success: true,
        shareUrl,
        platform: options.platform,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Share failed',
        platform: options.platform,
      };
    }
  }

  /**
   * Copies share text/URL to clipboard
   */
  async copyToClipboard(character: Character, options: ShareOptions): Promise<ShareResult> {
    try {
      const metadata = this.generateShareMetadata(character, options);
      
      let textToCopy = '';
      
      switch (options.platform) {
        case 'direct':
          textToCopy = metadata.url;
          break;
          
        case 'discord':
          textToCopy = `${metadata.title}\n${metadata.url}`;
          if (metadata.hashtags?.length) {
            textToCopy += `\nTags: ${metadata.hashtags.join(' #')}`;
          }
          break;
          
        case 'instagram':
          textToCopy = `${metadata.title}\n\n${metadata.description}`;
          if (metadata.hashtags?.length) {
            textToCopy += `\n\n#${metadata.hashtags.join(' #')}`;
          }
          textToCopy += `\n\nView full size: ${metadata.url}`;
          break;
          
        default:
          textToCopy = `${metadata.title}\n${metadata.url}`;
          break;
      }

      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = textToCopy;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
          document.execCommand('copy');
        } finally {
          document.body.removeChild(textArea);
        }
      }

      return {
        success: true,
        shareUrl: textToCopy,
        platform: options.platform,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to copy to clipboard',
        platform: options.platform,
      };
    }
  }

  /**
   * Gets available share platforms for a character
   */
  getAvailableSharePlatforms(character: Character): SharePlatform[] {
    const allPlatforms: SharePlatform[] = [
      'twitter',
      'facebook',
      'reddit',
      'discord',
      'instagram',
      'direct',
    ];

    // Pinterest requires an image
    if (character.s3Url && character.generationStatus === 'COMPLETED') {
      allPlatforms.push('pinterest');
    }

    return allPlatforms;
  }

  /**
   * Generates Open Graph meta tags for character pages
   */
  generateOpenGraphTags(character: Character): Record<string, string> {
    const metadata = this.generateShareMetadata(character, { platform: 'direct' });
    
    const tags: Record<string, string> = {
      'og:title': metadata.title,
      'og:description': metadata.description,
      'og:url': metadata.url,
      'og:type': 'website',
      'og:site_name': this.config.appName,
    };

    if (metadata.imageUrl) {
      tags['og:image'] = metadata.imageUrl;
      tags['og:image:alt'] = `Character: ${character.name}`;
      tags['og:image:width'] = '1024'; // Assuming standard size
      tags['og:image:height'] = '1024';
    }

    return tags;
  }

  /**
   * Generates Twitter Card meta tags
   */
  generateTwitterCardTags(character: Character): Record<string, string> {
    const metadata = this.generateShareMetadata(character, { platform: 'twitter' });
    
    const tags: Record<string, string> = {
      'twitter:card': metadata.imageUrl ? 'summary_large_image' : 'summary',
      'twitter:title': metadata.title,
      'twitter:description': metadata.description,
    };

    if (this.config.twitterHandle) {
      tags['twitter:site'] = `@${this.config.twitterHandle}`;
    }

    if (metadata.imageUrl) {
      tags['twitter:image'] = metadata.imageUrl;
      tags['twitter:image:alt'] = `Character: ${character.name}`;
    }

    return tags;
  }

  /**
   * Tracks share analytics (placeholder for future implementation)
   */
  async trackShare(character: Character, platform: SharePlatform): Promise<void> {
    // This would typically send analytics data to your tracking service
    console.log(`Character ${character.id} shared on ${platform}`);
  }

  /**
   * Validates if a character can be shared
   */
  canShare(character: Character): { canShare: boolean; reasons: string[] } {
    const reasons: string[] = [];

    if (!character.isPublic && character.generationStatus !== 'COMPLETED') {
      reasons.push('Character must be completed to share');
    }

    // Additional validation can be added here
    // e.g., check if user has permission to share, if character meets community guidelines, etc.

    return {
      canShare: reasons.length === 0,
      reasons,
    };
  }

  /**
   * Gets share statistics for characters
   */
  getShareStats(characters: Character[]): {
    totalCharacters: number;
    shareable: number;
    withImages: number;
    public: number;
  } {
    return {
      totalCharacters: characters.length,
      shareable: characters.filter(char => 
        char.generationStatus === 'COMPLETED' || char.isPublic
      ).length,
      withImages: characters.filter(char => 
        char.s3Url && char.generationStatus === 'COMPLETED'
      ).length,
      public: characters.filter(char => char.isPublic).length,
    };
  }

  /**
   * Creates a shareable collection URL for multiple characters
   */
  createCollectionShareUrl(characters: Character[], title?: string): string {
    const characterIds = characters.map(char => char.id).join(',');
    const collectionTitle = title || `${characters.length} Characters`;
    
    return `${this.config.baseUrl}/collection?characters=${characterIds}&title=${encodeURIComponent(collectionTitle)}`;
  }
}

// Default configuration
const defaultConfig: SocialMediaConfig = {
  appName: 'Character Creator',
  baseUrl: typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com',
  defaultHashtags: ['AI', 'characterart', 'digitalart'],
};

// Singleton instance
export const shareService = new ShareService(defaultConfig);
export default shareService;