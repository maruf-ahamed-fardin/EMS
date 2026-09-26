import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { AuditService } from '@/lib/services/audit/audit.service';
import type { AuthContext } from '@/lib/auth/auth-context';
import type { PrismaService } from '@/lib/db/prisma';
import { photoUrl, sniffPhotoType } from '@/lib/services/team-profile/photo';
import { TeamProfileService } from '@/lib/services/team-profile/team-profile.service';

const EMPLOYEE_ID = '01a0ae57-505a-76b7-9bc4-9d3a2b6a075a';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);

describe('sniffPhotoType', () => {
  it('knows JPEG, PNG and WebP from their bytes', () => {
    expect(sniffPhotoType(JPEG)).toBe('image/jpeg');
    expect(sniffPhotoType(PNG)).toBe('image/png');
    expect(sniffPhotoType(WEBP)).toBe('image/webp');
  });

  it('refuses SVG, HTML, PDF and a RIFF that is not WebP, whatever they are called', () => {
    expect(sniffPhotoType(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'))).toBeNull();
    expect(sniffPhotoType(Buffer.from('<!doctype html><script>alert(1)</script>'))).toBeNull();
    expect(sniffPhotoType(Buffer.from('%PDF-1.7'))).toBeNull();
    expect(sniffPhotoType(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE')]))).toBeNull();
    expect(sniffPhotoType(Buffer.alloc(0))).toBeNull();
  });
});

describe('photoUrl', () => {
  it('is null without a photo, and changes with every new key without revealing it', () => {
    expect(photoUrl(EMPLOYEE_ID, null)).toBeNull();
    const a = photoUrl(EMPLOYEE_ID, `employees/${EMPLOYEE_ID}/photo-a`)!;
    const b = photoUrl(EMPLOYEE_ID, `employees/${EMPLOYEE_ID}/photo-b`)!;
    expect(a).not.toBe(b);
    expect(a).not.toContain('photo-a');
    expect(a.startsWith(`/api/v1/team-profile/${EMPLOYEE_ID}/photo?v=`)).toBe(true);
  });
});

describe('TeamProfileService photos', () => {
  const auth = {
    sessionId: 's',
    user: { id: 'u', email: 'e@demo.selorax.test', name: 'E', employeeId: EMPLOYEE_ID, role: { id: 'r', key: 'employee', name: 'Employee' } },
    permissions: { 'team_profile.manage_own': 'ALL' },
  } as AuthContext;

  function setup(photoKey: string | null) {
    const storage = { put: jest.fn(), get: jest.fn(), delete: jest.fn(), signedUrl: jest.fn() };
    const update = jest.fn();
    const prisma = {
      employee: { findFirst: jest.fn().mockResolvedValue({ photoKey }), update },
      $transaction: jest.fn((run: (tx: unknown) => Promise<unknown>) => run({ employee: { update } })),
    };
    const audit = { record: jest.fn() };
    const service = new TeamProfileService(
      prisma as unknown as PrismaService,
      audit as unknown as AuditService,
      storage,
    );
    // The card read after a change is covered by the shape tests
    jest.spyOn(service, 'own').mockResolvedValue({} as never);
    return { service, storage, update, audit };
  }

  it('stores a new photo under a new server-made key, then removes the old file', async () => {
    const { service, storage, update, audit } = setup(`employees/${EMPLOYEE_ID}/photo-old`);
    await service.setPhoto(auth, { buffer: JPEG, size: JPEG.length });

    const [key, , type] = storage.put.mock.calls[0] as [string, Buffer, string];
    expect(key).toMatch(new RegExp(`^employees/${EMPLOYEE_ID}/photo-[0-9a-f-]{36}$`));
    expect(type).toBe('image/jpeg');
    expect(update).toHaveBeenCalledWith({ where: { id: EMPLOYEE_ID }, data: { photoKey: key } });
    expect(audit.record.mock.calls[0][0]).toMatchObject({ action: 'team_profile.photo_updated', after: { hasPhoto: true } });
    expect(storage.delete).toHaveBeenCalledWith(`employees/${EMPLOYEE_ID}/photo-old`);
  });

  it('refuses a file that is not a photo, or none, and stores nothing', async () => {
    const { service, storage } = setup(null);
    const svg = Buffer.from('<svg><script>alert(1)</script></svg>');
    await expect(service.setPhoto(auth, { buffer: svg, size: svg.length })).rejects.toThrow(BadRequestException);
    await expect(service.setPhoto(auth, undefined)).rejects.toThrow(BadRequestException);
    expect(storage.put).not.toHaveBeenCalled();
  });

  it('deletes the new file again when saving the record fails, and keeps the old one', async () => {
    const { service, storage, update } = setup(`employees/${EMPLOYEE_ID}/photo-old`);
    update.mockRejectedValueOnce(new Error('database down'));
    await expect(service.setPhoto(auth, { buffer: PNG, size: PNG.length })).rejects.toThrow('database down');
    const [key] = storage.put.mock.calls[0] as [string];
    expect(storage.delete).toHaveBeenCalledWith(key);
    expect(storage.delete).not.toHaveBeenCalledWith(`employees/${EMPLOYEE_ID}/photo-old`);
  });

  it('removes a photo: clears the record, audits it, deletes the file', async () => {
    const { service, storage, update, audit } = setup(`employees/${EMPLOYEE_ID}/photo-old`);
    await service.removePhoto(auth);
    expect(update).toHaveBeenCalledWith({ where: { id: EMPLOYEE_ID }, data: { photoKey: null } });
    expect(audit.record.mock.calls[0][0]).toMatchObject({ action: 'team_profile.photo_removed' });
    expect(storage.delete).toHaveBeenCalledWith(`employees/${EMPLOYEE_ID}/photo-old`);
  });

  it('serves only a stored file that really is a photo', async () => {
    const { service, storage } = setup(`employees/${EMPLOYEE_ID}/photo-x`);
    storage.get.mockResolvedValueOnce(WEBP);
    await expect(service.photo(EMPLOYEE_ID)).resolves.toMatchObject({ contentType: 'image/webp' });

    storage.get.mockResolvedValueOnce(Buffer.from('<html>'));
    await expect(service.photo(EMPLOYEE_ID)).rejects.toThrow(NotFoundException);
  });
});
