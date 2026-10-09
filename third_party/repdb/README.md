# RepDB application integration

Exercise data by [RepDB](https://repdb.co/).

The JSON exercise data, English instructions and WebP images belong to RepDB and are governed by **RepDB Free Tier License v1.0**, not Fitness's application-code license. The accompanying LICENSE.md and ATTRIBUTION.md are preserved from the pinned official archive.

- Official source: https://github.com/RepDB/exercise-dataset
- Official archive: https://cdn.repdb.co/repdb-assets/site/repdb-free.zip
- Archive SHA256: `8f0ffe22025df4d9e915a5cbd5577479f240559c7e2c62203d7298be82df20c6`
- Verified archive: 27,341,187 bytes; schema v3 `free.json`; 637 exercises; 489 start/peak pairs and 148 main images; 1,126 exercise images.
- Catalog integration revision: `2026.10.1`. Chinese display names/search aliases are maintained by Fitness. Instructions and tips remain the original English and are labeled accordingly.

## Distribution boundary

The license permits attributed use inside applications and prohibits redistribution as a dataset, derivative dataset repository, or API. Fitness's public Git repository contains adapter code, terminology rules, synthetic tests and these notices. It **does not contain** the source ZIP, generated provider JSON, or bulk image files. These are ignored build inputs/outputs.

`npm run catalog:prepare` downloads the official archive when no local cache exists, verifies its pinned SHA256, validates the data, and produces local application resources. A hash change fails the build and requires source/license review; do not bypass it. A clean checkout therefore requires access to the official CDN once. Subsequent preparation can use the verified local cache.

Only referenced free exercise poses are copied into `public/exercise-media/repdb`. Premium previews, icons, locale dumps and source ZIPs are not application assets. The generated directory is imported by application code; it is not exposed as a JSON dataset endpoint. The app has no bulk download/export API for this content. User backup exports contain training facts and snapshots, not provider instructions, images or the source dataset.

Visible attribution is provided in Settings → About & credits, on RepDB image cards and in RepDB image details using one shared component. License notices are available in the built app. Existing original Fitness illustrations and video source notices remain separately identified.

No generative image processing, image restyling, background removal, model training, premium assets, API key or proxy backend is used. In-app static image hosting is the implementation's reading of the license's in-app permission; this is not permission to publish a reusable dataset or a legal opinion. Reassess before distributing bulk build artifacts as a dataset or changing the use case.
