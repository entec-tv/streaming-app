import { base64Encode } from './base64';

export function parseM3U(m3uContent: string) {
  const lines = m3uContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const channels = [];
  
  let currentInfo: any = {};
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.startsWith('#EXTINF:')) {
      // Parse attributes
      const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/);
      const groupTitleMatch = line.match(/group-title="([^"]*)"/);
      const nameMatch = line.split(',').pop();
      
      const name = nameMatch ? nameMatch.trim() : 'Unknown';
      const logo = tvgLogoMatch ? tvgLogoMatch[1] : '';
      const category = groupTitleMatch ? groupTitleMatch[1] : 'General';
      
      let quality: '4K' | 'FHD' | 'HD' = 'HD';
      if (name.toUpperCase().includes('4K') || name.toUpperCase().includes('UHD')) quality = '4K';
      else if (name.toUpperCase().includes('FHD') || name.includes('1080')) quality = 'FHD';
      
      const typeStr = name.toLowerCase() + category.toLowerCase();
      let type: 'live' | 'vod' | 'series' = 'live';
      if (typeStr.includes('series') || typeStr.includes('season') || typeStr.includes('مسلسل')) type = 'series';
      else if (typeStr.includes('movie') || typeStr.includes('cinema') || typeStr.includes('film') || typeStr.includes('vod') || typeStr.includes('فيلم') || typeStr.includes('افلام') || typeStr.includes('box office')) type = 'vod';
      
      currentInfo = {
        name,
        logo,
        category,
        quality,
        type,
        isLive: type === 'live',
        current: type === 'live' ? 'Live Broadcast' : name,
        next: type === 'live' ? 'Up Next' : ''
      };
    } else if (!line.startsWith('#')) {
      // URL line
      if (currentInfo.name) {
        const lowerUrl = line.toLowerCase();
        let determinedType = currentInfo.type;
        let determinedIsLive = currentInfo.isLive;

        if (lowerUrl.includes('/live/') || lowerUrl.endsWith('.ts') || lowerUrl.includes('.ts?')) {
          determinedType = 'live';
          determinedIsLive = true;
        } else if (lowerUrl.includes('/movie/') || lowerUrl.includes('.mp4') || lowerUrl.includes('.mkv') || lowerUrl.includes('.avi')) {
          determinedType = 'vod';
          determinedIsLive = false;
        } else if (lowerUrl.includes('/series/')) {
          determinedType = 'series';
          determinedIsLive = false;
        }

        channels.push({
          ...currentInfo,
          type: determinedType,
          isLive: determinedIsLive,
          current: determinedIsLive ? (currentInfo.current || 'Live Broadcast') : currentInfo.name,
          next: determinedIsLive ? (currentInfo.next || 'Up Next') : '',
          id: base64Encode(line).substring(0, 16),
          streamUrl: line
        });
        currentInfo = {};
      }
    }
  }
  
  return channels;
}