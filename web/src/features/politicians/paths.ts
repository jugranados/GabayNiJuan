export const politicianPath = (slug: string): string => `/politicians/${slug}`;
export const claimPath = (claimId: string): string => `/claims/${encodeURIComponent(claimId)}`;

export function reportErrorPath(target: { type: 'PERSON' | 'CLAIM'; id: string }): string {
  return `/corrections/report?type=${target.type.toLowerCase()}&id=${encodeURIComponent(target.id)}`;
}
