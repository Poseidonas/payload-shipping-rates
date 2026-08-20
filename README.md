# payload-shipping-rates

[![npm](https://img.shields.io/npm/v/payload-shipping-rates?style=flat-square&color=0F766E)](https://www.npmjs.com/package/payload-shipping-rates) ![node](https://img.shields.io/badge/node-%3E%3D20-339933?style=flat-square) ![license](https://img.shields.io/badge/license-MIT-6C757D?style=flat-square)

Gives a Payload shop shipping zones and shipping methods, an endpoint that says what a delivery to a given address costs, and a place on the order to record which method the customer chose.

- Zones matched by country and, optionally, by postcode, with one documented rule for deciding between them
- Flat rate, free over a threshold, weight bands, price bands and local pickup
- Every amount an integer in minor units, the same units `@payloadcms/plugin-ecommerce` stores prices in
- When nothing can be costed it says so and why, and never falls back to a cost of zero
- No runtime dependencies
- No admin components, so it survives minor releases

## Install

```bash
pnpm add payload-shipping-rates
```

```ts
import { shippingRatesPlugin } from 'payload-shipping-rates'

export default buildConfig({
  plugins: [
    shippingRatesPlugin({
      weightUnit: 'kg',
    }),
  ],
})
```

A `Shipping zones` collection appears in the admin panel, a `shipping` group appears on orders and carts, and `POST /api/shipping-rates/quote` starts answering.

## What was measured

Measured on 19 August 2026 against the published contents of `@payloadcms/plugin-ecommerce@3.88.0`.

**The official plugin does not calculate shipping.** Every occurrence of the word in the published package, in full:

| Where | What it is |
| --- | --- |
| `orders` | one `shippingAddress` group, built from the address fields, on a tab labelled `shipping` |
| `initiatePayment` and the Stripe adapter | that same address read from the request and handed to the payment provider |
| two doc comments | the word `shipping`, describing that address |

That is the whole of it. `zone` occurs zero times. `carrier` occurs zero times. `parcel` occurs zero times. `rate` never occurs as a shipping rate, only inside words such as `separate` and `generated`. A cart carries no shipping address at all, so nothing before checkout even knows where the order is going. The plugin collects a destination and then charges the cart subtotal.

**Amounts are integers in minor units.** `dist/ui/utilities.js` converts a typed price with `Math.round(value * Math.pow(10, currency.decimals))`, and EUR, USD and GBP are all declared with `decimals: 2`. So `4.90` is stored as `490`. Every amount in this package is the same kind of integer, and nothing here divides.

**The address fields the plugin generates** are `title`, `firstName`, `lastName`, `company`, `addressLine1`, `addressLine2`, `city`, `state`, `postalCode`, `country` and `phone`. This package reads two of them, `country` and `postalCode`.

**Order status options** are `processing`, which is the default, `completed`, `cancelled` and `refunded`. Recording a chosen shipping method does not touch any of them.

## Zone precedence

Several zones can cover one address. Exactly one of them serves it, and its methods are the only methods offered. The winner is chosen by three rules, applied in this order and no other:

1. **The higher `priority`.** An explicit number always wins, so a shop can force an answer without rearranging anything. A missing priority counts as `0`.
2. **The higher specificity.** A zone that matched through one of its postcode patterns scores 2. A zone that listed the destination country by name scores 1 more than one that matched through the wildcard `*`. So a postcode match beats a country match, and a named country beats `*`.
3. **The lower zone id.** A final tie is broken by id, so the same cart and the same address always get the same answer.

| Zone | Countries | Postcodes | Priority | Score for `GB`, `SW1A 1AA` |
| --- | --- | --- | --- | --- |
| London | `GB` | `SW1*` | 0 | 3, and it wins |
| United Kingdom | `GB` | none | 0 | 1 |
| Rest of world | `*` | none | 0 | 0 |

A zone whose country list is empty covers nothing. A zone that restricts postcodes and whose patterns do not match is out of the running entirely; it does not fall back to a country match.

### Postcode patterns

The destination postcode is uppercased and stripped of everything that is not a letter or a digit, so `sw1a 1aa`, `SW1A-1AA` and `SW1A1AA` are one postcode. Each pattern is then read in this order:

| Form | Example | Matches |
| --- | --- | --- |
| numeric range | `1000...1999` | any all digit postcode from 1000 to 1999, both ends included |
| prefix wildcard | `SW1*` | any postcode starting `SW1`, including `SW1` itself |
| everything | `*` | every postcode, including an absent one |
| exact | `SW1A 1AA` | that postcode only |

A range is compared as a number, so `900...1100` covers `1000`. A range never applies to a postcode containing a letter.

## Methods

Each zone holds any number of methods. Every amount is in minor units.

| Type | Fields it uses | Cost |
| --- | --- | --- |
| `flat` | `amount` | `amount`, always |
| `free_over` | `threshold` | `0` at or above the subtotal threshold. Below it, the method is withdrawn |
| `weight_bands` | `bands` | the band the cart weight falls into |
| `price_bands` | `bands` | the band the cart subtotal falls into |
| `local_pickup` | `amount` | `amount`, or `0` when none is set |

A band has a `from`, an optional `to` and an `amount`. **`from` is inclusive, `to` is exclusive**, so bands of `0 to 1`, `1 to 5` and `5 upwards` leave neither a gap nor an overlap. A band with no `to` runs without an upper bound. Bands are sorted by `from` before they are read, so the order they were entered in never changes the answer.

Weight band boundaries are written in the configured `weightUnit` and converted to whole grams with the same rounding `payload-shipping-classes` uses when it stores a weight, so a boundary of `5` lb and a product of `5` lb both become `2268` g and land on the same side of the line. Price band boundaries are already minor units and are not converted.

### When a method cannot be costed

It is withdrawn with a reason. It is never quoted at zero.

| Reason | Meaning |
| --- | --- |
| `below_threshold` | a `free_over` method whose threshold the subtotal has not reached |
| `class_excluded` | the cart carries a shipping class the method refuses |
| `misconfigured` | the method is missing a value it cannot work without, such as a flat rate with no amount |
| `no_band` | the bands leave a gap and the cart falls in it |
| `subtotal_unknown` | no subtotal was supplied and the method needs one |
| `weight_unknown` | no weight was supplied and the method needs one |

And when no zone covers the address at all, the answer is `available: false` with `reason: 'no_matching_zone'` and an empty method list. A shop that would rather charge something than nothing must configure a zone with `*` in its country list; this package will not invent one.

## The endpoint

```
POST /api/shipping-rates/quote
```

```json
{
  "address": { "country": "GB", "postalCode": "SW1A 1AA" },
  "cartID": "68f0c4c2b1a3d90012ab34cd",
  "secret": "the guest cart secret, when there is one"
}
```

Given a `cartID` the endpoint reads the subtotal, the currency, the weight and the shipping classes from the cart. Any of those four given in the body directly wins over what the cart says, and a request that supplies them all needs no `cartID`:

```json
{
  "address": { "country": "GB", "postalCode": "SW1A 1AA" },
  "subtotal": 4990,
  "weightGrams": 1250,
  "shippingClasses": ["bulky"]
}
```

The answer:

```json
{
  "available": true,
  "reason": null,
  "zone": { "id": 2, "name": "London", "priority": 0 },
  "methods": [
    { "code": "standard", "label": "Standard", "type": "flat", "amount": 490 },
    { "code": "next-day", "label": "Next day", "type": "flat", "amount": 990 }
  ],
  "unavailable": [
    { "code": "free-shipping", "label": "Free shipping", "type": "free_over", "reason": "below_threshold" }
  ],
  "subtotal": 4990,
  "weightGrams": 1250,
  "shippingClasses": ["bulky"],
  "currency": "GBP",
  "destination": { "country": "GB", "postalCode": "SW1A 1AA" }
}
```

Methods come back cheapest first, ties broken by the order they were entered in the zone. The request returns `400` when no destination country was given and `404` when a `cartID` cannot be read; every other answer is `200`, including the one that says no zone matched.

The cart is read through the request that is already open, so it joins the transaction Payload started for that request rather than taking a second connection from the pool.

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `cartsSlug` | `'carts'` | Slug of the carts collection |
| `disabled` | `false` | Stops the endpoint being registered but keeps the collection and the fields, so the database keeps its shape |
| `endpointPath` | `'/shipping-rates/quote'` | Path of the quote endpoint, relative to the API route |
| `fieldName` | `'shipping'` | Group holding the chosen method on orders and carts |
| `ordersSlug` | `'orders'` | Slug of the orders collection |
| `shippingClassFieldName` | `'shippingClass'` | Field on products and variants holding the class |
| `weightFieldName` | `'weightGrams'` | Field on products and variants holding the weight in whole grams |
| `weightUnit` | `'kg'` | Unit weight band boundaries are written in. One of `g`, `kg`, `oz`, `lb` |
| `zonesOverrides` | `{}` | Merged over the generated zones collection, applied last |
| `zonesSlug` | `'shipping-zones'` | Collection holding the zones |

An unusable value is replaced by its default rather than applied. An unknown weight unit falls back to `kg`, a name given as an empty string falls back to its default name, and an endpoint path given without a leading slash gets one.

## What it adds to your database

| Collection | Field | Type | Notes |
| --- | --- | --- | --- |
| `shipping-zones` | `name` | text | required |
| `shipping-zones` | `countries` | text, many | required. Two letter codes, or `*` |
| `shipping-zones` | `postcodes` | text, many | optional. Empty covers every postcode in those countries |
| `shipping-zones` | `priority` | number | indexed, defaults to `0` |
| `shipping-zones` | `methods` | array | `label`, `code`, `type`, `amount`, `threshold`, `bands`, `excludedShippingClasses` |
| your orders collection | `shipping` | group | `method`, `label`, `type`, `zone`, `amount` |
| your carts collection | `shipping` | group | the same five, added only when the collection exists |

`shipping.method` is indexed. `shipping.amount` is minor units, so `490` is `4.90`.

The `shipping-zones` collection is readable by anyone and writable by any authenticated user. Pass `zonesOverrides` with your own `access` to narrow that to your administrators.

## Without payload-shipping-classes

The two packages are built to be used together and neither requires the other. This one reads `weightGrams` and `shippingClass` off products and variants, by those names, which are the names `payload-shipping-classes` writes. It does not import it, does not declare it, and does not check for it.

With no weights anywhere in the catalogue:

| Method type | Behaviour |
| --- | --- |
| `flat` | works |
| `free_over` | works |
| `price_bands` | works |
| `local_pickup` | works |
| `weight_bands` | withdrawn with `weight_unknown`, unless the caller supplies `weightGrams` in the request body |

So a shop that never weighed anything can still charge by order value, and a shop that stores weights some other way can supply `weightGrams` itself.

## Using the calculation without the endpoint

`quoteShipping` is pure. It reads nothing, writes nothing, and given the same input always returns the same answer, so a checkout can price a cart on the server without going through HTTP.

```ts
import { quoteShipping } from 'payload-shipping-rates'

const zones = await payload.find({ collection: 'shipping-zones', pagination: false, req })

const quote = quoteShipping({
  destination: { country: 'GB', postalCode: 'SW1A 1AA' },
  subtotal: 4990,
  weightGrams: 1250,
  shippingClasses: ['bulky'],
  weightUnit: 'kg',
  zones: zones.docs,
})
```

`matchZones`, `selectZone`, `quoteMethods`, `matchesPostcode` and `readCartShipping` are exported too, for a shop that needs one step of it rather than all of them.

## Honest limits

**The cost recorded on an order is not enforced.** The `shipping` group is a record of what the customer chose. The amount actually charged is decided by the payment adapter, which sets the order's own `amount` and knows nothing about this package. A checkout that means to charge for delivery must add the quoted amount to the payment intent itself, and should quote again on the server before it does, rather than trusting a figure that came back from the browser.

**Nothing is added to the order total.** This package does not modify `amount` on orders or `subtotal` on carts. Those belong to the official plugin, and fighting it over them would break on its next release.

**One zone serves an address.** The methods of a second matching zone are never merged in. If a shop wants a courier from one zone and a pickup point from another, both belong in the winning zone.

**Countries are compared as text.** A zone lists `GB` and an address says `GB`. Nothing validates the code against ISO 3166, expands `UK` to `GB`, or knows that Jersey is not the United Kingdom. Whatever the address collection stores is what has to be listed.

**No per class pricing.** A method can refuse a shipping class through `excludedShippingClasses`, and that is all. There is no per class surcharge and no per item handling fee, because both need per line pricing and this package prices a cart, not a line.

**No dimensions.** Volumetric weight, girth and box packing are not calculated. A weight band is the only physical measure used.

**No carrier integration.** No live rates, no label printing, no tracking. The zones are what a shop typed in, and the answer is arithmetic over them.

**Free shipping is a method, not a discount.** `free_over` withdraws itself below its threshold rather than falling back to a paid rate. A shop that wants a flat rate below the threshold and nothing above it configures both methods, and both appear once the threshold is passed, cheapest first.

## License

MIT. Copyright George Vasiliades, https://github.com/Poseidonas
