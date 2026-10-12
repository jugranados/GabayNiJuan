import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { isIndexableClaimStatus } from '@/domain/currentRecords';
import { ClaimDetail } from '@/features/sources/components/ClaimDetail';
import { claimPath } from '@/features/politicians/paths';
import { VERIFICATION_STATE_INFO } from '@/features/sources/verificationStates';
import { pageMetadata } from '@/lib/site';
import { getRepositories } from '@/server/repositories';

export const revalidate = 60;
export const generateStaticParams = () => [];

const loadClaim = cache((id: string) => getRepositories().claims.getClaimDetail(id));

export async function generateMetadata({ params }: PageProps<'/claims/[id]'>): Promise<Metadata> {
  const { id } = await params;
  const detail = await loadClaim(id);
  if (!detail) return { title: 'Claim not found', robots: { index: false, follow: false } };
  const status = VERIFICATION_STATE_INFO[detail.claim.verificationStatus].label;
  const about = detail.subject ? ` about ${detail.subject.displayName}` : '';
  // The statement itself stays out of the title and description: shown without its
  // status and sources in a search result, it could read as established fact.
  return pageMetadata({
    title: `Claim${about} — Evidence and Sources`,
    description: `Verification status: ${status}. The sources that support or conflict with one statement${about}, with publisher, source type, publication and retrieval dates.`,
    path: claimPath(detail.claim.id),
    // Unverified, disputed and outdated statements stay linkable but are not offered to search engines.
    noIndex: !isIndexableClaimStatus(detail.claim.verificationStatus),
  });
}

export default async function ClaimPage({ params }: PageProps<'/claims/[id]'>) {
  const { id } = await params;
  const detail = await loadClaim(id);
  if (!detail) notFound();
  return <ClaimDetail detail={detail} />;
}
