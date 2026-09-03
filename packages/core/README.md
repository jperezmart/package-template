# @jperezmart/package-template-core

A worked example, not a real package. It is `private` so a fresh clone can never
publish it by accident.

It exists to demonstrate the one contract clause whose breach has already cost a
release: **`repository` with the correct `directory`**. Without it npm publishes
the package with no provenance attestation, and the failure is silent — the
publish succeeds.

To turn it into a real package:

1. Rename it in `package.json`.
2. Delete `"private": true`.
3. Fix `repository.url`, `repository.directory`, `homepage` and `bugs.url`.
4. Run the day-zero bootstrap in the root [README](../../README.md#day-zero-a-package-that-has-never-been-published).
