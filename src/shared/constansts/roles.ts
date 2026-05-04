export const ROLES = {
	ADMIN: "admin",
	USER: "user",
	DONOR: "donor",
	HOSPITAL: "hospital",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];
