import Donation from "./Donation.schema";
import { PipelineStage, Types } from "mongoose";
import User from "../user/User.schema";
import Donor from "../donor/donor.schema";
import { ApiError, paginate, sendEmail } from "../../shared/utils";
import {
  CreateDonationInput,
  CreateDonationRequestInput,
  ListDonationQuery,
  ListMyDonationRequestQuery,
  RejectDonationInput,
  SearchDonationRequestInput,
} from "./donation.validation";

export class DonationService {
  private static normalizeSearch(search: string) {
    return search
      .trim()
      .replace(/^donor\s*#\s*/i, "")
      .replace(/^#/, "")
      .replace(/\s+/g, "")
      .toLowerCase();
  }

  private static escapeRegex(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private static buildIdentifierQuery(identifier: string) {
    const value = identifier.trim();
    const lower = value.toLowerCase();
    return {
      $or: [{ email: lower }, { phone: value }],
    };
  }

  private static buildSuggestionRegex(query: string) {
    return new RegExp(this.escapeRegex(query.trim()), "i");
  }

  static async searchDonationSuggestions(q: string) {
    const search = q.trim();

    if (!search) {
      throw new ApiError(400, "Search query is required");
    }

    const regex = this.buildSuggestionRegex(search);

    const [donorSuggestions, userSuggestions] = await Promise.all([
      Donor.aggregate([
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: "$user" },
        {
          $match: {
            "user.role": "donor",
            "user.isActive": true,
            "user.isDeleted": false,
            $or: [{ "user.email": regex }, { "user.phone": regex }],
          },
        },
        {
          $project: {
            _id: 0,
            identifier: { $ifNull: ["$user.email", "$user.phone"] },
            name: "$user.name",
            role: { $literal: "donor" },
            email: "$user.email",
            phone: "$user.phone",
          },
        },
        { $limit: 6 },
      ]),
      User.find({
        role: "user",
        isActive: true,
        isDeleted: false,
        $or: [{ email: regex }, { phone: regex }],
      })
        .select("name email phone")
        .limit(6),
    ]);

    const suggestions: Array<{
      identifier: string;
      name: string;
      role: string;
      email: string;
      phone: string;
    }> = [];
    const seen = new Set<string>();

    for (const suggestion of donorSuggestions as any[]) {
      const identifier = String(
        suggestion.identifier || suggestion.email || suggestion.phone || "",
      ).trim();

      if (!identifier || seen.has(identifier)) {
        continue;
      }

      seen.add(identifier);
      suggestions.push({
        identifier,
        name: suggestion.name || "",
        role: suggestion.role || "donor",
        email: suggestion.email || "",
        phone: suggestion.phone || "",
      });

      if (suggestions.length >= 6) {
        return { suggestions };
      }
    }

    for (const suggestion of userSuggestions as any[]) {
      const identifier = String(suggestion.email || suggestion.phone || "").trim();

      if (!identifier || seen.has(identifier)) {
        continue;
      }

      seen.add(identifier);
      suggestions.push({
        identifier,
        name: suggestion.name || "",
        role: "hospital_user",
        email: suggestion.email || "",
        phone: suggestion.phone || "",
      });

      if (suggestions.length >= 6) {
        break;
      }
    }

    return { suggestions };
  }

  static async createDonation(hospitalId: string, body: CreateDonationInput) {
    // console.log(body)
    const donorUser = await User.findById(body.donorId).select(
      "role isActive bloodType",
    );

    if (!donorUser || !donorUser.isActive || donorUser.role !== "donor") {
      throw new ApiError(404, "Donor not found");
    }

    const donorProfile = await Donor.findOne({ userId: donorUser._id }).select(
      "_id",
    );

    if (!donorProfile) {
      throw new ApiError(404, "Donor profile not found");
    }

    const donation = await Donation.create({
      donorId: donorUser._id,
      hospitalId,
      requestedBy: body.requesterId ?? null,
      bloodType: body.bloodType,
      units: body.units ?? 1,
      patientInfo: body.patientInfo || "",
      notes: body.notes || "",
      status: "pending",
      approvedBy: null,
      approvedAt: null,
      donatedAt: null,
    });

    return donation;
  }

  static async createDonationRequest(
    requesterId: string,
    body: CreateDonationRequestInput,
  ) {
    const donorUser = await User.findById(body.donorId).select(
      "role isActive email",
    );
    console.log(donorUser);

    if (!donorUser || !donorUser.isActive || donorUser.role !== "donor") {
      throw new ApiError(404, "Donor not found");
    }

    const donorProfile = await Donor.findOne({ userId: donorUser._id }).select(
      "_id",
    );
    if (!donorProfile) {
      throw new ApiError(404, "Donor profile not found");
    }

    const now = new Date();
    const donation = await Donation.create({
      donorId: donorUser._id,
      hospitalId: requesterId,
      bloodType: body.bloodType,
      units: 1,
      patientInfo: {
        name: "N/A",
        address: "N/A",
        phone: "N/A",
        reasonForBlood: "Blood request",
      },
      notes: "",
      collectionId: null,
      requestedBy: new Types.ObjectId(body.collectionId),
      status: "request",
      approvedBy: null,
      approvedAt: null,
      donatedAt: null,
      auditTrail: [
        {
          action: "donation_created",
          performedBy: new Types.ObjectId(requesterId),
          performedAt: now,
          changes: {
            donorId: { from: null, to: String(donorUser._id) },
            requestedBy: { from: null, to: requesterId },
            bloodType: { from: null, to: body.bloodType },
            collectionId: { from: null, to: body.collectionId },
            status: { from: null, to: "request" },
          },
          notes:
            "Donation request created by user with donor, blood type, and collection id",
        },
      ],
    });

    return donation;
  }

  static async approveDonation(hospitalId: string, donationId: string) {
    const donation = await Donation.findOne({
      _id: donationId,
      hospitalId,
    });

    if (!donation) {
      throw new ApiError(404, "Donation not found");
    }

    if (donation.status !== "pending") {
      throw new ApiError(400, "Donation is already processed");
    }

    const donor = await Donor.findOne({ userId: donation.donorId });
    if (!donor) {
      throw new ApiError(404, "Donor profile not found");
    }
    const receiveUser = await User.findById(donation?.requestedBy);
    console.log(receiveUser);
    // return
    if (!receiveUser) {
      throw new ApiError(404, "Receive user profile not found");
    }
    const now = new Date();
    const nextAvailableAt = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    donation.status = "approved";
    donation.approvedBy = donation.hospitalId;
    donation.approvedAt = now;
    donation.donatedAt = now;
    await donation.save();

    donor.lastDonationDate = now;
    donor.nextAvailableAt = nextAvailableAt;
    donor.isAvailable = false;
    donor.totalDonations += 1;
    await donor.save();

    receiveUser.lastReceivedDate = now;
    receiveUser.totalReceived += 1;
    await receiveUser.save();

    if (donation.requestedBy) {
      const otherDonations = await Donation.find({
        requestedBy: donation.requestedBy,
        _id: { $ne: donation._id },
      })
        .populate("donorId", "name email")
        .select("donorId requestedBy bloodType units status");

      await Promise.allSettled(
        otherDonations.map(async (otherDonation: any) => {
          const donorUser = otherDonation.donorId as any;
          if (!donorUser?.email) {
            return;
          }

          await sendEmail({
            to: donorUser.email,
            subject: "Blood request already fulfilled",
            html: `
              <h2>Thank you for your willingness to help</h2>
              <p>Hi ${donorUser.name || "there"},</p>
              <p>The blood request you responded to has already been fulfilled and the blood has been collected.</p>
              <p>Thank you for being ready to donate and support the patient.</p>
              <p>Regards,<br/>Blood Donation Team</p>
            `,
          }).catch(() => {});
        }),
      );

      await Donation.deleteMany({
        requestedBy: donation.requestedBy,
        _id: { $ne: donation._id },
      });
    }

    return donation;
  }

  static async rejectDonation(
    hospitalId: string,
    donationId: string,
    body: RejectDonationInput,
  ) {
    const donation = await Donation.findOne({
      _id: donationId,
      hospitalId,
    });

    if (!donation) {
      throw new ApiError(404, "Donation not found");
    }

    if (donation.status !== "pending") {
      throw new ApiError(400, "Donation is already processed");
    }

    donation.status = "rejected";
    donation.approvedBy = donation.hospitalId;
    donation.approvedAt = new Date();
    donation.reportNote = body.reportNote || "";
    await donation.save();

    return donation;
  }

  static async listHospitalDonations(
    hospitalId: string,
    query: ListDonationQuery,
  ) {
    const search = query.search?.trim();
    const normalizedSearch = search ? this.normalizeSearch(search) : "";
    const bloodTypeValues = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
    const baseMatch: Record<string, any> = {
      hospitalId: Types.ObjectId.isValid(hospitalId)
        ? new Types.ObjectId(hospitalId)
        : hospitalId,
    };
    if (query.status) baseMatch.status = query.status;

    const searchMatch: Record<string, any> = {};
    if (normalizedSearch) {
      if (Types.ObjectId.isValid(normalizedSearch)) {
        const objectId = new Types.ObjectId(normalizedSearch);
        searchMatch.$or = [{ _id: objectId }, { donorId: objectId }];
      } else if (bloodTypeValues.includes(normalizedSearch.toUpperCase())) {
        searchMatch.bloodType = normalizedSearch.toUpperCase();
      } else {
        const escaped = this.escapeRegex(normalizedSearch);
        searchMatch.$or = [
          {
            $expr: {
              $regexMatch: {
                input: { $toString: "$donorId" },
                regex: `${escaped}$`,
                options: "i",
              },
            },
          },
          {
            $expr: {
              $regexMatch: {
                input: { $toString: "$_id" },
                regex: `${escaped}$`,
                options: "i",
              },
            },
          },
          { bloodType: { $regex: `^${escaped}$`, $options: "i" } },
        ];
      }
    }

    const { skip, limit, page, totalPages } = paginate(
      query as Record<string, any>,
    );

    const pipeline: PipelineStage[] = [
      { $match: baseMatch } as PipelineStage.Match,
    ];

    if (Object.keys(searchMatch).length > 0) {
      pipeline.push({ $match: searchMatch } as PipelineStage.Match);
    }

    pipeline.push(
      { $sort: { createdAt: -1 } } as PipelineStage.Sort,
      {
        $facet: {
          donations: [
            { $skip: skip } as PipelineStage.Skip,
            { $limit: limit } as PipelineStage.Limit,
          ],
          meta: [{ $count: "total" } as PipelineStage.Count],
        },
      } as PipelineStage.Facet,
    );

    const [result] = await Donation.aggregate(pipeline);
    const donations = result?.donations || [];
    const total = result?.meta?.[0]?.total || 0;

    return {
      donations,
      pagination: {
        total,
        page,
        limit,
        totalPages: totalPages(total),
      },
    };
  }

  static async listMyDonationRequests(
    requesterId: string,
    query: ListMyDonationRequestQuery,
  ) {
    const filter: Record<string, any> = { hospitalId: requesterId };
    if (query.status) filter.status = query.status;

    const { skip, limit, page, totalPages } = paginate(
      query as Record<string, any>,
    );

    const [requests, total] = await Promise.all([
      Donation.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Donation.countDocuments(filter),
    ]);

    return {
      requests,
      pagination: {
        total,
        page,
        limit,
        totalPages: totalPages(total),
      },
    };
  }

  static async searchDonationRequestForHospital(
    hospitalId: string,
    body: SearchDonationRequestInput,
  ) {
    const { identifier } = body;

    const matchedUser = await User.findOne(
      this.buildIdentifierQuery(identifier),
    ).select("_id name email phone role isActive bloodType avatar location");

    if (!matchedUser) {
      throw new ApiError(404, "User not found");
    }

    const donationRequest = await Donation.findOne({
      status: "request",
      $or: [{ requestedBy: matchedUser._id }, { donorId: matchedUser._id }],
    })
      .sort({ createdAt: -1 })
      .populate(
        "donorId",
        "name email phone bloodType avatar location role isActive",
      )
      .populate("requestedBy", "name email phone role");

    if (!donationRequest) {
      throw new ApiError(404, "Donation request not found");
    }

    const donorUser = donationRequest.donorId as any;
    const donorProfile = donorUser?._id
      ? await Donor.findOne({ userId: donorUser._id }).select(
          "isAvailable totalDonations lastDonationDate nextAvailableAt isVerified",
        )
      : null;

    return {
      request: donationRequest,
      matchedUser: {
        id: matchedUser._id,
        name: matchedUser.name,
        email: matchedUser.email,
        phone: matchedUser.phone,
        role: matchedUser.role,
      },
      donor: donorUser
        ? {
            id: donorUser._id,
            name: donorUser.name,
            email: donorUser.email,
            phone: donorUser.phone,
            avatar: donorUser.avatar || null,
            bloodType: donorUser.bloodType,
            location: donorUser.location || null,
            isAvailable: donorProfile?.isAvailable ?? false,
            isDonorVerified: donorProfile?.isVerified ?? false,
            totalDonations: donorProfile?.totalDonations ?? 0,
            lastDonationDate: donorProfile?.lastDonationDate ?? null,
          }
        : null,
      hospitalId,
    };
  }
}
