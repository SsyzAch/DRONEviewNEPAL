import { ValidationContext, Authority, RegulatoryCitation } from "../types";

/**
 * Consolidates, deduplicates, and structures legal authority citations.
 */
export class CitationEngine {
  /**
   * Translates rule citations into human-readable legal basis descriptions.
   */
  public compileCitations(
    context: ValidationContext,
    authorities: Authority[],
    citations: RegulatoryCitation[]
  ): void {
    const authMap = new Map<string, Authority>();
    for (const auth of authorities) {
      authMap.set(auth.id, auth);
    }

    const citationMap = new Map<string, RegulatoryCitation>();
    for (const cit of citations) {
      citationMap.set(cit.id, cit);
    }

    const uniqueCitations = new Map<
      string,
      {
        id: string;
        documentId: string;
        authorityName: string;
        legalBasis: string;
        officialCircular: string;
        section: string;
        page: number;
        quoteStart: string;
        quoteEnd: string;
        ocrConfidence: number;
      }
    >();

    for (const matchedRule of context.results.matchedRules) {
      const ids = matchedRule.citationIds || [];
      for (const citId of ids) {
        const citation = citationMap.get(citId);
        if (!citation) {
          continue; // Orphan citation ID
        }

        const authority = authMap.get(citation.authorityId);
        const authorityName = authority ? authority.name : citation.authorityId;

        if (!uniqueCitations.has(citation.id)) {
          uniqueCitations.set(citation.id, {
            id: citation.id,
            documentId: citation.documentId,
            authorityName,
            legalBasis: citation.legalBasis,
            officialCircular: citation.officialCircular,
            section: citation.section,
            page: citation.page,
            quoteStart: citation.quoteStart,
            quoteEnd: citation.quoteEnd,
            ocrConfidence: citation.ocrConfidence,
          });
        }
      }
    }

    context.results.citations = Array.from(uniqueCitations.values());
  }
}
