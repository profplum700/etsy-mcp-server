import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

// Basic heuristic patterns for names that usually carry secrets.
// This list can be expanded as needed.
const SECRET_NAME_REGEX = /(password|secret|token|key|apikey|auth)/i;
// Values that are obviously placeholders are allowed.
const PLACEHOLDER_VALUE_REGEX = /^(dummy|example|test|<.*?>)$/i;

/**
 * Collect ARG and ENV definitions from a Dockerfile and return any that look
 * like secrets hard-coded in plaintext.
 */
function findProblematicArgEnvLines(dockerfileContent: string): string[] {
  const lines = dockerfileContent.split(/\r?\n/);
  const offenders: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip comments and empty lines quickly.
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Detect ARG or ENV instructions.
    if (/^(ARG|ENV)\s+/i.test(trimmed)) {
      // Remove the instruction keyword (ARG/ENV)
      const declaration = trimmed.replace(/^(ARG|ENV)\s+/i, '');

      // ARG can be provided as NAME or NAME=default, ENV can have multiple "NAME=value" pairs.
      // Split on whitespace first to handle cases like "ENV FOO=bar BAZ=qux".
      const pairs = declaration.split(/\s+/);

      for (const pair of pairs) {
        // If it is just a variable name without an assignment (e.g. ARG NODE_VERSION)
        if (!pair.includes('=')) continue;

        const [rawName, rawValue] = pair.split('=', 2);
        const name = rawName.trim();
        const value = rawValue.trim();

        // Heuristic: flag if either the name or the value looks like it might contain a secret.
        const hasSecretName = SECRET_NAME_REGEX.test(name);
        const hasSecretValue = SECRET_NAME_REGEX.test(value);

        if ((hasSecretName || hasSecretValue) && !PLACEHOLDER_VALUE_REGEX.test(value)) {
          offenders.push(trimmed);
        }
      }
    }
  }

  return offenders;
}

describe('Dockerfile sanity checks', () => {
  const dockerfilePath = path.join(__dirname, '..', 'Dockerfile');
  const dockerfileContent = readFileSync(dockerfilePath, 'utf8');

  it('contains no hard-coded secrets in ARG or ENV instructions', () => {
    const offenders = findProblematicArgEnvLines(dockerfileContent);

    expect(
      offenders,
      offenders.length
        ? `Potential secrets found in Dockerfile ARG/ENV:\n${offenders.join('\n')}`
        : 'No secrets detected'
    ).toHaveLength(0);
  });
});
