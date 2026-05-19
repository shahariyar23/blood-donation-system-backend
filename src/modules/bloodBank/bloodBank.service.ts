import { ApiError } from "../../shared/utils";
import BloodBankSettings, {
  BLOOD_GROUPS,
  BloodGroup,
  IBloodBankApiConfig,
  IBloodBankSettings,
} from "./BloodBankSettings.schema";

type BloodBankSearchQuery = {
  bloodType?: string;
  district?: string;
  division?: string;
  q?: string;
  limit?: string;
  page?: string;
};

type BloodBankSettingsUpdate = Partial<
  Pick<
    IBloodBankSettings,
    | "isVisible"
    | "isMaintenance"
    | "maintenanceMessage"
    | "sectionTitle"
    | "notice"
    | "allowedBloodGroups"
    | "maxResults"
    | "requestTimeoutMs"
  >
> & {
  apis?: Partial<IBloodBankApiConfig>[];
};

type NormalizedBloodBankResult = {
  id?: string;
  name: string;
  address?: string;
  district?: string;
  division?: string;
  phone?: string;
  email?: string;
  website?: string | null;
  hours?: string;
  isOpen?: boolean;
  rating?: number;
  bloodType?: string;
  availability?: unknown;
  totalUnits?: number;
  latitude?: number | null;
  longitude?: number | null;
  raw?: unknown;
  source: {
    name: string;
    label: string;
    priority: number;
  };
};

const SETTINGS_KEY = "blood-bank-settings";

const publicSettingsFields =
  "isVisible isMaintenance maintenanceMessage sectionTitle notice allowedBloodGroups maxResults requestTimeoutMs apis.name apis.label apis.baseUrl apis.isActive apis.priority createdAt updatedAt";

const adminSettingsFields =
  "isVisible isMaintenance maintenanceMessage sectionTitle notice allowedBloodGroups maxResults requestTimeoutMs apis.name apis.label apis.baseUrl +apis.apiKey apis.isActive apis.priority createdAt updatedAt";

const isAllowedBloodGroup = (value: unknown): value is BloodGroup =>
  typeof value === "string" && BLOOD_GROUPS.includes(value as BloodGroup);

const clampPositiveInt = (
  value: unknown,
  fallback: number,
  options: { min: number; max: number },
) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(options.max, Math.max(options.min, Math.floor(parsed)));
};

const sanitizeSettingsUpdate = (body: BloodBankSettingsUpdate) => {
  const update: Record<string, unknown> = {};

  if (typeof body.isVisible === "boolean") update.isVisible = body.isVisible;
  if (typeof body.isMaintenance === "boolean") {
    update.isMaintenance = body.isMaintenance;
  }
  if (typeof body.maintenanceMessage === "string") {
    update.maintenanceMessage = body.maintenanceMessage.trim();
  }
  if (typeof body.sectionTitle === "string") {
    update.sectionTitle = body.sectionTitle.trim();
  }
  if (typeof body.notice === "string") update.notice = body.notice.trim();
  if (typeof body.maxResults === "number") {
    update.maxResults = clampPositiveInt(body.maxResults, 20, { min: 1, max: 100 });
  }
  if (typeof body.requestTimeoutMs === "number") {
    update.requestTimeoutMs = clampPositiveInt(body.requestTimeoutMs, 8000, {
      min: 1000,
      max: 30000,
    });
  }

  if (Array.isArray(body.allowedBloodGroups)) {
    const allowedBloodGroups = body.allowedBloodGroups.filter(isAllowedBloodGroup);
    if (allowedBloodGroups.length === 0) {
      throw new ApiError(400, "allowedBloodGroups must include at least one valid blood group");
    }
    update.allowedBloodGroups = [...new Set(allowedBloodGroups)];
  }

  if (Array.isArray(body.apis)) {
    update.apis = body.apis.map((api) => {
      if (!api.name || !api.label || !api.baseUrl) {
        throw new ApiError(400, "Each API needs name, label, and baseUrl");
      }

      return {
        name: String(api.name).trim(),
        label: String(api.label).trim(),
        baseUrl: String(api.baseUrl).trim(),
        apiKey: typeof api.apiKey === "string" ? api.apiKey.trim() : "",
        isActive: typeof api.isActive === "boolean" ? api.isActive : true,
        priority: clampPositiveInt(api.priority, 100, { min: 0, max: 10000 }),
      };
    });
  }

  return update;
};

const getResultArray = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  const value = payload as Record<string, unknown>;
  const candidates = [
    value.data,
    value.results,
    value.bloodBanks,
    value.blood_banks,
    value.items,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
    if (candidate && typeof candidate === "object") {
      const nested = getResultArray(candidate);
      if (nested.length > 0) return nested;
    }
  }

  return [];
};

const valueFrom = (item: Record<string, any>, keys: string[]) => {
  for (const key of keys) {
    if (item[key] !== undefined && item[key] !== null && item[key] !== "") {
      return item[key];
    }
  }

  return undefined;
};

const normalizeResult = (
  item: unknown,
  api: IBloodBankApiConfig,
): NormalizedBloodBankResult | null => {
  if (!item || typeof item !== "object") return null;
  const value = item as Record<string, any>;

  const name = valueFrom(value, ["name", "bankName", "bloodBankName", "title"]);
  if (!name) return null;

  const coordinates = value.coordinates || value.location?.coordinates;
  const latitude = valueFrom(value, ["latitude", "lat"]) ?? coordinates?.lat;
  const longitude = valueFrom(value, ["longitude", "lng"]) ?? coordinates?.lng;

  return {
    id: String(valueFrom(value, ["id", "_id", "uuid"]) || ""),
    name: String(name),
    address: valueFrom(value, ["address", "location", "fullAddress"]),
    district: valueFrom(value, ["district", "city"]),
    division: valueFrom(value, ["division", "state"]),
    phone: valueFrom(value, ["phone", "contact", "contactNumber", "mobile"]),
    email: valueFrom(value, ["email"]),
    website: valueFrom(value, ["website", "url"]) || null,
    hours: valueFrom(value, ["hours", "openingHours"]),
    isOpen: valueFrom(value, ["isOpen", "open"]),
    rating: valueFrom(value, ["rating"]),
    bloodType: valueFrom(value, ["bloodType", "bloodGroup", "group"]),
    availability: valueFrom(value, ["availability", "stock"]),
    totalUnits: valueFrom(value, ["totalUnits", "units", "availableUnits"]),
    latitude: typeof latitude === "number" ? latitude : null,
    longitude: typeof longitude === "number" ? longitude : null,
    raw: value,
    source: {
      name: api.name,
      label: api.label,
      priority: api.priority,
    },
  };
};

const createApiUrl = (api: IBloodBankApiConfig, query: BloodBankSearchQuery, limit: number) => {
  const url = new URL(api.baseUrl);

  if (query.bloodType) url.searchParams.set("bloodType", query.bloodType);
  if (query.district) url.searchParams.set("district", query.district);
  if (query.division) url.searchParams.set("division", query.division);
  if (query.q) url.searchParams.set("q", query.q);
  url.searchParams.set("limit", String(limit));

  return url;
};

const fetchFromApi = async (
  api: IBloodBankApiConfig,
  query: BloodBankSearchQuery,
  limit: number,
  timeoutMs: number,
) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (api.apiKey) {
      headers["X-API-Key"] = api.apiKey;
    }

    const response = await fetch(createApiUrl(api, query, limit), {
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`API responded with ${response.status}`);
    }

    const payload = await response.json();
    return getResultArray(payload)
      .map((item) => normalizeResult(item, api))
      .filter((item): item is NormalizedBloodBankResult => Boolean(item));
  } finally {
    clearTimeout(timeout);
  }
};

const maskApiKey = (api: any) => ({
  ...api,
  apiKey: api.apiKey ? "********" : "",
});

export class BloodBankService {
  static async getOrCreateSettings(includeApiKeys = false) {
    const select = includeApiKeys ? adminSettingsFields : publicSettingsFields;
    let settings: any = await BloodBankSettings.findOne({ singletonKey: SETTINGS_KEY })
      .select(select);

    if (!settings) {
      settings = new BloodBankSettings({ singletonKey: SETTINGS_KEY });
      await settings.save();
      settings = await BloodBankSettings.findOne({ singletonKey: SETTINGS_KEY })
        .select(select);
    }

    if (!settings) {
      throw new ApiError(500, "Failed to load blood bank settings");
    }

    return settings;
  }

  static async getPublicSettings() {
    const settings = await this.getOrCreateSettings(false);
    const data = settings.toObject();

    return {
      ...data,
      apis: data.apis.map(maskApiKey),
    };
  }

  static async getAdminSettings() {
    const settings = await this.getOrCreateSettings(true);
    const data = settings.toObject();

    return {
      ...data,
      apis: data.apis.map(maskApiKey),
    };
  }

  static async updateSettings(body: BloodBankSettingsUpdate) {
    const update = sanitizeSettingsUpdate(body);

    const settings = await BloodBankSettings.findOneAndUpdate(
      { singletonKey: SETTINGS_KEY },
      { $set: update, $setOnInsert: { singletonKey: SETTINGS_KEY } },
      {
        new: true,
        upsert: true,
        runValidators: true,
      },
    ).select(adminSettingsFields);

    const data = settings.toObject();
    return {
      ...data,
      apis: data.apis.map(maskApiKey),
    };
  }

  static async search(query: BloodBankSearchQuery) {
    const settings = await this.getOrCreateSettings(true);
    const allowedBloodGroups = settings.allowedBloodGroups;

    if (!settings.isVisible) {
      return {
        isVisible: false,
        isMaintenance: false,
        message: "Blood bank section is hidden",
        sectionTitle: settings.sectionTitle,
        notice: settings.notice,
        results: [],
        sources: [],
      };
    }

    if (settings.isMaintenance) {
      return {
        isVisible: true,
        isMaintenance: true,
        message: settings.maintenanceMessage,
        sectionTitle: settings.sectionTitle,
        notice: settings.notice,
        results: [],
        sources: [],
      };
    }

    if (query.bloodType && !allowedBloodGroups.includes(query.bloodType as BloodGroup)) {
      return {
        isVisible: true,
        isMaintenance: false,
        message: "Blood group is not available in this section",
        sectionTitle: settings.sectionTitle,
        notice: settings.notice,
        allowedBloodGroups,
        results: [],
        sources: [],
      };
    }

    const page = clampPositiveInt(query.page, 1, { min: 1, max: 1000 });
    const limit = clampPositiveInt(query.limit, settings.maxResults, {
      min: 1,
      max: settings.maxResults,
    });
    const skip = (page - 1) * limit;
    const fetchLimit = Math.min(page * limit, settings.maxResults);

    const activeApis: IBloodBankApiConfig[] = (settings.apis as IBloodBankApiConfig[])
      .filter((api: IBloodBankApiConfig) => api.isActive)
      .sort((a: IBloodBankApiConfig, b: IBloodBankApiConfig) => a.priority - b.priority);

    const apiQuery = { ...query, limit: String(fetchLimit) };

    const responses = await Promise.allSettled(
      activeApis.map((api: IBloodBankApiConfig) =>
        fetchFromApi(api, apiQuery, fetchLimit, settings.requestTimeoutMs),
      ),
    );

    const allResults = responses
      .flatMap((response) => (response.status === "fulfilled" ? response.value : []))
      .filter((item) => !item.bloodType || allowedBloodGroups.includes(item.bloodType as BloodGroup))
      .sort((a, b) => a.source.priority - b.source.priority);

    const results = allResults.slice(skip, skip + limit);

    return {
      isVisible: true,
      isMaintenance: false,
      message: "Blood bank results retrieved successfully",
      sectionTitle: settings.sectionTitle,
      notice: settings.notice,
      allowedBloodGroups,
      maxResults: settings.maxResults,
      page,
      limit,
      results,
      sources: activeApis.map((api: IBloodBankApiConfig, index: number) => ({
        name: api.name,
        label: api.label,
        priority: api.priority,
        status: responses[index]?.status || "unknown",
      })),
    };
  }
}
