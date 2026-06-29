# Registry file schema

The **Registry** is the source of truth for which repos an Instance aggregates
(see [ADR-0002](adr/0002-explicit-registry-via-linking.md) and the CONTEXT.md
glossary). It is a `repos/` directory at the Instance root with **one file per
peered repo**:

```
repos/<owner>/<repo>.json
```

One file per repo keeps concurrent onboarding PRs conflict-free and makes the
tracked set greppable. The directory is maintained only by **Linking**, never
hand-edited.

## File shape

The **filename is canonical**: `<owner>` and `<repo>` are taken from the path.
The body carries optional link metadata. A minimal valid file is `{}`.

```json
{
  "owner": "jamesagarside",
  "repo": "beachfront",
  "linkedAt": "2026-06-29",
  "linkedBy": "jamesagarside"
}
```

| Field      | Type             | Required | Notes                                                            |
| ---------- | ---------------- | -------- | ---------------------------------------------------------------- |
| `owner`    | string           | no       | If present, **must** equal the `<owner>` segment of the path.    |
| `repo`     | string           | no       | If present, **must** equal the `<repo>` segment of the path.     |
| `linkedAt` | string (ISO date) | no      | When the repo was linked, recorded by the Linking producer.      |
| `linkedBy` | string           | no       | GitHub login that opened the linking PR.                         |

`owner`/`repo` are restated in the body for readability and to catch a misfiled
entry — Beachfront rejects a file whose body conflicts with its path. Unknown
fields are ignored, so later slices can extend the shape without breaking older
Instances.

## How Beachfront reads it

Beachfront is a static SPA, so the Registry is read at **build time** via Vite's
`import.meta.glob('/repos/**/*.json')` and bundled in — no runtime fetch. See
`src/registry/registry.ts` (`loadRegistry`, `parseRegistry`, `parseRegistryFile`)
for the typed `RegistryRepo` structure. A linked repo the Viewer's token cannot
access simply does not render for them (ADR-0001); the Registry is a list of
*candidates*, and GitHub repo access remains the gate.
