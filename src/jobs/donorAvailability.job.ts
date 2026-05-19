import cron from "node-cron";
import { Donor } from "../modules";

let isScheduled = false;

const normalizeDonorAvailability = async () => {
  const now = new Date();

  try {
    const result = await Donor.updateMany(
      {
        isAvailable: false,
        $or: [
          { nextAvailableAt: null },
          { nextAvailableAt: { $lte: now } },
        ],
      },
      { $set: { isAvailable: true } },
    );

    if (result.modifiedCount > 0) {
      console.log(
        `Donor availability sync: updated ${result.modifiedCount} donor(s) to available`,
      );
    }
  } catch (error) {
    console.error("Donor availability sync failed:", error);
  }
};

export const startDonorAvailabilityJob = () => {
  if (isScheduled) {
    return;
  }

  isScheduled = true;

  // Run once immediately on startup, then every 10 minutes.
  normalizeDonorAvailability().catch((error) => {
    console.error("Donor availability initial sync failed:", error);
  });

  cron.schedule("*/10 * * * *", async () => {
    try {
      await normalizeDonorAvailability();
    } catch (error) {
      console.error("Donor availability job failed:", error);
    }
  });
};
