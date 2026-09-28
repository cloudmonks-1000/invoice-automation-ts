import { z } from "zod";

export const voucherNumberSchema = z
  .string()
  .trim()
  .min(
    1,
    "Voucher number cannot be empty"
  )
  .max(
    100,
    "Voucher number is too long"
  );

export const voucherNumbersSchema = z
  .array(voucherNumberSchema)
  .min(
    1,
    "At least one voucher number is required"
  )
  .max(
    10000,
    "Maximum 10000 voucher numbers are allowed"
  );

export type VoucherNumbersInput = z.infer<
  typeof voucherNumbersSchema
>;