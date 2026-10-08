/**
 * Directory (browse + search) read models and query contract.
 *
 * Nothing here ranks or scores a person. Ordering is alphabetical by name and
 * nothing else; filters only use documented, structured fields.
 */
import type { AffiliationType, ElectionParticipationStatus, OfficeLevel } from '@/domain/enums';
import type { IsoDate, Office } from '@/domain/models';

export type DirectoryFilters = {
  electionId?: string;
  officeId?: string;
  officeLevel?: OfficeLevel;
  participationStatus?: ElectionParticipationStatus;
  /** Any documented affiliation record with this organization, in any period. */
  organizationId?: string;
  /**
   * Opaque jurisdiction id as stored on offices. Supported by the query so a
   * location filter can be added once jurisdictions have names; the UI does
   * not expose it yet.
   */
  jurisdictionId?: string;
};

export type DirectoryFilterKey = keyof DirectoryFilters;

/** The only supported ordering. Political relevance/popularity sorts must never be added. */
export type DirectorySort = 'NAME_ASC';

export type PageRequest = {
  limit?: number;
  offset?: number;
};

export type DirectoryQuery = {
  /** Free-text name search. Ignored while shorter than MIN_SEARCH_LENGTH after trimming. */
  query?: string;
  filters?: DirectoryFilters;
  sort?: DirectorySort;
  page?: PageRequest;
};

export type Page<T> = {
  items: T[];
  /** Total rows matching the query, independent of the page. */
  total: number;
  /** Offset of the next page, or undefined when this is the last page. */
  nextOffset?: number;
};

/** One election participation, shown on a directory card as context. */
export type DirectoryParticipation = {
  officeName: string;
  electionName: string;
  electionDate: IsoDate;
  status: ElectionParticipationStatus;
  effectiveFrom: IsoDate;
};

/** A dated affiliation record that is current by its dates and has supporting evidence. */
export type DirectoryAffiliation = {
  organizationName: string;
  affiliationType: AffiliationType;
  startDate: IsoDate;
};

/**
 * Lightweight card model. Deliberately contains no claims, sources, counts or
 * statistics; those load with the profile.
 */
export type DirectoryEntry = {
  id: string;
  displayName: string;
  photoAssetId?: string;
  /** Most recent election first. */
  participations: DirectoryParticipation[];
  affiliation?: DirectoryAffiliation;
};

export type ElectionOption = { id: string; name: string; electionDate: IsoDate };
export type OfficeOption = Pick<Office, 'id' | 'name' | 'level' | 'jurisdictionId'>;
export type OrganizationOption = { id: string; name: string; abbreviation?: string };

/** Reference lists that populate the filter UI. */
export type DirectoryFilterOptions = {
  elections: ElectionOption[];
  offices: OfficeOption[];
  organizations: OrganizationOption[];
};
