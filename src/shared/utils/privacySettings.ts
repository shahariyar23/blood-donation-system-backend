const defaultPrivacySettings = {
  showPhone: false,
  showEmail: false,
  showLocation: true,
  showDonations: true,
  showSocials: true,
};

export const getPrivacySettings = (settings: any) => ({
  ...defaultPrivacySettings,
  ...(settings?.privacy || {}),
});

export const sanitizePublicDonor = <T extends Record<string, any>>(donor: T): T => {
  const privacy = getPrivacySettings(donor.settings);
  const sanitized: Record<string, any> = { ...donor };

  delete sanitized.settings;

  if (!privacy.showPhone) {
    delete sanitized.phone;
  }

  if (!privacy.showEmail) {
    delete sanitized.email;
  }

  if (!privacy.showLocation) {
    delete sanitized.location;
    delete sanitized.distance;
    delete sanitized.distanceKm;
  }

  if (!privacy.showDonations) {
    delete sanitized.donations;
    delete sanitized.totalDonations;
  }

  if (!privacy.showSocials) {
    delete sanitized.socialLinks;
    delete sanitized.primarySocialLink;
  }

  return sanitized as T;
};
