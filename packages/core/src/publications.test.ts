import { describe, expect, it } from 'vitest';
import { extractExternalRef, platformOf } from './publications.js';

describe('extractExternalRef', () => {
  it('Instagram /p/ и /reel/ → shortcode', () => {
    expect(extractExternalRef('https://instagram.com/p/CxYz-123_ab')).toBe('CxYz-123_ab');
    expect(extractExternalRef('https://www.instagram.com/reel/AbC123')).toBe('AbC123');
  });

  it('Facebook posts/videos/reel → нумерички id', () => {
    expect(extractExternalRef('https://facebook.com/astibo/posts/123456789')).toBe('123456789');
    expect(extractExternalRef('https://www.facebook.com/page/videos/987654321')).toBe('987654321');
    expect(extractExternalRef('https://facebook.com/reel/555')).toBe('555');
  });

  it('Facebook fbid и story_fbid', () => {
    expect(extractExternalRef('https://facebook.com/photo/?fbid=42&set=a')).toBe('42');
    expect(extractExternalRef('https://facebook.com/story.php?story_fbid=99&id=1')).toBe('99');
  });

  it('TikTok /video/ → id', () => {
    expect(extractExternalRef('https://tiktok.com/@user/video/7300000000000000000')).toBe(
      '7300000000000000000',
    );
  });

  it('непознат линк → null', () => {
    expect(extractExternalRef('https://example.com/foo')).toBeNull();
  });

  it('platformOf погодува платформа', () => {
    expect(platformOf('https://instagram.com/p/x')).toBe('ig');
    expect(platformOf('https://tiktok.com/@u/video/1')).toBe('tiktok');
    expect(platformOf('https://facebook.com/x')).toBe('fb');
    expect(platformOf('https://example.com')).toBeNull();
  });
});
