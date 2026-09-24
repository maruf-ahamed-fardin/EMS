import type { Prisma } from '../generated/prisma/client';
import { carryForward } from './leave-rules';

type Tx = Prisma.TransactionClient;

/** One request's effect on its balance. Only requests that draw on a balance touch one. */
interface BalanceEntry {
  employeeId: string;
  leaveTypeId: string;
  startDate: Date;
  days: Prisma.Decimal | number;
  countsAgainstBalance: boolean;
}

const balanceKey = (entry: BalanceEntry) => ({
  employeeId_leaveTypeId_year: { employeeId: entry.employeeId, leaveTypeId: entry.leaveTypeId, year: entry.startDate.getUTCFullYear() },
});

/** Serializes every balance change for one person, so checks and changes can't interleave. */
export async function lockEmployeeLeave(tx: Tx, employeeId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`leave:${employeeId}`}))`;
}

/** Pending days become used (approval). */
export async function consumePending(tx: Tx, entry: BalanceEntry): Promise<void> {
  if (!entry.countsAgainstBalance) return;
  await tx.leaveBalance.update({ where: balanceKey(entry), data: { pending: { decrement: entry.days }, used: { increment: entry.days } } });
}

/**
 * Gives days back (rejected or cancelled). When the request belongs to a year that has already ended,
 * the next year's carry-forward was worked out without these days, so it is raised to match.
 */
export async function releaseDays(tx: Tx, entry: BalanceEntry, from: 'pending' | 'used', currentYear: number): Promise<void> {
  if (!entry.countsAgainstBalance) return;
  await tx.leaveBalance.update({ where: balanceKey(entry), data: { [from]: { decrement: entry.days } } });
  const year = entry.startDate.getUTCFullYear();
  if (year < currentYear) await raiseCarryForward(tx, entry.employeeId, entry.leaveTypeId, year);
}

async function raiseCarryForward(tx: Tx, employeeId: string, leaveTypeId: string, closedYear: number): Promise<void> {
  const [previous, next, type] = [
    await tx.leaveBalance.findUnique({ where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year: closedYear } } }),
    await tx.leaveBalance.findUnique({ where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year: closedYear + 1 } } }),
    await tx.leaveType.findUnique({ where: { id: leaveTypeId }, select: { carryForwardMax: true } }),
  ];
  if (!previous || !next || !type || !next.carryForwardSettled) return;
  const carry = carryForward(
    { allocated: Number(previous.allocated), carriedForward: Number(previous.carriedForward), used: Number(previous.used), pending: Number(previous.pending) },
    Number(type.carryForwardMax),
  );
  // Never lowers it: HR may have raised it by hand
  if (carry > Number(next.carriedForward)) await tx.leaveBalance.update({ where: { id: next.id }, data: { carriedForward: carry } });
}

/**
 * Cancels everything still pending for someone (they were deactivated) and gives the days back. Takes
 * their leave lock and claims each request, so an approval at the same moment wins or loses cleanly.
 */
export async function cancelPendingLeave(tx: Tx, employeeId: string, note: string, currentYear: number): Promise<number> {
  await lockEmployeeLeave(tx, employeeId);
  const pending = await tx.leaveRequest.findMany({
    where: { employeeId, status: 'PENDING' },
    select: { id: true, employeeId: true, leaveTypeId: true, startDate: true, days: true, countsAgainstBalance: true },
  });
  let cancelled = 0;
  for (const request of pending) {
    const claimed = await tx.leaveRequest.updateMany({ where: { id: request.id, status: 'PENDING' }, data: { status: 'CANCELLED', reviewNote: note, reviewedAt: new Date() } });
    if (claimed.count !== 1) continue;
    await releaseDays(tx, request, 'pending', currentYear);
    cancelled++;
  }
  return cancelled;
}
