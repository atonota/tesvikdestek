#!/usr/bin/env bash
# Canonical fingerprint of this change package.
#
# One number that says "the reviewer and the writer looked at the same bytes".
# It replaces an ad hoc `find` pipeline that excluded four cache directories by
# name; anything else a local run happened to leave behind - a `.env`, a
# coverage file, a new cache - silently changed the "immutable" hash. Two
# honest people could compute two different answers for the same package.
#
# What is hashed: every file git considers part of the package - tracked files
# plus untracked-but-not-ignored files - under the package allowlist. `.gitignore`
# is the single source of truth for what is not package content, so the rule
# lives in one place instead of being re-typed into each command.
#
# Read-only. Prints one lowercase SHA-256 hex digest and nothing else.
#
# Deliberately NOT stored in any file this script hashes: writing the result
# into the tree would change the tree, and therefore the result.
#
# Portability is the whole point of the shape below. An earlier version defined
# a `sha256()` shell function and then wrote `xargs -0 sha256`. `xargs` execs a
# *program*, so on macOS that silently ran /sbin/sha256 - which prints
# "SHA256 (path) = hash" rather than GNU's "hash  path" - and on Linux it found
# nothing at all, failed with 127, and let the next stage hash the empty stream
# into e3b0c442..., a perfectly plausible-looking digest of nothing.
set -euo pipefail

# Runs from any working directory: the package is defined relative to the
# repository, not to wherever the caller happens to be standing.
REPO_ROOT="$(git -C "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# The package surface. Everything outside this belongs to the frozen legacy
# prototype and is guarded separately.
ALLOWLIST=(.github docs platform README.md .gitignore)

# Choose the hashing tool once, explicitly, and fail loudly if there is none.
# Never a bare `sha256`: that name is /sbin/sha256 on macOS and nothing on Linux.
if command -v sha256sum >/dev/null 2>&1; then
  HASH_TOOL=(sha256sum)
elif command -v shasum >/dev/null 2>&1; then
  HASH_TOOL=(shasum -a 256)
else
  echo "package-fingerprint: neither sha256sum nor shasum is on PATH" >&2
  exit 1
fi

# Read from stdin so the tool never prints a filename, then keep only the digest
# and force lowercase. GNU and BSD agree on the digest; they disagree about
# everything around it, so nothing around it is kept.
content_digest() {
  "${HASH_TOOL[@]}" <"$1" | cut -d' ' -f1 | tr 'A-F' 'a-f'
}

# One byte-stable record per file: "<lowercase digest>  <relative path>\0".
# NUL-terminated, so a newline in a filename cannot forge or merge a record.
normalised_records() {
  local path
  while IFS= read -r -d '' path; do
    printf '%s  %s\0' "$(content_digest "$path")" "$path"
  done
}

#   -c  tracked files
#   -o  untracked files (this package is intentionally uncommitted)
#   --exclude-standard  honour .gitignore / .git/info/exclude
#   -z  NUL-delimited, so a newline in a filename cannot forge an entry

# An empty file set would hash to the digest of nothing, which looks like a
# real answer. Count the NUL terminators and refuse that outcome outright.
FILE_COUNT="$(
  git ls-files -co --exclude-standard -z -- "${ALLOWLIST[@]}" | tr -dc '\0' | wc -c | tr -d ' '
)"
if [ "$FILE_COUNT" -eq 0 ]; then
  echo "package-fingerprint: no package files matched the allowlist" >&2
  exit 1
fi

# Captured in full before anything is printed: if any stage fails, `pipefail`
# and `set -e` abort here and stdout stays empty rather than carrying a
# plausible digest of a truncated stream.
FINGERPRINT="$(
  git ls-files -co --exclude-standard -z -- "${ALLOWLIST[@]}" \
    | LC_ALL=C sort -z \
    | normalised_records \
    | "${HASH_TOOL[@]}" \
    | cut -d' ' -f1 \
    | tr 'A-F' 'a-f'
)"

# Last gate: print a digest or print nothing.
if ! printf '%s' "$FINGERPRINT" | grep -Eq '^[0-9a-f]{64}$'; then
  echo "package-fingerprint: refusing to emit an implausible digest" >&2
  exit 1
fi

printf '%s\n' "$FINGERPRINT"
