export type DonorAvailabilityArgs = {
  isAvailable?: boolean;
  nextAvailableAt?: Date | string | null;
};

export const isDonorAvailable = (donor?: DonorAvailabilityArgs | null): boolean => {
  if (!donor) return false;

  if (donor.isAvailable) return true;
  if (donor.nextAvailableAt == null) return true;

  const nextAvailableAt = new Date(donor.nextAvailableAt);
  if (Number.isNaN(nextAvailableAt.getTime())) return false;

  return nextAvailableAt.getTime() <= Date.now();
};

export const donorAvailabilityMatch = (now = new Date()) => ({
  $or: [
    { "donor.isAvailable": true },
    { "donor.nextAvailableAt": null },
    { "donor.nextAvailableAt": { $lte: now } },
  ],
});

export const ensureDonorAvailability = async (donor: any): Promise<boolean> => {
  if (!donor) return false;

  const isAvailableByDate = donor.nextAvailableAt == null ||
    new Date(donor.nextAvailableAt).getTime() <= Date.now();

  if (isAvailableByDate && donor.isAvailable === false) {
    donor.isAvailable = true;
    if (typeof donor.save === "function") {
      try {
        await donor.save();
      } catch (error) {
        console.error("Failed to normalize donor availability:", error);
      }
    }
  }

  return isDonorAvailable(donor);
};
