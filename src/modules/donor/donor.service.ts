import { PipelineStage, Types } from "mongoose";
import User from "../user/User.schema";
import { ApiError, paginate } from "../../shared/utils";
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
console.log("{currect user}: ", query)
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
    const availabilityMatch: PipelineStage.Match = {
      $match: {
        $or: [
          { "donor.nextAvailableAt": { $lte: now } },
          { "donor.nextAvailableAt": null },
        ],
      },
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
      availabilityMatch,
      {
        $addFields: {
          distanceKm: distanceExpression,
          isAvailableNow: {
            $cond: [
              {
                $or: [
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
      } as PipelineStage.AddFields,
      { $match: { distanceKm: { $lte: radius } } } as PipelineStage.Match,
    ];

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
            createdAt: 1,
            isAvailable: "$isAvailableNow",
            totalDonations: "$donor.totalDonations",
            lastDonationDate: "$donor.lastDonationDate",
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

    return {
      donors,
      pagination: {
        total,
        page,
        limit,
        totalPages: totalPages(total),
      },
    };
  }
}
