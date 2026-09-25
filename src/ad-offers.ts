import type { RunReceipt } from "./progression";
import type { State } from "./simulation";

/**
 * Rewarded revives this run already took. Automatic revives spend `s.revives`; an
 * ad revive only counts in `stats.revivesUsed`. Derived from the state, so a run
 * restored after a reload still remembers its ad revive.
 */
export function adRevivesUsed(
  s: Pick<State, "revives" | "config" | "stats">,
): number {
  return Math.max(0, s.stats.revivesUsed - (s.config.revives - s.revives));
}

/** Where the result's double-parts offer stands for one recorded run. */
export type DoublePartsState = "offer" | "pending" | "granted" | "failed";

type OfferContext = {
  /** Co-op runs never show either offer. */
  solo: boolean;
  /** `rewardedAdsAvailable()` right now. */
  available: boolean;
};

/**
 * Once-per-run bookkeeping for the two rewarded-ad offers: a revive when a solo run
 * is lost, and doubled parts on the result. Re-renders (a language change, a redraw)
 * read the same answers and never reopen an offer.
 */
export class AdOffers {
  private revives = new Set<string>();
  private doubles = new Map<
    string,
    { state: Exclude<DoublePartsState, "offer">; bonus: number }
  >();

  /**
   * True once, the first time a run is lost with ads available: the caller shows the
   * offer and records the run only after the player's decision. Every later call for
   * that run (including after an ad revive) is false and goes straight to results.
   */
  offerRevive(
    runId: string,
    s: Pick<State, "phase" | "revives" | "config" | "stats">,
    { solo, available }: OfferContext,
  ): boolean {
    if (
      !solo ||
      !available ||
      s.phase !== "lost" ||
      this.revives.has(runId) ||
      adRevivesUsed(s) > 0
    )
      return false;
    this.revives.add(runId);
    return true;
  }

  /** The double-parts offer for a recorded run, or null when the result shows none. */
  doubleParts(
    receipt: Pick<RunReceipt, "runId" | "earned"> | null,
    { solo, available }: OfferContext,
  ): DoublePartsState | null {
    if (!receipt || !solo) return null;
    const used = this.doubles.get(receipt.runId);
    if (used) return used.state;
    return available && receipt.earned > 0 ? "offer" : null;
  }

  /** The ad was requested; the offer stays visible but ignores input until it settles. */
  startDouble(runId: string) {
    if (!this.doubles.has(runId))
      this.doubles.set(runId, { state: "pending", bonus: 0 });
  }

  /** Settles a pending request: the bonus actually banked, or null when no ad played. */
  finishDouble(runId: string, bonus: number | null) {
    if (this.doubles.get(runId)?.state !== "pending") return;
    this.doubles.set(
      runId,
      bonus === null
        ? { state: "failed", bonus: 0 }
        : { state: "granted", bonus: Math.max(0, bonus) },
    );
  }

  /** Parts the double-parts ad added to this run's bank. */
  bonus(runId: string): number {
    return this.doubles.get(runId)?.bonus ?? 0;
  }
}
