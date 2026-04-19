import User from "../user/User.schema";
import Donor from "../donor/donor.schema";
import { ApiError } from "../../shared/utils";
import { SearchHospitalDonorQuery } from "./hospital.validation";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const buildPhoneCandidates = (identifier: string): string[] => {
  const cleaned = identifier.trim();
  const digits = cleaned.replace(/\D/g, "");

  const candidates = new Set<string>();
  if (cleaned) candidates.add(cleaned);
  if (digits) candidates.add(digits);

  // 8801XXXXXXXXX -> 01XXXXXXXXX
  if (digits.startsWith("880") && digits.length === 13) {
    candidates.add(`0${digits.slice(3)}`);
  }

  // 01XXXXXXXXX -> 8801XXXXXXXXX
  if (digits.startsWith("01") && digits.length === 11) {
    candidates.add(`880${digits}`);
  }

  return Array.from(candidates);
};

const getPrimarySocialLink = (socialLinks: Record<string, string | null> | undefined) => {
  if (!socialLinks) return null;
  return socialLinks.facebook || socialLinks.instagram || socialLinks.twitter || null;
};

export class HospitalService {
  static async searchDonor(query: SearchHospitalDonorQuery) {
    const identifier = query.identifier.trim();
    const isEmail = emailRegex.test(identifier);
    const phoneCandidates = buildPhoneCandidates(identifier);

    const userFilter: Record<string, any> = {
      role: "donor",
      isActive: true,
      isDeleted: false,
      ...(isEmail
        ? { email: identifier.toLowerCase() }
        : {
            phone: { $in: phoneCandidates },
          }),
    };

    const user = await User.findOne(userFilter).select(
      "name email phone gender bloodType location socialLinks communityFlags isVerified",
    );

    if (!user) {
      throw new ApiError(404, "Donor not found");
    }

    const donor = await Donor.findOne({ userId: user._id }).select(
      "isAvailable isVerified totalDonations lastDonationDate nextAvailableAt",
    );

    if (!donor) {
      throw new ApiError(404, "Donor profile not found");
    }

    const now = new Date();
    const isAvailable = donor.nextAvailableAt
      ? now >= donor.nextAvailableAt
      : donor.isAvailable;

    return {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      gender: user.gender,
      bloodType: user.bloodType,
      location: {
        city: user.location?.city || "",
      },
      socialLinks: user.socialLinks,
      primarySocialLink: getPrimarySocialLink(user.socialLinks as any),
      communityFlags: user.communityFlags,
      isUserVerified: user.isVerified,
      isDonorVerified: donor.isVerified,
      isAvailable,
      totalDonations: donor.totalDonations,
      lastDonationDate: donor.lastDonationDate,
      nextAvailableAt: donor.nextAvailableAt,
    };
  }
}
