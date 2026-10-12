import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { cache } from 'react';

import { toIsoDate } from '@/domain/currentRecords';
import { formatPersonName } from '@/domain/models/person';
import { isUuid } from '@/domain/slug';
import { ProfileView } from '@/features/politicians/components/ProfileView';
import { politicianPath } from '@/features/politicians/paths';
import { pageMetadata } from '@/lib/site';
import { getRepositories } from '@/server/repositories';

// Rendered on first request, then cached briefly. A correction or retraction is public within a minute.
export const revalidate = 60;
export const generateStaticParams = () => [];

const loadProfile = cache((slug: string) => getRepositories().people.getPersonProfileBySlug(slug));

export async function generateMetadata({
  params,
}: PageProps<'/politicians/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  const profile = await loadProfile(slug);
  if (!profile) return { title: 'Profile not found', robots: { index: false, follow: false } };
  const name = formatPersonName(profile.person);
  // Descriptive only: what the page contains, never a conclusion about the person.
  return pageMetadata({
    title: `${name} — Public Record`,
    description: `Documented public record of ${name}: election participation, public office history, political affiliations, education and policy positions. Each statement links to its sources and shows how it was verified.`,
    path: politicianPath(profile.person.slug),
  });
}

export default async function PoliticianPage({ params }: PageProps<'/politicians/[slug]'>) {
  const { slug } = await params;
  const profile = await loadProfile(slug);
  if (!profile) {
    // Links that used the database id (the retired mobile app's deep links) move to the slug URL.
    if (isUuid(slug)) {
      const person = await getRepositories().people.getPersonById(slug);
      if (person) permanentRedirect(politicianPath(person.slug));
    }
    notFound();
  }
  return <ProfileView profile={profile} today={toIsoDate(new Date())} />;
}
