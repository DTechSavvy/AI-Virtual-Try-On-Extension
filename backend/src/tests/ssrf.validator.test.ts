import { describe, it, expect } from 'vitest';
import { SSRFValidator, SSRFError } from '../modules/try-on/services/ssrf.validator.js';

describe('SSRFValidator', () => {
  describe('isPrivateIp', () => {
    it('should detect IPv4 loopback addresses (127.0.0.0/8)', () => {
      expect(SSRFValidator.isPrivateIp('127.0.0.1')).toBe(true);
      expect(SSRFValidator.isPrivateIp('127.1.2.3')).toBe(true);
    });

    it('should detect RFC 1918 private IPv4 ranges', () => {
      expect(SSRFValidator.isPrivateIp('10.0.0.1')).toBe(true);
      expect(SSRFValidator.isPrivateIp('10.254.1.1')).toBe(true);
      expect(SSRFValidator.isPrivateIp('172.16.0.1')).toBe(true);
      expect(SSRFValidator.isPrivateIp('172.31.255.254')).toBe(true);
      expect(SSRFValidator.isPrivateIp('192.168.1.1')).toBe(true);
      expect(SSRFValidator.isPrivateIp('192.168.0.254')).toBe(true);
    });

    it('should detect link-local and cloud metadata endpoints (169.254.0.0/16)', () => {
      expect(SSRFValidator.isPrivateIp('169.254.169.254')).toBe(true);
      expect(SSRFValidator.isPrivateIp('169.254.1.1')).toBe(true);
    });

    it('should detect IPv6 loopback and private addresses', () => {
      expect(SSRFValidator.isPrivateIp('::1')).toBe(true);
      expect(SSRFValidator.isPrivateIp('fc00::1')).toBe(true);
      expect(SSRFValidator.isPrivateIp('fe80::1')).toBe(true);
    });

    it('should allow public routable IPv4 addresses', () => {
      expect(SSRFValidator.isPrivateIp('8.8.8.8')).toBe(false);
      expect(SSRFValidator.isPrivateIp('1.1.1.1')).toBe(false);
      expect(SSRFValidator.isPrivateIp('151.101.1.140')).toBe(false);
    });
  });

  describe('validateUrl', () => {
    it('should reject non-HTTP/HTTPS protocols', async () => {
      await expect(SSRFValidator.validateUrl('file:///etc/passwd')).rejects.toThrow(SSRFError);
      await expect(SSRFValidator.validateUrl('ftp://example.com/image.jpg')).rejects.toThrow(SSRFError);
      await expect(SSRFValidator.validateUrl('gopher://127.0.0.1')).rejects.toThrow(SSRFError);
    });

    it('should reject credentials in URLs', async () => {
      await expect(SSRFValidator.validateUrl('https://admin:secret@example.com/img.jpg')).rejects.toThrow(SSRFError);
    });

    it('should reject explicit localhost and internal hostnames', async () => {
      await expect(SSRFValidator.validateUrl('http://localhost/image.png')).rejects.toThrow(SSRFError);
      await expect(SSRFValidator.validateUrl('http://service.local/image.png')).rejects.toThrow(SSRFError);
      await expect(SSRFValidator.validateUrl('http://api.internal/image.png')).rejects.toThrow(SSRFError);
    });

    it('should reject raw private IP URLs', async () => {
      await expect(SSRFValidator.validateUrl('http://127.0.0.1:8080/image.png')).rejects.toThrow(SSRFError);
      await expect(SSRFValidator.validateUrl('http://169.254.169.254/latest/meta-data')).rejects.toThrow(SSRFError);
      await expect(SSRFValidator.validateUrl('http://10.0.0.5/test.jpg')).rejects.toThrow(SSRFError);
    });

    it('should validate valid public URLs', async () => {
      const url = await SSRFValidator.validateUrl('https://images.unsplash.com/photo-1515886657613-9f3515b0c78f');
      expect(url.protocol).toBe('https:');
      expect(url.hostname).toBe('images.unsplash.com');
    });
  });
});
