# package-template

Skeleton for a `jperezmart` npm package repo: **changesets + CI + release via npm
OIDC trusted publishing, with provenance and no npm token anywhere.**

> **Start here:** click **[Use this template](https://github.com/jperezmart/package-template/generate)**.
> That button is the entry point for a new package. To bring an _existing_ repo up
> to the standard, copy [the canon](#the-canon) into it and satisfy
> [the contract](#the-contract) — do not copy the rest.

---

## The three layers

Everything in this repo belongs to exactly one of three layers, and they have very
different rules. Knowing which layer a file is in tells you whether you may touch it.

| Layer           | Files                                                                                                                                                         | Rule                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Canon**       | `.github/workflows/release.yml`, `.changeset/config.json`                                                                                                     | Copied verbatim. Do not let it diverge — breaking it breaks publishing. |
| **Scaffolding** | `ci.yml`, `renovate.json5`, `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.json`, `eslint.config.mjs`, `prettier.config.mjs`, `packages/core` | A working starting point. Delete or rewrite freely.                     |
| **Contract**    | this README                                                                                                                                                   | What an adopting repo must satisfy, **whatever files it has**.          |

Only the canon is standardised. Each repo keeps its own build, lint and tsconfig on
purpose — that is what "scaffolding, not canon" means.

> [!WARNING]
> **The scaffolding ages, and it is not a live reference.** It is _copied_, so it
> starts diverging from the real repos the moment you use it — by design. Do not
> read it to find out what `jperezmart/nest-casl` does today; read `nest-casl`.
> The canon and this contract are the parts that stay true.

### Why the canon is copied rather than shared

Because npm gives no alternative. A trusted publisher is bound to a workflow
**filename in the publishing repository**, so `release.yml` has to physically exist
in every repo. Reusable workflows do not help: npm validates the _calling_
workflow's name, and `id-token: write` is then needed in both parent and child.

This is not a local quirk. `TanStack/config` has full inherit machinery for shared
configuration and still copies its release workflows into every repo, for exactly
this reason.

---

## The canon

### `.github/workflows/release.yml`

Copy it verbatim. **Never rename it** — the filename is what npm binds to, so a
rename silently breaks releases for every package configured against this repo.

It accepts exactly three edits, marked in the files as _holes_:

| #   | Hole               | Where                      | What to do                                                |
| --- | ------------------ | -------------------------- | --------------------------------------------------------- |
| 1   | the build step     | `release.yml`              | Delete `- run: pnpm run build` if your repo has no build. |
| 2   | the changelog repo | `.changeset/config.json`   | Set `"repo"` to `owner/name` — literal, not derived.      |
| 3   | `&& pnpm format`   | `changeset:version` script | Delete it if your repo has no formatter.                  |

Two things about it that look like oversights and are not:

- **No `registry-url` in `setup-node`.** It writes an `_authToken` line into
  `.npmrc`, which makes pnpm fail the publish with `E404` on the `PUT`. Trusted
  publishing needs no registry auth at all. Add it back only for private deps.
- **No `NPM_TOKEN`, and no `--provenance` flag.** Under trusted publishing,
  provenance is automatic. See [Never add `provenance=true`](#never-add-provenancetrue).

The build lives in its own workflow step rather than inside `changeset:publish`.
The cost is that it also runs on the runs that only open or update the version PR;
what it buys is that `changeset:publish` is then **literally identical in every
repo**, and all per-repo variation sits in one deletable line.

`release.yml` never mentions turbo or `packages/`. It goes through two root scripts
by indirection, which is what lets one canon serve a monorepo and a lone package
alike. **Preserve that when you edit it.**

### `.changeset/config.json`

Copy it, then fill hole 2. `"access": "public"` is required for scoped packages.
`onlyUpdatePeerDependentsWhenOutOfRange` is carried deliberately despite its
alarming `___experimentalUnsafeOptions_WILL_CHANGE_IN_PATCH` prefix: it does the
right thing for packages with peer dependencies, and it survives into the v4 config
schema.

---

## The contract

Whatever your repo's files look like, it must provide all eight:

1. **`packageManager: "pnpm@X"`** — pnpm is part of the standard; `release.yml`
   cannot be package-manager agnostic. Must be **≥ 10** (required by
   `@changesets/cli` v3) and **never 11.0.0–11.1.2**, where pnpm's native publish
   broke OIDC. `pnpm/action-setup` reads the version from this field, so the
   template pins no pnpm version of its own.
2. **`devEngines.runtime`** — `{ "name": "node", "version": "24.x.y", "onFail": "error" }`.
   Use a current **24 or later**; see [Why `devEngines`](#why-devengines-and-not-engines).
3. **Scripts named exactly `changeset:version` and `changeset:publish`.** The canon
   calls them by name.
4. **devDependencies `@changesets/cli` (^3) and `@changesets/changelog-github` (^1).**
5. **`repository` with the correct `directory` on every published package.** Without
   it npm publishes with **no provenance attestation**, and the failure is silent —
   the publish succeeds. This has already cost a release.
6. **The three holes filled** (table above).
7. **Never add `registry-url` to `setup-node`.**
8. **No install lifecycle scripts** (`preinstall` / `install` / `postinstall`) —
   npm v12 blocks them by default for consumers.

The two scripts, verbatim:

```json
"changeset:version": "changeset version && pnpm install --no-frozen-lockfile && pnpm format",
"changeset:publish": "changeset publish"
```

The `pnpm install --no-frozen-lockfile` guards a real hazard: if internal packages
are referenced by real version ranges, `changeset version` rewrites them and the
next `--frozen-lockfile` install fails. It does not bite while you use
`workspace:*` — but that is a choice of today, not a property of the standard.

In a repo with no build, `changeset:publish` is `changeset publish` verbatim.
**No no-op `build` script is ever required.**

### Why `devEngines`, and not `engines`

```jsonc
"devEngines": {
  "runtime": { "name": "node", "version": "24.20.0", "onFail": "error" }
},
"engines": { "node": ">=22.11" }   // a different thing: what you ask of consumers
```

`setup-node` v6+ resolves `node-version-file: package.json` in this order:
`volta.node` → **`devEngines.runtime`** → `engines.node` → `volta.extends`. This
removes the workflows' only shared hole — the Node version is declared once, in
`package.json`, and CI, npm and pnpm all honour it. pnpm 11 validates it against
the running Node and fails with `ERR_PNPM_BAD_RUNTIME_VERSION` per `onFail`.

`engines.node` was rejected for the job even though it is the intuitive pick. It is
a **range** describing what consumers need, and `setup-node` resolves a range to its
**floor** — a repo declaring `">=20"` would land on Node 20, whose bundled npm is
10.x. It also couples two things that must move independently: the Node you develop
on, and the minimum you impose on consumers.

**Use Node 24 or later, not 22**, even though `@changesets/cli` v3 permits
`^22.11`. Node 22 bundles npm 10.x, below the npm ≥ 11.5.1 floor for OIDC. (In a
pnpm workspace `changeset publish` delegates to **`pnpm publish`**, so the floor
that actually binds is pnpm ≥ 11.1.3 — but a current Node 24 satisfies both, and
depending on only one of them is a needless bet.)

Honest trade-off: `devEngines` gives no automatic local version switching. fnm, nvm
and volta do not read it; mise does, but only with idiomatic version files
explicitly enabled. Accepted — the failure that hurts is the publishing one.

### Do not build on corepack

Node 25 no longer ships it. This costs the standard nothing: `pnpm/action-setup`
never used corepack — it downloads pnpm itself and merely _reads_ `packageManager` —
and pnpm absorbed corepack's job as `pmOnFail: download`. **`corepack enable` should
appear nowhere in these repos.**

---

## Day zero: a package that has never been published

A package with no versions on the registry **cannot have a trusted publisher**. npm
is literal about it: _"The package you're configuring must already exist on the npm
registry."_ So adopting the standard on a new package is a documented two-phase
affair, not an undocumented cliff.

**Run this at scaffolding time, not just before the first real release.** The
irreversible failure is someone else taking the name.

1. **Publish a placeholder.** In a throwaway directory, a minimal `package.json` at
   version `0.0.0` and a README stating plainly that the package is **not**
   functional, contains **no** code, exists **only** to configure OIDC, and must
   **not** be used as a dependency. Publish with a granular access token scoped to
   that single package:

   ```sh
   npm publish --access public --tag bootstrap
   ```

   The custom dist-tag is the point: `latest` is never created, so an install during
   the window fails loudly rather than silently pulling an empty package.

2. **Configure the trusted publisher** on npmjs.com — manual, interactive 2FA,
   pointing at this repo's `release.yml`.
3. **Verify** that a real publish goes out through OIDC and carries an attestation.
4. **Tighten**: set the package's Publishing access to _"Require two-factor
   authentication and disallow tokens"_. **After step 3, never before** — with OIDC
   misconfigured and tokens already blocked, both routes are shut.
5. **Revoke** the bootstrap token. Revoked, not left to expire.

> [!IMPORTANT]
> **Steps 4 and 5 are not optional.** They are what closes day zero. Until they are
> done, a token can still publish the package, and the standard's security property
> is aspirational rather than true.

Do **not** unpublish the `0.0.0` placeholder. npm's 72-hour window would remove the
package, and with it the very existence the trusted publisher configuration rests on.
A permanent `0.0.0` on the package page is the accepted cost.

### Never add `provenance=true`

Not to this template, not to a repo after its first publish. It looks like a
belt-and-braces guardrail and it is a trap:

- It is **redundant** with day-zero step 4. It guards against publishing from a
  laptop; npm's server-side "disallow tokens" does the same thing, more strongly,
  and cannot be bypassed by deleting a local file.
- It **reintroduces an `.npmrc`**, which this standard removed from every repo.
- **It fights the bootstrap forever, not once.** In a monorepo, every future package
  needs its own day zero, and a root `provenance=true` makes step 1 hard-fail with
  `EUSAGE` — npm refuses automatic provenance outside GitHub Actions / GitLab CI.
  It would not be preventing a mistake; it would be blocking the documented procedure.

Under trusted publishing, **provenance is already automatic with no flag.**

---

## Repository settings

- **Settings → General → Template repository**: ticked. This is what makes
  _Use this template_ the day-zero path.
- **Settings → Actions → General → Allow GitHub Actions to create and approve pull
  requests**: enabled, or `changesets/action` cannot open the version PR.

## Why actions are pinned by SHA

A tag is mutable: whoever compromises an action's repository can re-point `v7` and
walk into your workflows without a line of your code changing. A commit SHA cannot
be re-pointed.

The cost is that a SHA does not move on its own — and `release.yml` is the file you
will touch least, so its pins would fossilise hardest. `.github/renovate.json5`
rewrites both the digest and the trailing `# vX.Y.Z` comment, monthly and grouped,
so the pins stay current at one PR a month instead of sixteen. It needs the
[Renovate GitHub App](https://github.com/apps/renovate) installed on the repo.

Renovate is a scaffolding choice, not canon — swap in Dependabot if you prefer, or
update the pins by hand. **What does not work is keeping the SHA pins with nothing
to move them**, which is the state you land in by deleting this file and no more.

Pin to **commit** SHAs, not annotated-tag-object SHAs. `gh api .../git/ref/tags/<v>`
returns the tag object for repositories that sign their tags; use
`gh api repos/<repo>/commits/<tag>` or `git rev-parse <tag>^{}` instead. Actions
accepts either, so the mistake is silent.

## What this template deliberately does not include

- **No `.npmrc`.** Its three uses are all wrong here: pnpm resolution settings are
  per-repo tooling, registry auth is what the contract forbids, and publish
  behaviour is covered by trusted publishing.
- **No `npm i -g npm@latest`.** `npm@latest` floats between runs, so two runs of the
  same commit would use different npm. Reproducibility wins; `devEngines` handles the
  floor instead.
- **No skills.** A skill shipped in the template is copied content, and adopting
  repos would be copies diverging in parallel.
- **No shared/reusable workflows.** See [Why the canon is copied](#why-the-canon-is-copied-rather-than-shared).
