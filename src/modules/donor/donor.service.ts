import { PipelineStage, Types } from "mongoose";
import User from "../user/User.schema";
import { Donor } from "../index";
import { ApiError, paginate, donorAvailabilityMatch, sanitizePublicDonor } from "../../shared/utils";
import { SearchDonorQuery } from "./donor.validation";

const isTruthy = (value: unknown) =>
  value === "true" || value === "1" || value === true;

const toRadians = (deg: number) => (deg * Math.PI) / 180;

export class DonorService {
  static async searchDonors(query: SearchDonorQuery) {
    const {
      bloodType,
      lat,
      lng,
      radiusKm,
      availableOnly,
      verifiedOnly,
      excludeUserId,
      sortBy,
    } = query;
    const { skip, limit, page, totalPages } = paginate(
      query as Record<string, any>,
    );

    // if (!bloodType || typeof bloodType !== "string") {
    //   throw new ApiError(400, "bloodType is required");
    // }

    if (typeof lat !== "number" || typeof lng !== "number") {
      throw new ApiError(
        400,
        "lat and lng are required and must be valid numbers",
      );
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new ApiError(400, "lat or lng is out of range");
    }

    const allowedRadii = [5, 10, 20, 30];
    const radius = radiusKm ?? 10;
    if (!allowedRadii.includes(radius)) {
      throw new ApiError(400, "radiusKm must be one of 5, 10, 20, or 30");
    }

    const latDelta = radius / 110.574;
    const lngDelta = radius / (111.32 * Math.cos(toRadians(lat)));

    const minLat = lat - latDelta;
    const maxLat = lat + latDelta;
    const minLng = lng - lngDelta;
    const maxLng = lng + lngDelta;

    const userMatch: Record<string, any> = {
      role: "donor",
      isActive: true,
      isDeleted: false,
      ...(bloodType ? { bloodType } : {}),
      "location.coordinates.lat": { $gte: minLat, $lte: maxLat },
      "location.coordinates.lng": { $gte: minLng, $lte: maxLng },
    };

    if (excludeUserId) {
      userMatch._id = { $ne: new Types.ObjectId(excludeUserId) };
    }

    const donorMatch: Record<string, any> = {};
    if (isTruthy(verifiedOnly)) donorMatch["donor.isVerified"] = true;

    const now = new Date();

    await Donor.updateMany(
      {
        isAvailable: false,
        $or: [
          { nextAvailableAt: null },
          { nextAvailableAt: { $lte: now } },
        ],
      },
      { $set: { isAvailable: true } },
    );

    const availabilityMatch: PipelineStage.Match = {
      $match: donorAvailabilityMatch(now),
    };

    const distanceExpression = {
      $let: {
        vars: {
          lat1: { $degreesToRadians: "$location.coordinates.lat" },
          lon1: { $degreesToRadians: "$location.coordinates.lng" },
          lat2: { $degreesToRadians: lat },
          lon2: { $degreesToRadians: lng },
        },
        in: {
          $multiply: [
            12742,
            {
              $asin: {
                $sqrt: {
                  $add: [
                    {
                      $pow: [
                        {
                          $sin: {
                            $divide: [{ $subtract: ["$$lat1", "$$lat2"] }, 2],
                          },
                        },
                        2,
                      ],
                    },
                    {
                      $multiply: [
                        { $cos: "$$lat1" },
                        { $cos: "$$lat2" },
                        {
                          $pow: [
                            {
                              $sin: {
                                $divide: [
                                  { $subtract: ["$$lon1", "$$lon2"] },
                                  2,
                                ],
                              },
                            },
                            2,
                          ],
                        },
                      ],
                    },
                  ],
                },
              },
            },
          ],
        },
      },
    };

    const donorMatchStages: PipelineStage[] = Object.keys(donorMatch).length
      ? ([{ $match: donorMatch }] as PipelineStage.Match[])
      : [];

    const basePipeline: PipelineStage[] = [
      { $match: userMatch } as PipelineStage.Match,
      {
        $lookup: {
          from: "donors",
          localField: "_id",
          foreignField: "userId",
          as: "donor",
        },
      } as PipelineStage.Lookup,
      { $unwind: "$donor" } as PipelineStage.Unwind,
      ...donorMatchStages,
    ];

    if (isTruthy(availableOnly)) {
      basePipeline.push(availabilityMatch);
    }

    basePipeline.push({
      $addFields: {
        distanceKm: distanceExpression,
        isAvailableNow: {
          $cond: [
            {
              $or: [
                { $eq: ["$donor.isAvailable", true] },
                { $eq: ["$donor.nextAvailableAt", null] },
                { $lte: ["$donor.nextAvailableAt", now] },
              ],
            },
            true,
            false,
          ],
        },
        primarySocialLink: {
          $ifNull: [
            "$socialLinks.facebook",
            {
              $ifNull: [
                "$socialLinks.instagram",
                { $ifNull: ["$socialLinks.twitter", null] },
              ],
            },
          ],
        },
      },
    } as PipelineStage.AddFields);

    basePipeline.push({ $match: { distanceKm: { $lte: radius } } } as PipelineStage.Match);

    const sortKey = sortBy === "donations" ? "donations" : "distance";
    const sortStage: PipelineStage.Sort = {
      $sort:
        sortKey === "donations"
          ? { "donor.totalDonations": -1 as const, distanceKm: 1 as const }
          : { distanceKm: 1 as const, "donor.totalDonations": -1 as const },
    };

    const [donors, totalResult] = await Promise.all([
      User.aggregate([
        ...basePipeline,
        sortStage,
        { $skip: skip } as PipelineStage.Skip,
        { $limit: limit } as PipelineStage.Limit,
        {
          $project: {
            name: 1,
            avatar: 1,
            bloodType: 1,
            location: 1,
            settings: 1,
            createdAt: 1,
            isAvailable: "$isAvailableNow",
            totalDonations: "$donor.totalDonations",
            lastDonationDate: "$donor.lastDonationDate",
            nextDonationDate: "$donor.nextDonationDate",
            isDonorVerified: "$donor.isVerified",
            distanceKm: 1,
            primarySocialLink: 1,
          },
        } as PipelineStage.Project,
      ]),
      User.aggregate([
        ...basePipeline,
        { $count: "total" } as PipelineStage.Count,
      ]),
    ]);

    const total = totalResult[0]?.total || 0;

    console.log("[DONOR SEARCH DEBUG]");
    console.log("Query params:", { bloodType, lat, lng, radiusKm, availableOnly, verifiedOnly, excludeUserId, sortBy });
    console.log("Bounding box:", { minLat, maxLat, minLng, maxLng });
    console.log("User match filter:", userMatch);
    console.log("Donor match filter:", donorMatch);
    console.log("Results count:", total);
    console.log("Donors found:", donors.length);

    return {
      donors: donors.map((donor: any) => sanitizePublicDonor(donor)),
      pagination: {
        total,
        page,
        limit,
        totalPages: totalPages(total),
      },
    };
  }

  static async getDebugInfo() {
    const now = new Date();
    const [
      totalUsers,
      totalDonors,
      totalActiveDonors,
      totalDonorsWithLocation,
      totalDonorsWithProfiles,
      totalAvailableDonors,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ role: "donor" }),
      User.countDocuments({ role: "donor", isActive: true, isDeleted: false }),
      User.countDocuments({
        role: "donor",
        isActive: true,
        isDeleted: false,
        "location.coordinates.lat": { $ne: null },
        "location.coordinates.lng": { $ne: null },
      }),
      User.aggregate([
        { $match: { role: "donor", isActive: true, isDeleted: false } },
        {
          $lookup: {
            from: "donors",
            localField: "_id",
            foreignField: "userId",
            as: "donor",
          },
        },
        { $match: { "donor.0": { $exists: true } } },
        { $count: "total" },
      ]),
      User.aggregate([
        { $match: { role: "donor", isActive: true, isDeleted: false } },
        {
          $lookup: {
            from: "donors",
            localField: "_id",
            foreignField: "userId",
            as: "donor",
          },
        },
        { $unwind: "$donor" },
        { $match: donorAvailabilityMatch(now) },
        { $count: "total" },
      ]),
    ]);

    return {
      databaseStats: {
        totalUsers,
        totalDonors,
        totalActiveDonors,
        totalDonorsWithLocation: totalDonorsWithLocation || 0,
        totalDonorsWithProfiles: totalDonorsWithProfiles[0]?.total || 0,
        totalAvailableDonors: totalAvailableDonors[0]?.total || 0,
      },
    };
  }

  static async getHomeDonors(userId?: string) {
    // If user is logged in and has coordinates, return nearest donors within 20km (limit 6)
    if (userId) {
      const user = await User.findById(userId).select("location.coordinates").lean();
      const lat = user?.location?.coordinates?.lat;
      const lng = user?.location?.coordinates?.lng;

      if (typeof lat === "number" && typeof lng === "number") {
        const result = await this.searchDonors({
          lat,
          lng,
          radiusKm: 20,
          limit: 6,
          page: 1,
          excludeUserId: userId,
        } as any);

        return result.donors;
      }
    }

    // Fallback for anonymous users or when coordinates are missing: return latest donors (limit 6)
    const now = new Date();
    const pipeline = [
      { $match: { role: "donor", isActive: true, isDeleted: false } },
      {
        $lookup: {
          from: "donors",
          localField: "_id",
          foreignField: "userId",
          as: "donor",
        },
      },
      { $unwind: "$donor" },
      {
        $addFields: {
          isAvailableNow: {
            $cond: [
              {
                $or: [
                  { $eq: ["$donor.isAvailable", true] },
                  { $eq: ["$donor.nextAvailableAt", null] },
                  { $lte: ["$donor.nextAvailableAt", now] },
                ],
              },
              true,
              false,
            ],
          },
          primarySocialLink: {
            $ifNull: [
              "$socialLinks.facebook",
              { $ifNull: ["$socialLinks.instagram", { $ifNull: ["$socialLinks.twitter", null] }] },
            ],
          },
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: 6 },
      {
        $project: {
          name: 1,
          avatar: 1,
          bloodType: 1,
          location: 1,
          settings: 1,
          createdAt: 1,
          isAvailable: "$isAvailableNow",
          totalDonations: "$donor.totalDonations",
          lastDonationDate: "$donor.lastDonationDate",
          isDonorVerified: "$donor.isVerified",
          distanceKm: null,
          primarySocialLink: 1,
        },
      },
    ];

    const donors = await User.aggregate(pipeline as any[]);
    return donors.map((donor: any) => sanitizePublicDonor(donor));
  }
}
