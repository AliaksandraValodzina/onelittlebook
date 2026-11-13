/**
 * **The wall between the two artwork stores, asserted by the compiler.**
 *
 * `lib/artwork/store.ts` § The one thing that may never cross is the argument:
 * the looks bucket is public — a custom domain is attached to it, so everything
 * in it is readable by anybody — and holds the same twenty-four pictures for
 * every buyer; the order-artwork bucket is private and holds artwork
 * regenerated from a photograph of one family's child. A per-order picture in
 * the public bucket would be a guessable URL for somebody's baby, which is the
 * worst thing this product could do.
 *
 * **Both buckets are now on one provider, with one API token covering both, so
 * this file carries more than it did.** When the two were a Vercel Blob token
 * and an OIDC store id, the credentials themselves were part of the wall. They
 * are not any more: the only thing separating the two in a signed request is
 * the bucket name in the path. So the two *configurations* are mutually
 * unassignable as well as the two stores, and `publicBase` — the field that
 * turns bytes into a URL — **does not exist at all** on the private one.
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
import {
  looksR2Store,
  orderArtworkR2Store,
  r2ObjectApi,
  type LooksBucket,
  type OrderArtworkBucket,
} from "../lib/artwork/r2";
import { objectScreenStore } from "../lib/artwork/object-store";

/** Stands for every function that writes a buyer's regenerated artwork. */
declare function keepPerOrderArtwork(store: PrivateArtworkStore): void;
/** Stands for every function that writes the captain's released artwork. */
declare function keepReleasedArtwork(store: PublicArtworkStore): void;

const LOOKS_BUCKET: LooksBucket = {
  for: "looks",
  accountId: "account",
  bucket: "onelittlebook-looks",
  accessKeyId: "key",
  secretAccessKey: "secret",
  publicBase: "https://art.onelittlebook.test",
};

const ORDERS_BUCKET: OrderArtworkBucket = {
  for: "order-artwork",
  accountId: "account",
  bucket: "onelittlebook-orders",
  accessKeyId: "key",
  secretAccessKey: "secret",
};

const looks = looksR2Store(LOOKS_BUCKET);
const orders = orderArtworkR2Store(ORDERS_BUCKET);
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

// @ts-expect-error the public bucket's store cannot hold per-order artwork
keepPerOrderArtwork(looks);

// @ts-expect-error nor can the local store keyed for release sets
keepPerOrderArtwork(localLooks);

// --- Nor the other way: released artwork does not go in the private store ---

// @ts-expect-error the private bucket's store is not where the looks' pages go
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

// --- The two bucket CONFIGURATIONS cannot be mistaken for each other -------
//
// This is the wall that arrived with both halves being on one provider. One
// token covers both buckets, so the bucket name in the path is the only thing
// separating a public read from a customer's child — which means the two
// configurations have to be as unassignable as the two stores are.

// @ts-expect-error the private bucket's configuration is not a public one: there is no publicBase on it
const notLooks: LooksBucket = ORDERS_BUCKET;

// @ts-expect-error nor the other way, even though it has every field: the `for` tag is what stops it
const notOrders: OrderArtworkBucket = LOOKS_BUCKET;

// @ts-expect-error so the public store cannot be built against the private bucket
void looksR2Store(ORDERS_BUCKET);

// @ts-expect-error nor the private store against the public bucket
void orderArtworkR2Store(LOOKS_BUCKET);

// @ts-expect-error and there is nowhere to put a public base on the private configuration
const noBase: OrderArtworkBucket = { ...ORDERS_BUCKET, publicBase: "https://art.onelittlebook.test" };

// --- A store with no domain may not have the operations that make URLs -----
//
// `objectScreenStore` exists only to turn a digest into a URL, so it takes the
// public base as a non-optional `string`. There is therefore no way to compose
// it onto a private bucket, which is the runtime half of `orders.putScreens`
// not existing — `test/no-derivative-in-a-print-file.ts` is that half.

// @ts-expect-error a screen store with no origin to serve from is not a thing
void objectScreenStore(r2ObjectApi(ORDERS_BUCKET), null);

// @ts-expect-error nor one with no origin at all
void objectScreenStore(r2ObjectApi(ORDERS_BUCKET));

// `noUnusedLocals` is off in this project, but naming them keeps the
// declarations above from reading as dead code to a person.
export const checked = { notPrivate, notPublic, notLooks, notOrders, noBase };
