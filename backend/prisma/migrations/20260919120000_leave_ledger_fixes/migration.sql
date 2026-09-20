-- Carry-forward is settled only once the previous year has ended (audit 2026-09-19).
ALTER TABLE "leave_balances" ADD COLUMN "carry_forward_settled" BOOLEAN NOT NULL DEFAULT true;
-- Balances made early for a year that hasn't started had their carry-forward frozen from a running year
UPDATE "leave_balances" SET "carry_forward_settled" = false, "carried_forward" = 0
WHERE "year" > EXTRACT(YEAR FROM (now() AT TIME ZONE 'Asia/Dhaka')) AND "used" + "pending" <= "allocated";

-- A request remembers whether it draws on a balance, so changing the type later can't unbalance it.
ALTER TABLE "leave_requests" ADD COLUMN "counts_against_balance" BOOLEAN NOT NULL DEFAULT true;
UPDATE "leave_requests" r SET "counts_against_balance" = t."is_paid" FROM "leave_types" t WHERE t."id" = r."leave_type_id";
