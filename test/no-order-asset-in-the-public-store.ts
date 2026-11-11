/**
 * **The wall between the two artwork stores, asserted by the compiler.**
 *
 * `lib/artwork/store.ts` § The one thing that may never cross is the argument:
 * `olb-looks` is public and holds the same twenty-four pictures for every
 * buyer; `olb-orders` is private and holds artwork regenerated from a
 * photograph of one family's child. A per-order picture in the public store
 * would be a guessable URL for somebody's baby, which is the worst thing this
 * product could do.
 *
 * **This file is not a test and runs nothing.** Every statement in it is a call
 * that *must not compile*, marked `@ts-expect-error`. `tsc` reports an unused
 * `@ts-expect-error` as an error, so the day one of these becomes legal
 * `npm run lint` goes red — the assertion is carried by the typechecker the
 * whole repository already runs, on every pull request, with nothing to
 * remember.
 *
 * `test/artwork-separation.test.ts` is the other half: it reads this file to
 * make sure the directives are still here, and asserts the runtime refusals
 * that catch the same mistake made through a `string` the compiler cannot see
 * into.
 *
 * It is `.ts` and not `.test.ts` on purpose: `vitest.config.mts` collects
 * `test/**\/*.test.{ts,tsx}`, so the runner ignores this and `tsconfig.json`
 * (which includes every `.ts` in the project) does not.
 */

import { localReleaseStore } from "../lib/artwork/release";
import {
  localArtworkStore,
  localOrderStore,
  type PrivateArtworkStore,
  type PublicArtworkStore,
} from "../lib/artwork/store";
import { looksBlobStore, ordersBlobStore } from "../lib/artwork/blob";

/** Stands for every function that writes a buyer's regenerated artwork. */
declare function keepPerOrderArtwork(store: PrivateArtworkStore): void;
/** Stands for every function that writes the captain's released artwork. */
declare function keepReleasedArtwork(store: PublicArtworkStore): void;

const looks = looksBlobStore("vercel_blob_rw_storeid_secret");
const orders = ordersBlobStore("storeid", "an-oidc-token");
const localLooks = localReleaseStore("/tmp/looks");
const localOrders = localOrderStore("/tmp/orders");
/** The untagged factory both of the above are built on. */
const untagged = localArtworkStore("/tmp/either");

// The four calls that are correct, so the eight below are not failing for some
// unrelated reason. (A file of nothing but expected errors passes when the
// imports are broken.)
keepReleasedArtwork(looks);
keepReleasedArtwork(localLooks);
keepPerOrderArtwork(orders);
keepPerOrderArtwork(localOrders);

// --- A buyer's regenerated artwork may never be handed to the public store ---

// @ts-expect-error the public Blob store cannot hold per-order artwork
keepPerOrderArtwork(looks);

// @ts-expect-error nor can the local store keyed for release sets
keepPerOrderArtwork(localLooks);

// --- Nor the other way: released artwork does not go in the private store ---

// @ts-expect-error the private Blob store is not where the looks' pages go
keepReleasedArtwork(orders);

// @ts-expect-error nor is the local per-order directory
keepReleasedArtwork(localOrders);

// --- An untagged store is neither, so it cannot stand in for either ---

// @ts-expect-error `localArtworkStore` is the shared implementation, not a store anybody may use
keepPerOrderArtwork(untagged);

// @ts-expect-error same, for the public side
keepReleasedArtwork(untagged);

// --- And the two types are not assignable to each other at all ---

// @ts-expect-error there is no widening cast, no helper, and no structural overlap
const notPrivate: PrivateArtworkStore = looks;

// @ts-expect-error the same statement in the other direction
const notPublic: PublicArtworkStore = orders;

// `noUnusedLocals` is off in this project, but naming them keeps the two
// declarations above from reading as dead code to a person.
export const checked = { notPrivate, notPublic };
